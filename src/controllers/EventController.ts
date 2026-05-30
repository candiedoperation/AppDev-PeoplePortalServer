/**
  People Portal Server
  Copyright (C) 2026  Atheesh Thirumalairajan

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Route, Request, Controller, Get, SuccessResponse, Post, Body, Tags, Security, Path, Queries, Delete } from "tsoa";
import { EmailClient } from "../clients/EmailClient";
import { SlackClient } from "../clients/SlackClient";
import { AuthentikClient } from "../clients/AuthentikClient";
import { ENABLED_SHARED_RESOURCES } from "../config";
import * as express from 'express';
import { CustomValidationError } from "../utils/errors";
import { Event, IEvent } from "../models/Event";
import { EventRsvp, IRsvp, RsvpStatus } from "../models/EventRsvp";
import { HydratedDocument } from "mongoose";
import { UserInformationBrief } from "../clients/AuthentikClient/models";
import { agendaClient } from "../clients/AgendaClient";


export interface GetEventListOptions {
    before?: Date;
    after?: Date;
    public?: boolean;
}
export interface GetEventListResponse {
    data: string[],
    count: number,
}

export interface CreateEventRequest {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    location: string;
    invitedGroupPks?: string[]; // Authentik groups to send invites to
    invitedUserPks?: number[];  // Additional individuals to invite
    slack?: boolean; // Send an announcement on Slack. Also affects reminders.
    discord?: boolean; // Send an announcement on Discord. Also affects reminders.
}

export interface CreateEventResponse {
    eventId: string,
    status: string,
}

export interface RsvpRequest {
    accept: boolean;
    reason?: string;
}


@Route("/api/events/")
export class EventController extends Controller {
    public static readonly SLACK_EVENT_ANNOUNCEMENT_CHANNEL = "announcements";

    private readonly authentikClient;
    private readonly emailClient;
    private readonly slackClient;
    
    constructor() {
        super()
        this.authentikClient = new AuthentikClient();
        this.emailClient = new EmailClient();
        this.slackClient = ENABLED_SHARED_RESOURCES.slackClient as SlackClient;
    }


    /**
     * Get list of event Ids.
     */
    @Get("/")
    @SuccessResponse(200)
    async getListOfEvents(
        @Queries() options?: GetEventListOptions
    ): Promise<GetEventListResponse> {
        const query = Event.distinct("_id", {
            startTime: {
                $gte: options?.after === undefined ? undefined : options.after,
                $lte: options?.before === undefined ? undefined : options.before,
            },
            public: options?.public === undefined ? undefined : options.public
        });
        
        const results = await query.exec();
        const response = {
            data: results.map((objId) => objId.toString()),
            count: results.length,
        }

        return response;
    }


    /**
     * Return
     * 
     * @param eventId Id of the event
     * @returns Event data as json.
     */
    @Get("{eventId}")
    @SuccessResponse(200)
    @Security("oidc")
    @Security("bindles", ["corp:eventmgmt"])
    async getEvent(
        @Path() eventId: string,
    ) {
        // Get event data
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new CustomValidationError(404, `No event with id ${eventId}`);
        }

        return event.toJSON();
    }

    /**
     * 
     * @param req Express Request Object
     * @param body CreateEventRequest
     * @returns Object with eventId and status.
     */
    @Post("createevent")
    @SuccessResponse(201, "Event Created")
    @Security("bindles", ["corp:eventmgmt"])
    async createEvent(
        @Request() req: express.Request,
        @Body() body: CreateEventRequest,
    ): Promise<CreateEventResponse> {
        // Validations
        if (body.startTime > body.endTime) {
            throw new CustomValidationError(400, "End time can't be before start time.");
        }
        if (body.title.length == 0) {
            throw new CustomValidationError(400, "No title given.");
        }

        const authorizedUser = req.session.authorizedUser!;

        const event = await Event.create({
            eventName: body.title,
            eventDescription: body.description,
            creator: authorizedUser.pk,
            startTime: body.startTime,
            endTime: body.endTime,
            location: body.location,
            invitedGroupPks: body.invitedGroupPks,
            invitedUserPks: body.invitedUserPks,
            slack: body.slack,
            discord: body.discord,
        });

        // EMAIL INVITEES
        const userInfo = await this.resolveUserInfo(body.invitedGroupPks, body.invitedUserPks);
        const gCalendarLink = EventController.generateCalendarLinks(body);
        const inviteLink = EventController.generateEventInviteLink(event);

        // Send out emails to invitees with bcc.
        const emails = userInfo.map(uInfo => uInfo.email);
        await this.emailClient.send({
            to: process.env.PEOPLEPORTAL_SMTP_USER!,
            cc: [authorizedUser.email],
            bcc: emails,
            subject: `App Dev Event Invitation - ${body.title}`,
            templateName: "EventInvite",
            templateVars: {
                eventName: body.title,
                eventDescription: body.description,
                startTime: body.startTime.toLocaleString(),
                endTime: body.endTime.toLocaleString(),
                eventLocation: body.location,
                inviteLink: inviteLink,
                googleCalendarLink: gCalendarLink,
            },
            replyTo: [authorizedUser.email],
        })

        const message = `*Event Announcement*\n>${event.eventName}\nDescription: ${event.eventDescription}\nStart Time: ${event.startTime.toLocaleString()}\nEnd Time: ${event.endTime.toLocaleString()}\nLocation: ${event.location}\n\nRSVP here: ${inviteLink}\nAdd to google calendar: ${gCalendarLink}\n`;

        // SLACK MESSAGE
        if (body.slack) {
            const slackChannel = await this.slackClient.getChannelFromName(EventController.SLACK_EVENT_ANNOUNCEMENT_CHANNEL);
            if (slackChannel) {
                this.slackClient.sendMessageInChannel(slackChannel.id!, message);
            }
        }

        // DISCORD MESSAGE
        if (body.discord) {
            // TODO
        }

        // Schedule 2 Hour Reminder
        agendaClient.scheduleJobOnce({
            jobName: "sendEventReminders",
            runAt: new Date(event.startTime.getTime() - 1000 * 60 * 60 * 2),
            jobPayload: { eventId: event._id.toString() },
            options: { timezone: "America/New_York" }
        });

        return {
            eventId: event._id.toString(),
            status: "Event Created Successfully"
        }
    }


    /**
     * Cancels event. Deletes document from Events and all RSVPs.
     * 
     * @param req Express Request Object
     * @param eventId Id of the event to cancel
     * @param options { notify?: boolean }. If notify is true (default), will send notify invitees of event cancellation.
     * @returns 
     */
    @Delete("cancel/{eventId}")
    @SuccessResponse(200, "Event cancelled.")
    @Security("bindles", ["corp:eventmgmt"])
    async cancelEvent(
        @Request() req: express.Request,
        @Path() eventId: string,
        @Queries() options?: { notify?: boolean }
    ) {
        // Find event
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new CustomValidationError(404, `No event with id ${eventId}`);
        }

        await agendaClient.cancelJob("sendEventReminders", { eventId: eventId });
        // Delete all RSVPs and Event
        const rsvp_deletion = await EventRsvp.deleteMany({ eventId: eventId }).exec();
        await event.deleteOne();

        if (options?.notify === false) {
            return;
        }

        const invitees = await this.resolveUserInfo(event.invitedGroupPks, event.invitedUserPks);
        this.emailClient.send({
            to: process.env.PEOPLEPORTAL_SMTP_USER!,
            cc: [req.session.authorizedUser!.email],
            bcc: invitees.map(invitee => invitee.email),
            subject: `App Dev Event Cancelled - ${event.eventName}`,
            templateName: "EventCancellation",
            templateVars: {
                eventName: event.eventName,
                eventDescription: event.eventDescription,
                startTime: event.startTime,
                endTime: event.endTime
            },
        });

        // Send Slack Message
        if (event.slack) {
            const message = `*Event Announcement*\n${event.eventName} has been *cancelled.*`;
            const slackChannel = await this.slackClient.getChannelFromName(EventController.SLACK_EVENT_ANNOUNCEMENT_CHANNEL);
            let success = slackChannel !== null;
            if (slackChannel) {
                success = await this.slackClient.sendMessageInChannel(slackChannel.id!, message);
            }

            if (!success) {
                console.error("Failed to send cancellation message in Slack for event:", event._id.toString());
            }
        }
    }

    
    /**
     * 
     * Endpoint to RSVP user to an event given its id.
     * Will get user email through either the session,
     * or if the user is not yet an App Dev member, gets
     * email through a tempsession.
     * 
     * @param req Will be used to get session or tempsession
     * @param eventId object id of the event to rsvp to (string)
     * @param body Rsvp Request
     */
    @Post("rsvp/{eventId}")
    @SuccessResponse(201, "Rsvp Created")
    @Security("ats_otp")
    @Security("oidc")
    async rsvpToEvent(
        @Request() req: express.Request,
        @Path() eventId: string,
        @Body() body: RsvpRequest,
    ) {
        // Check if event exists
        const event = await Event.findOne({ _id: eventId });
        if (!event) {
            throw new CustomValidationError(404, `No event with id ${eventId}`);
        }

        // Ensure email is available through session or tempsession
        let email = req.session.authorizedUser?.email ?? req.session.tempsession?.user?.email;
        if (email === undefined) {
            throw new CustomValidationError(401, "User session not found.");
        }

        // Check if user is allowed to join event.
        if (!event.public) {
            // Check if user has an account.
            const userPk = req.session.authorizedUser?.pk;
            if (userPk === undefined) {
                throw new CustomValidationError(401, "Valid account required for non-public events.");
            }

            let authorized = false;

            // Check if user is in invited users
            if (event.invitedUserPks && event.invitedUserPks.includes(userPk)) {
                authorized = true;
            } 

            // Check if user is member of any invited groups.
            if (!authorized && event.invitedGroupPks) {
                for (const groupPk of event.invitedGroupPks) {
                    const groupInfo = await this.authentikClient.getGroupInfo(groupPk);
                    for (const uInfo of groupInfo.users) {
                        if (uInfo.email === email) {
                            authorized = true;
                            break;
                        }
                    }
                    if (authorized) break;
                }
            }

            if (!authorized) {
                throw new CustomValidationError(401, "Unauthorized to RSVP to event.");
            }
        }

        // Check if RSVP already exists.
        let rsvp: HydratedDocument<IRsvp> | null;
        rsvp = await EventRsvp.findOne({
            eventId: eventId,
            email: email,
        });

        let status = body.accept ? RsvpStatus.ACCEPT : RsvpStatus.DECLINE;
        if (rsvp && rsvp.status == RsvpStatus.ACCEPT && !body.accept) {
            status = RsvpStatus.CANCEL;
        }

        // Update existing rsvp or create new one.
        if (rsvp) {
            await rsvp.updateOne({
                $set: {
                    status: status,
                    reason: body.reason,
                }
            });
        } else {
            await EventRsvp.create({
                eventId: eventId,
                status: status,
                email: email,
                reason: body.reason,
            });
        }

        // Get Google Calendar Link
        const gCalendarLink = EventController.generateCalendarLinks({
            title: event.eventName,
            description: event.eventDescription,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
        });

        // Send confirmation email
        this.emailClient.send({
            to: email!,
            subject: "App Dev Event RSVP Confirmation",
            templateName: "RsvpConfirmation",
            templateVars: {
                action: status,
                eventName: event.eventName,
                eventDescription: event.eventDescription,
                startTime: event.startTime.toLocaleString(),
                endTime: event.endTime.toLocaleString(),
                eventLocation: event.location,
                googleCalendarLink: gCalendarLink,
            }
        });

    }

    /**
     * Generates a link accessible on the frontend allowing users
     * to RSVP to events.
     * 
     * @param event Mongoose Event Document
     * @returns Generated link : string
     */
    public static generateEventInviteLink(event: HydratedDocument<IEvent>) {
        // TODO
        return '';
    }

    /**
     * Private helper method to get deduplicated list of user info from list
     * of Authentik groups and/or list of individual user Ids.
     * Warning: If one group fails to resolve, will skip it and continue
     * instead of throwing an error.
     * 
     * @param groupPks (optional) List of group Ids in Authentik
     * @param userPks (optional) List of user Ids in Authentik
     * @returns Deduplicated array of user info for all groups + individuals.
     */
    private async resolveUserInfo(groupPks?: string[], userPks?: number[]): Promise<Array<UserInformationBrief>> {
        const resolvedPks = new Set<number>();
        const resolvedUserInfo = new Set<UserInformationBrief>();
        if (groupPks) {
            await Promise.all(
                groupPks.map(async (groupId: string) => {
                    try {
                        const groupInfo = await this.authentikClient.getGroupInfo(groupId);
                        if (groupInfo.users) {
                            for (const user of groupInfo.users) {
                                resolvedPks.add(Number(user.pk));
                                resolvedUserInfo.add(user);
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to get information from group ${groupId}`, error);
                    }
                        
                })
            );
        }
        if (!userPks) {
            return Array.from(resolvedUserInfo);
        }

        await Promise.all(
            userPks.map(async (userId: number) => {
                try {
                    if (!resolvedPks.has(userId)) {
                        const userInfo = await this.authentikClient.getUserInfo(userId);
                        resolvedUserInfo.add(userInfo);
                    }
                } catch (error) {
                    console.error(`Failed to get information from userId ${userId}`, error);
                }
            })
        );

        return Array.from(resolvedUserInfo);
    }

    static generateCalendarLinks(event: CreateEventRequest): string {
        // Helper to format dates to Google/ICS standard: YYYYMMDDTHHMMSSZ
        const formatToUniversalTime = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const timeChunk = `${formatToUniversalTime(event.startTime)}/${formatToUniversalTime(event.endTime)}`;

        // Link for google calendar.
        const googleLink = new URL("https://calendar.google.com/calendar/render");
        googleLink.searchParams.append("action", "TEMPLATE");
        googleLink.searchParams.append("text", event.title);
        googleLink.searchParams.append("dates", timeChunk);
        googleLink.searchParams.append("details", event.description);
        googleLink.searchParams.append("location", event.location);
        googleLink.searchParams.append("ctz", "America/New_York"); // Time zone

        return googleLink.toString();
    }
}