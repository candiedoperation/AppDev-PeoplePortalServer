import { Job, JobDefinition } from "agenda";
import { EmailClient } from "../../EmailClient";
import { EmailSendRequest } from "../../EmailClient/models";
import { Event, IEvent } from "../../../models/Event";
import { EventRsvp, RsvpStatus } from "../../../models/EventRsvp";
import { EventController } from "../../../controllers/EventController";
import { HydratedDocument } from "mongoose";
import { ENABLED_SHARED_RESOURCES } from "../../../config";
import { SlackClient } from "../../SlackClient";
import { DiscordClient } from "../../DiscordClient";

interface _JobData {
    jobName: string;
    jobPayload?: JobPayload;
    options?: {
        timezone?: string; // By default, Agenda uses UTC. Be sure to set this to "America/New_York".
        skipImmediate?: boolean;
        forkMode?: boolean;
        startDate?: string | Date;
        endDate?: string | Date;
        skipDays?: number[];
    };
}

export interface JobSchedulingData extends _JobData {
    runAt: Date | string; // runAt also accepts times as strings in English.
                          // See Agenda docs for schedule function.
}

export interface RecurringJobSchedulingData extends _JobData {
    schedule: string;
}


// Helper functions
class JobHelperFunctions {
    public static async sendEventReminderEmail(event: HydratedDocument<IEvent>, emailClient: EmailClient, relativeTime: string) {
        const emails = await EventRsvp.distinct('email', {
            eventId: event._id,
            status: RsvpStatus.ACCEPT,
        }).exec();

        if (emails.length == 0) {
            return;
        }

        const inviteLink = EventController.generateEventInviteLink(event);
        const gCalendarLink = EventController.generateCalendarLink(event);

        await emailClient.send({
            to: process.env.PEOPLEPORTAL_SMTP_USER!,
            bcc: emails,
            subject: `App Dev Event Reminder - ${event.eventName}`,
            templateName: "EventReminder",
            templateVars: {
                relativeTime: relativeTime,
                eventName: event.eventName,
                eventDescription: event.eventDescription,
                startTime: event.startTime.toLocaleString(),
                endTime: event.endTime.toLocaleString(),
                location: event.location,
                inviteLink: inviteLink,
                googleCalendarLink: gCalendarLink,
            }
        });
    }

    public static async sendEventReminderSlack(event: HydratedDocument<IEvent>, relativeTime: string) {
        const slackClient = ENABLED_SHARED_RESOURCES.slackClient as SlackClient;
        const announcementsChannel = await slackClient.getChannelFromName(EventController.SLACK_EVENT_ANNOUNCEMENT_CHANNEL);
        if (announcementsChannel === null) {
            return false;
        }

        if (relativeTime === "2 Hour") {
            relativeTime += "s";
        }
        const inviteLink = EventController.generateEventInviteLink(event);
        const message = `*Reminder*\n` + 
                        `${event.eventName} starts in ${relativeTime}.\n\n` + 
                        `RSVP here: ${inviteLink}`;

        return await slackClient.sendMessageInChannel(announcementsChannel.id!, message);
    }

    public static async sendEventReminderDiscord(event: HydratedDocument<IEvent>, relativeTime: string) {
        const discordClient = ENABLED_SHARED_RESOURCES.discordClient as DiscordClient;
        const inviteLink = EventController.generateEventInviteLink(event);
        if (relativeTime === "2 Hour") {
            relativeTime += "s";
        }
        const message = `## Reminder\n` + 
                        `**${event.eventName}** starts in ${relativeTime}.\n\n` + 
                        `RSVP here: ${inviteLink}`;
        
        try {
            const announcementsChannel = await discordClient.getChannelFromName(EventController.DISCORD_EVENT_ANNOUNCEMENT_CHANNEL);
            if (announcementsChannel === undefined) {
                return false;
            }
            await discordClient.sendMessageInChannel(announcementsChannel, message);
            return true;
        } catch (error) {
            return false;
        }
        
    }
}


