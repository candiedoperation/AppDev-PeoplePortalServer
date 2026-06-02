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

import { Route, Request, Controller, Get, SuccessResponse, Post, Body, Tags, Security, Path, Queries, Delete, Patch } from "tsoa";
import { EmailClient } from "../clients/EmailClient";
import { SlackClient } from "../clients/SlackClient";
import { AuthentikClient } from "../clients/AuthentikClient";
import { ENABLED_SHARED_RESOURCES } from "../config";
import * as express from 'express';
import { CustomValidationError } from "../utils/errors";
import { Event, IEvent } from "../models/Event";
import { EventRsvp, IRsvp, RsvpStatus } from "../models/EventRsvp";
import { Document, FlattenMaps, HydratedDocument, Types } from "mongoose";
import { UserInformationBrief } from "../clients/AuthentikClient/models";
import { agendaClient } from "../clients/AgendaClient";
import { resolve } from "path";
import { DiscordClient } from "../clients/DiscordClient";
import { setUncaughtExceptionCaptureCallback } from "process";


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
    public: boolean;
    invitedGroupPks?: string[]; // Authentik groups to send invites to
    invitedUserPks?: number[];  // Additional individuals to invite
    slack?: boolean; // Send an announcement on Slack. Also affects reminders.
    discord?: boolean; // Send an announcement on Discord. Also affects reminders.
}

export interface BasicEventResponse {
    status: string;
    message?: string;
    issues: string[];
}

export interface CreateEventResponse {
    eventId: string,
    status: string,
    issues: string[],
}

export interface UpdateEventRequest {
    notify: boolean; // Will send update announcements.
    eventName?: string;
    eventDescription?: string;
    startTime?: Date;
    endTime?: Date;
    location?: string;
}

export interface RsvpRequest {
    accept: boolean;
    reason?: string;
}

export type DocumentJSON<T> = FlattenMaps<T> & Required<{ _id: Types.ObjectId; }> & { __v: number };

@Route("/api/events/")
export class EventController extends Controller {
    public static readonly SLACK_EVENT_ANNOUNCEMENT_CHANNEL = "announcements";
    public static readonly DISCORD_EVENT_ANNOUNCEMENT_CHANNEL = "announcements";

    private readonly authentikClient;
    private readonly emailClient;
    private readonly slackClient;
    private readonly discordClient;
    
    constructor() {
        super()
        this.authentikClient = new AuthentikClient();
        this.emailClient = new EmailClient();
        this.slackClient = ENABLED_SHARED_RESOURCES.slackClient as SlackClient;
        this.discordClient = ENABLED_SHARED_RESOURCES.discordClient as DiscordClient;
    }


    /**
     * Get list of event Ids.
     */
    @Get("/")
    @SuccessResponse(200)
    @Security("oidc")
    @Security("ats_otp")
    @Tags("Event Management")
    async getListOfEvents(
        @Request() req?: express.Request,
        @Queries() options?: GetEventListOptions
    ): Promise<GetEventListResponse> {
        let filters: { [key: string]: any } = {};

        if (options?.after !== undefined) {
            filters.startTime = { $gte: options.after };
        }
        if (options?.before !== undefined) {
            if (filters.startTime !== undefined) {
                filters.startTime.$lte = options.before;
            } else {
                filters.startTime = { $lte: options.before };
            }
        }

        let isPublic = options?.public;
        // Checks if user has a temporary session
        if (req?.session.tempsession?.jwt && req.session.tempsession.user) {
            // Only show public events
            isPublic = true;
        }

        if (isPublic !== undefined) {
            filters.public = isPublic;
        }

        const query = Event.distinct("_id", filters);
        const results = await query.exec();
        const response = {
            data: results.map((objId) => objId.toString()),
            count: results.length,
        }

        return response;
    }


