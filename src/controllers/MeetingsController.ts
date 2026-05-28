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

import * as express from "express";
import {
    Body,
    Controller,
    Delete,
    Get,
    Patch,
    Path,
    Post,
    Request,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import { TeamMeeting } from "../models/TeamMeeting";
import { CustomValidationError } from "../utils/errors";


interface APITeamMeetingCreateRequest {
    name: string;
    description?: string;
    day: number;
    start: number;
    end: number;
}

interface APITeamMeetingUpdateRequest {
    name?: string;
    description?: string;
    day?: number;
    start?: number;
    end?: number;
}

export interface APITeamMeetingResponse {
    _id: string;
    teamPk: string;
    name: string;
    description: string;
    day: number;
    start: number;
    end: number;
    createdBy: number;
    createdAt: Date;
    updatedAt: Date;
}


@Route("/api/org/teams")
export class MeetingsController extends Controller {
    /**
     * Returns all meetings scheduled for a team, ordered by day then start time.
     *
     * @param teamId Authentik group PK of the team
     */
    @Get("{teamId}/meetings")
    @Tags("Team Meetings")
    @SuccessResponse(200)
    @Security("oidc")
    async getTeamMeetings(
        @Path() teamId: string,
    ): Promise<APITeamMeetingResponse[]> {
        return await TeamMeeting
            .find({ teamPk: teamId })
            .sort({ day: 1, start: 1 })
            .lean()
            .exec() as any as APITeamMeetingResponse[];
    }

    /**
     * Creates a new meeting for the given team.
     * Requires the requesting user to be a Team Lead (or superuser) for the team.
     *
     * @param teamId Authentik group PK of the team
     * @param body   Meeting details
     */
    @Post("{teamId}/meetings")
    @Tags("Team Meetings")
    @SuccessResponse(201)
    @Security("oidc")
    async createTeamMeeting(
        @Request() req: express.Request,
        @Path() teamId: string,
        @Body() body: APITeamMeetingCreateRequest,
    ): Promise<APITeamMeetingResponse> {
        if (body.start >= body.end) {
            throw new CustomValidationError(400, "Meeting start time must be before end time");
        }

        const meeting = await TeamMeeting.create({
            teamPk:      teamId,
            name:        body.name,
            description: body.description ?? "",
            day:         body.day,
            start:       body.start,
            end:         body.end,
            createdBy:   req.session.authorizedUser!.pk,
        });

        this.setStatus(201);
        return meeting.toObject() as APITeamMeetingResponse;
    }

    /**
     * Updates an existing team meeting. Only the fields provided in the
     * request body are changed.
     * Requires the requesting user to be a Team Lead (or superuser) for the team.
     *
     * @param teamId    Authentik group PK of the team
     * @param meetingId MongoDB ObjectId of the meeting
     * @param body      Fields to update
     */
    @Patch("{teamId}/meetings/{meetingId}")
    @Tags("Team Meetings")
    @SuccessResponse(200)
    @Security("oidc")
    async updateTeamMeeting(
        @Path() teamId: string,
        @Path() meetingId: string,
        @Body() body: APITeamMeetingUpdateRequest,
    ): Promise<APITeamMeetingResponse> {
        const meeting = await TeamMeeting.findOne({ _id: meetingId, teamPk: teamId });
        if (!meeting) throw new CustomValidationError(404, "Meeting not found");

        if (body.name        !== undefined) meeting.name        = body.name;
        if (body.description !== undefined) meeting.description = body.description;
        if (body.day         !== undefined) meeting.day         = body.day;
        if (body.start       !== undefined) meeting.start       = body.start;
        if (body.end         !== undefined) meeting.end         = body.end;

        const effectiveStart = body.start ?? meeting.start;
        const effectiveEnd   = body.end   ?? meeting.end;
        if (effectiveStart >= effectiveEnd) {
            throw new CustomValidationError(400, "Meeting start time must be before end time");
        }

        await meeting.save();
        return meeting.toObject() as APITeamMeetingResponse;
    }

    /**
     * Permanently deletes a team meeting.
     * Requires the requesting user to be a Team Lead (or superuser) for the team.
     *
     * @param teamId    Authentik group PK of the team
     * @param meetingId MongoDB ObjectId of the meeting
     */
    @Delete("{teamId}/meetings/{meetingId}")
    @Tags("Team Meetings")
    @SuccessResponse(204)
    @Security("oidc")
    async deleteTeamMeeting(
        @Path() teamId: string,
        @Path() meetingId: string,
    ): Promise<void> {
        const meeting = await TeamMeeting.findOne({ _id: meetingId, teamPk: teamId });
        if (!meeting) throw new CustomValidationError(404, "Meeting not found");
        await meeting.deleteOne();
    }
}