// Define job payloads

// Empty payload parent interface (for typing)
export interface JobPayload { }

export interface SendEmailJobPayload extends JobPayload {
    request: EmailSendRequest;
}

export interface SendEventRemindersPayload extends JobPayload {
    eventId: string;
}


// Define Agenda jobs here
export const DefinedJobs: Record<string, {
    workerFunction: (argument: Job<any>) => Promise<void>,
    options?: Partial<Pick<JobDefinition, "lockLimit" | "lockLifetime" | "concurrency" | "backoff" | "removeOnComplete" | "logging">>;
}> = {
    sendEventRemindersDaily: {
        workerFunction: async (job: Job<JobPayload>) => {
            const emailClient = new EmailClient();
            
            const now = new Date();
            const today8AM = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                8,
            );
            const oneDay = 1000 * 60 * 60 * 24; // Day in Milliseconds
            const tomorrow8AM = new Date(today8AM.getTime() + oneDay);
            const nextWeek8AM = new Date(today8AM.getTime() + oneDay * 7);

            const tomorrowEvents = await Event.find({
                startTime: {
                    $gte: tomorrow8AM,
                    $lt: new Date(tomorrow8AM.getTime() + oneDay),
                },
            }).exec();

            const nextWeekEvents = await Event.find({
                startTime: {
                    $gte: nextWeek8AM,
                    $lt: new Date(nextWeek8AM.getTime() + oneDay),
                },
            }).exec();

            const totalEvents = [...tomorrowEvents, ...nextWeekEvents];
            for(const event of totalEvents) {
                try {
                    const relTime = event.startTime < nextWeek8AM ? "1 Day" : "1 Week";
                    await JobHelperFunctions.sendEventReminderEmail(event, emailClient, relTime);

                    if (event.slack) {
                        const success = await JobHelperFunctions.sendEventReminderSlack(event, relTime);
                        if (!success) {
                            console.error("Failed to send Slack reminders for event:", event._id);
                        }
                    }

                    if (event.discord) {
                        const success = await JobHelperFunctions.sendEventReminderDiscord(event, relTime);
                        if (!success) {
                            console.error("Failed to send Discord reminders for event:", event._id);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to send reminders for event ${event._id} due to error:`, error);
                }
                
            };
        },
    },

    sendEventReminders: {
        workerFunction: async (job: Job<SendEventRemindersPayload>) => {
            const event = await Event.findOne({ _id: job.attrs.data.eventId }).exec();
            if (event == null) {
                console.error(`[sendEventReminders Job] - Event ${job.attrs.data.eventId} not found.`);
                return;
            }

            try {
                const emailClient = new EmailClient();
                await JobHelperFunctions.sendEventReminderEmail(event, emailClient, "2 Hour");
                
                if (event.slack) {
                    const success = await JobHelperFunctions.sendEventReminderSlack(event, "2 Hour");
                    if (!success) {
                        console.error("Failed to send Slack reminders for event:", event._id);
                    }
                }

                if (event.discord) {
                    const success = await JobHelperFunctions.sendEventReminderDiscord(event, "2 Hour");
                    if (!success) {
                        console.error("Failed to send Discord reminders for event:", event._id);
                    }
                }

            } catch (error) {
                console.error(`Failed to send reminders for event ${event._id} due to error:`, error);
                job.fail(error?.toString() ?? event._id.toString());
            }       
        },
        options: {
            removeOnComplete: true, // Frees space by removing job from MongoDB on completion
        },
    },
};




// Define any static, repeating jobs here
export const RecurringJobs: RecurringJobSchedulingData[] = [
    {
        jobName: "sendEventRemindersDaily",
        schedule: "0 8 * * *", // 8 AM daily
        options: {
            timezone: "America/New_York"
        }
    }
];