    /**
     * Return a single event's information.
     * 
     * @param req express Request object
     * @param eventId Id of the event
     * @returns Event data as json.
     */
    @Get("{eventId}")
    @SuccessResponse(200)
    @Security("oidc")
    @Security("ats_otp")
    @Security("bindles", ["corp:eventmgmt"])
    @Tags("Event Management")
    async getEvent(
        @Request() req: express.Request,
        @Path() eventId: string,
    ) {
        // Get event data
        let query = Event.findOne({ _id: eventId });

        // Checks if user has a temporary session
        if (req?.session.tempsession?.jwt && req.session.tempsession.user) {
            // Only show public events
            query = query.where("public").equals(true);
        }

        try {
            const event = await query.exec();
            if (!event) {
                throw new CustomValidationError(404, `No event with id ${eventId}`);
            }
            return event.toJSON();
        } catch (error) {
            console.error(`Failed to get event data for event ${eventId}:`, error);
            throw new Error(`Failed to fetch event data`);
        }
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
    @Tags("Event Management")
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
            public: body.public,
            invitedGroupPks: body.invitedGroupPks,
            invitedUserPks: body.invitedUserPks,
            slack: body.slack,
            discord: body.discord,
        });

        // EMAIL INVITEES
        const userInfo = await this.resolveUserInfo(body.invitedGroupPks, body.invitedUserPks);
        const gCalendarLink = EventController.generateCalendarLinks(event);
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
        });

        const issues: string[] = [];

        // SLACK MESSAGE
        if (body.slack) {
            const message = `*Event Announcement*\n` +
                            `>${event.eventName}\n` +
                            `Description: ${event.eventDescription}\n` +
                            `Start Time: ${event.startTime.toLocaleString()}\n` +
                            `End Time: ${event.endTime.toLocaleString()}\n` +
                            `Location: ${event.location}\n\n` +
                            `RSVP here: ${inviteLink}\n` +
                            `Add to google calendar: ${gCalendarLink}`;

            const success = await this.sendSlackMessage(message);
            if (!success) {
                issues.push("Failed to send Slack announcement.");
            }
        }

        // DISCORD MESSAGE
        if (body.discord) {
            const message = `# Event Announcement\n` + 
                            `## ${event.eventName}\n` + 
                            `- Description: ${event.eventDescription}\n` +
                            `- Start Time: ${event.startTime.toLocaleString()}\n` +
                            `- End Time: ${event.endTime.toLocaleString()}\n` +
                            `- Location: ${event.location}\n\n` +
                            `RSVP here: ${inviteLink}\n` +
                            `Add to google calendar: ${gCalendarLink}`;

            const success = await this.sendDiscordMessage(message);
            if (!success) {
                issues.push("Failed to send Discord announcement.");
            }
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
            status: "Event Created Successfully",
            issues: issues,
        };
    }


    /**
     * Cancels event. Deletes document from Events and all RSVPs.
     * 
     * @param req Express Request Object
     * @param eventId Id of the event to cancel
     * @param options { notify?: boolean }. If notify is true (default), will send notify invitees of event cancellation.
     * @returns BasicEventResponse
     */

    @Delete("{eventId}/cancel")
    @SuccessResponse(200, "Event cancelled.")
    @Security("bindles", ["corp:eventmgmt"])
    @Tags("Event Management")
    async cancelEvent(
        @Request() req: express.Request,
        @Path() eventId: string,
        @Queries() options?: { notify?: boolean }
    ) {
        // Find event
        let event: HydratedDocument<IEvent> | null;
        try {
            event = await Event.findOne({ _id: eventId }).exec();
        } catch (error) {
            console.error(`Failed to get event data for event ${eventId}: `, error);
            throw Error(`Failed to fetch event ${eventId}`);
        }
        
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

        const issues: string[] = [];

        const invitees = await this.resolveUserInfo(event.invitedGroupPks, event.invitedUserPks);
        await this.emailClient.send({
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
            const message = `*Event Announcement*\n` + 
                            `${event.eventName} has been *cancelled.*`;

            const success = await this.sendSlackMessage(message);
            if (!success) {
                issues.push("Failed to send Slack announcement.");
            }
        }

        // Send Discord Message
        if (event.discord) {
            const message = `# Event Announcement\n` + 
                            `**${event.eventName}** has been **cancelled**`;
            
            const success = await this.sendDiscordMessage(message);
            if (!success) {
                issues.push("Failed to send Discord announcement.");
            }
        }

        return {
            status: "Success",
            message: "Successfully cancelled event",
            issues: issues,
        };
    }


    /**
     * Updates the information of an event. Sends update announcement if
     * notify is set.
     * 
     * @param eventId id of the event
     * @param body UpdateEventRequest
     * @returns BasicEventResponse
     */
    @Patch("{eventId}/update")
    @SuccessResponse(200, "Event successfully updated")
    @Security("bindles", ["corp:eventmgmt"])
    @Tags("Event Management")
    async updateEvent(
        @Path() eventId: string,
        @Body() body: UpdateEventRequest
    ) {
        let event: HydratedDocument<IEvent> | null;
        try {
            event = await Event.findOne({ _id: eventId }).exec();
        } catch (error) {
            console.error(`Failed to get event data for event ${eventId}: `, error);
            throw Error(`Failed to fetch event ${eventId}`);
        }

        if (!event) {
            throw new CustomValidationError(404, `No event with id ${eventId}`);
        }

        const { notify, ...docUpdates } = body;

        // Strip undefined values and values equal to existing values.
        Object.keys(docUpdates).forEach((key) => {
            const k = key as keyof typeof docUpdates;
            if (docUpdates[k] === undefined || docUpdates[k] === event[k]) {
                delete docUpdates[k];
            }
        });

        const issues: string[] = [];

        // Nothing to change.
        if (Object.keys(docUpdates).length == 0) {
            this.setStatus(204);
            return { status: "Success", message: "No data changed.", issues: issues };
        }

        if (!body.notify) {
            event.set(docUpdates);
            await event.save();
            return { status: "Success", message: "Successfully updated event.", issues: issues };
        }

        const friendlyNames = {
            "eventName": "Name",
            "eventDescription": "Description",
            "startTime": "Start Time",
            "endTime": "End Time",
            "location": "Location"
        };

        const order = ["Name", "Description", "Start Time", "End Time", "Location"];

        // Calculate diff
        const diff = Object.keys(docUpdates).map((key) => {
            const k = key as keyof typeof docUpdates;
            return {
                name: friendlyNames[k],
                oldData: event[k],
                newData: docUpdates[k]
            };
        });

        // Sort for cleaner diff (prevents stuff like End Time showing before Start Time)
        diff.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

        const users = await this.resolveUserInfo(event.invitedGroupPks, event.invitedUserPks);
        const emails = users.map(user => user.email);
        const oldName = event.eventName;

        event.set(docUpdates);
        await event.save();

        const gCalendarLink = EventController.generateCalendarLinks(event);
        const inviteLink = EventController.generateEventInviteLink(event);

        this.emailClient.send({
            to: process.env.PEOPLEPORTAL_SMTP_USER!,
            bcc: emails,
            subject: `Update for ${oldName}`,
            templateName: "EventUpdate",
            templateVars: {
                eventName: oldName,
                diff: diff,
                googleCalendarLink: gCalendarLink,
                inviteLink: inviteLink
            }
        });

        if (event.slack) {
            const message = `*Important Update*\n` + 
                            `Changes have been made to ${event.eventName}.\n` + 
                            `Please review the new information here: ${inviteLink}`;
    
            const success = await this.sendSlackMessage(message);
            if (!success) {
                issues.push("Failed to send Slack announcement.");
            }
        }

        if (event.discord) {
            const message = `## Update - ${event.eventName}\n` + 
                            `Changes have been made to ${event.eventName}.\n` + 
                            `Please review the new information here: ${inviteLink}`;
            
            const success = await this.sendDiscordMessage(message);
            if (!success) {
                issues.push("Failed to send Discord announcement.");
            }
            
        }

        return {
            status: "Success",
            message: "Successfully updated event",
            issues: issues,
        };
    }


    /**
     * Returns rsvp data for a specific event.
     * @param eventId 
     * @returns { status: string, data: HydratedDocument<IRsvp>[] }
     */
    @Get("{eventId}/rsvps")
    @SuccessResponse(200)
    @Security("bindles", ["corp:eventmgmt"])
    @Tags("Event RSVPs")
    async getRsvps(
        @Path() eventId: string
    ) {
        try {
            const query = EventRsvp.find({ eventId: eventId });
            const results = await query.exec();
            return {
                status: "success",
                data: results.map(document => document.toJSON()),
            };
        } catch (error) {
            console.error(`Failed to get RSVPs for event ${eventId}:`, error);
            throw new Error(`Failed to fetch RSVPs`);
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
    @Post("{eventId}/rsvp")
    @SuccessResponse(201, "Rsvp Created")
    @Security("ats_otp")
    @Security("oidc")
    @Tags("Event RSVPs")
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
        const email = req.session.authorizedUser?.email ?? req.session.tempsession?.user?.email;
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
            rsvp.status = status;
            if (body.reason !== undefined) {
                rsvp.reason = body.reason;
            }
            await rsvp.save();
        } else {
            await EventRsvp.create({
                eventId: eventId,
                status: status,
                email: email,
                reason: body.reason,
            });
        }

        // Get Google Calendar Link
        const gCalendarLink = EventController.generateCalendarLinks(event);

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
     * Checks if current user has RSVP'd to the given event.
     * Returns rsvp data if user has RSVP'd, and null otherwise.
     * 
     * @param eventId id of the event.
     * @param req express Request object
     * @returns { status: string, rsvpData: DocumentJSON<IRsvp> | null }
     */
    @Get("{eventId}/rsvp")
    @Security("oidc")
    @Security("ats_otp")
    @SuccessResponse(200)
    @Tags("Event RSVPs")
    async getRsvpForEvent(
        @Path() eventId: string,
        @Request() req: express.Request,
    ): Promise<{ status: string, rsvpData: DocumentJSON<IRsvp> | null }> {
        // Get event
        const event = await Event.findOne({ _id: eventId }).exec();
        if (!event) {
            throw new CustomValidationError(404, `No event with id ${eventId}`);
        }
    
        // Ensure email is available through session or tempsession
        const email = req.session.authorizedUser?.email ?? req.session.tempsession?.user?.email;
        if (email === undefined) {
            throw new CustomValidationError(401, "User session not found.");
        }

        const rsvp = await EventRsvp.findOne({ eventId: eventId, email: email }).exec();
        if (!rsvp) {
            return {
                status: "Success",
                rsvpData: null,
            };
        }
        
        return {
            status: "Success",
            rsvpData: rsvp.toJSON(),
        };
    }

    private async sendSlackMessage(message: string) : Promise<boolean> {
        const slackChannel = await this.slackClient.getChannelFromName(EventController.SLACK_EVENT_ANNOUNCEMENT_CHANNEL);
        if (slackChannel?.id !== undefined) {
            const success = this.slackClient.sendMessageInChannel(slackChannel.id!, message);
            if (!success) {
                console.error("Failed to send slack message.");
                return false;
            }
            return success;
        } else {
            console.error("Slack announcements channel not found.");
            return false;
        }
    }

    private async sendDiscordMessage(message: string) : Promise<boolean> {
        try {
            const discordChannel = await this.discordClient.getChannelFromName(EventController.DISCORD_EVENT_ANNOUNCEMENT_CHANNEL);
            if (discordChannel !== undefined) {
                this.discordClient.sendMessageInChannel(discordChannel, message);
            } else {
                throw new Error("Could not find announcements channel.")
            }
            return true;
        } catch (error) {
            console.error("Failed to send discord announcement:", error);
            return false;
        }
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

    static generateCalendarLinks(event: HydratedDocument<IEvent>): string {
        // Helper to format dates to Google/ICS standard: YYYYMMDDTHHMMSSZ
        const formatToUniversalTime = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const timeChunk = `${formatToUniversalTime(event.startTime)}/${formatToUniversalTime(event.endTime)}`;

        // Link for google calendar.
        const googleLink = new URL("https://calendar.google.com/calendar/render");
        googleLink.searchParams.append("action", "TEMPLATE");
        googleLink.searchParams.append("text", event.eventName);
        googleLink.searchParams.append("dates", timeChunk);
        googleLink.searchParams.append("details", event.eventDescription);
        googleLink.searchParams.append("location", event.location);
        googleLink.searchParams.append("ctz", "America/New_York"); // Time zone

        return googleLink.toString();
    }
}