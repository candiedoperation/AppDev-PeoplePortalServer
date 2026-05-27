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

import { Route, Request, Controller, Get, SuccessResponse, Post, Body, Tags, Security, Path } from "tsoa";
import { EmailClient } from "../clients/EmailClient";
import { SlackClient } from "../clients/SlackClient";
import { AuthentikClient } from "../clients/AuthentikClient";
import { ENABLED_SHARED_RESOURCES } from "../config";
import * as express from 'express';
import { CustomValidationError } from "../utils/errors";
import { Event } from "../models/Event";
import { EmailSendRequest } from "../clients/EmailClient/models";
import { resolve } from "path";
import { eventNames } from "process";
import { UserInformationBrief } from "../clients/AuthentikClient/models";
import { UserInfo } from "os";
import { stat } from "fs";
import { BucketAlreadyOwnedByYou } from "@aws-sdk/client-s3";
import { EventRsvp, IRsvp, RsvpStatus } from "../models/EventRsvp";
import { Document, HydratedDocument } from "mongoose";


export interface CreateEventRequest {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    location: string;
    invitedGroupPks?: string[]; // Authentik groups to send invites to
    invitedUserPks?: number[];  // Additional individuals to invite
}

export interface RsvpRequest {
    accept: boolean;
    userInfo?: {
        firstName: string,
        lastName: string,
        email: string,
    };
    reason?: string;
}

const EMAIL_BATCH_SIZE = 5;

@Route("/api/events/")
export class EventController extends Controller {
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
     * Create an event
     */
    @Post("createevent")
    @SuccessResponse(201, "Event Created")
    @Security("bindles", [])
    async createEvent(
        @Request() req: express.Request,
        @Body() body: CreateEventRequest,
    ) {
        // Validations
        if (body.startTime > body.endTime) {
            throw new CustomValidationError(400, "End time can't be before start time.");
        }
        if (body.title.length == 0) {
            throw new CustomValidationError(400, "No title given.");
        }

        const authorizedUser = req.session.authorizedUser!;
        const creatorInfo = await this.authentikClient.getUserInfoFromEmail(authorizedUser.email);

        const event = await Event.create({
            eventName: body.title,
            eventDescription: body.description,
            creator: creatorInfo.pk,
            startTime: body.startTime,
            endTime: body.endTime,
            location: body.location
        });

        // STORE IN MONGODB

        // EMAIL INVITEES
        const userInfo = await this.resolveUserInfo(body.invitedGroupPks, body.invitedUserPks);
        const gCalendarLink = this.generateCalendarLinks(body);

        // Send out emails in batches of size EMAIL_BATCH_SIZE.
        for(let i = 0; i < userInfo.length; i += EMAIL_BATCH_SIZE) {
            const batch = userInfo.slice(i, i+EMAIL_BATCH_SIZE);
            await Promise.all(batch.map((uInfo: UserInformationBrief) => {
                this.emailClient.send({
                    to: uInfo.email,
                    subject: `App Dev Event Invitation - ${body.title}`,
                    templateName: "EventInvite",
                    templateVars: {
                        inviteeName: uInfo.name,
                        eventName: body.title,
                        eventDescription: body.description,
                        startTime: body.startTime,
                        endTime: body.endTime,
                        eventLocation: body.location,
                        googleCalendarLink: gCalendarLink,
                    }
                });
            }));
        }

        // SLACK MESSAGE TO INVITEES

        for (const uInfo of userInfo) {
            const userPresent = await this.slackClient.validateUserPresence(uInfo.email);
            if (userPresent) {
                this.slackClient.sendPrivateMessage(uInfo.email, 
                    `You've been invited to the following App Dev event!`);
            }
            
        }
        const x = await this.slackClient.getSupportedBindles();
        console.log(x);

        // DISCORD MESSAGE TO INVITEES
    }



    /**
     * 
     * Endpoint to create or update a user's RSVP to an event.
     * If user has an account, will get user data through pk.
     * For public events, if user does not have an account,
     * will get the required information through form fields.
     * 
     * 
     * Endpoint to RSVP user to an event given its id.
     * Will get user data through the session. However,
     * for public events, if user does not have an account,
     * will get the required information through form fields.
     * 
     * @param req 
     * @param eventId 
     * @param body 
     */
    @Post("rsvp/{eventId}")
    @SuccessResponse(201, "Event Created")
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

        // Ensure either pk or user info is available.
        const userPk = req.session.authorizedUser?.pk;
        if (userPk === undefined && body.userInfo == undefined) {
            throw new CustomValidationError(400,
                "Either a valid session or userInfo must be present."
            );
        }

        // Check if RSVP already exists.
        let rsvp: HydratedDocument<IRsvp> | null;
        if (userPk !== undefined) {
            rsvp = await EventRsvp.findOne({ 
                eventId: eventId,
                userPk: userPk ,
            });
        } else {
            rsvp = await EventRsvp.findOne({
                eventId: eventId,
                "userInfo.email": body.userInfo?.email,
            });
        }

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
                userPk: userPk,
                userInfo: body.userInfo,
                reason: body.reason,
            });
        }

        // Get email
        let email: string;
        if (userPk !== undefined) {
            const uInfo = await this.authentikClient.getUserInfo(Number(userPk));
            email = uInfo.email;
        } else {
            email = body.userInfo!.email;
        }

        // Get Google Calendar Link
        const gCalendarLink = this.generateCalendarLinks({
            title: event.eventName,
            description: event.eventDescription,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
        });

        // Send confirmation email
        this.emailClient.send({
            to: email,
            subject: "App Dev Event RSVP Confirmation",
            templateName: "RsvpConfirmation",
            templateVars: {
                action: status,
                eventName: event.eventName,
                eventDescription: event.eventDescription,
                startTime: event.startTime,
                endTime: event.endTime,
                eventLocation: event.location,
                googleCalendarLink: gCalendarLink,
            }
        });

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

    private generateCalendarLinks(event: CreateEventRequest): string {
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

        // // .ics raw string for other calendars.
        // const icsData = [
        //     "BEGIN:VCALENDAR",
        //     "VERSION:2.0",
        //     "PRODID:-//App Dev Club//PeoplePortal//EN",
        //     "BEGIN:VEVENT",
        //     `UID:${Date.now()}@.com`,
        //     `DTSTAMP:${formatToUniversalTime(new Date())}`,
        //     `DTSTART:${formatToUniversalTime(event.startTime)}`,
        //     `DTEND:${formatToUniversalTime(event.endTime)}`,
        //     `SUMMARY:${event.title}`,
        //     `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
        //     `LOCATION:${event.location}`,
        //     "END:VEVENT",
        //     "END:VCALENDAR"
        // ].join('\r\n');

        // // Convert the text into a downloadable base64 Data URI
        // const icsDownloadLink = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsData)}`;

        return googleLink.toString();
        // return {
        //     google: googleLink.toString(),
        //     other: icsDownloadLink
        // };
    }
}