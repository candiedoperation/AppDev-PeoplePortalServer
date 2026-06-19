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

import { randomUUID } from "crypto";
import * as express from "express";
import {
    Body,
    Controller,
    Delete,
    Get,
    Patch,
    Path,
    Post,
    Query,
    Request,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import { TeamMeeting } from "../models/TeamMeeting";
import { AuthentikClient } from "../clients/AuthentikClient";
import { CustomValidationError } from "../utils/errors";

/** Which occurrences of a recurring series a mutation applies to */
type MeetingScope = "this" | "following" | "all";

interface APITeamMeetingCreateRequest {
    name: string;
    description?: string;
    start: Date;
    end: Date;
    /** When true, the meeting repeats weekly through the team's end date */
    recurring?: boolean;
}

interface APITeamMeetingUpdateRequest {
    name?: string;
    description?: string;
    start?: Date;
    end?: Date;
    /** Defaults to "this" when omitted */
    scope?: MeetingScope;
}

export interface APITeamMeetingResponse {
    _id: string;
    teamPk: string;
    seriesId: string;
    recurring: boolean;
    name: string;
    description: string;
    start: Date;
    end: Date;
    createdBy: number;
    createdAt: Date;
    updatedAt: Date;
}

/** Generates weekly occurrence start/end pairs from `start`/`end` through `until` (inclusive). */
function generateWeeklyOccurrences(start: Date, end: Date, until: Date): Array<{ start: Date; end: Date }> {
    const occurrences: Array<{ start: Date; end: Date }> = [];
    const cursorStart = new Date(start);
    const cursorEnd = new Date(end);

    /* Compare on date only so an occurrence on the `until` day is included */
    const untilEnd = new Date(until);
    untilEnd.setHours(23, 59, 59, 999);

    while (cursorStart.getTime() <= untilEnd.getTime()) {
        occurrences.push({ start: new Date(cursorStart), end: new Date(cursorEnd) });
        /* setDate preserves wall-clock time across DST boundaries */
        cursorStart.setDate(cursorStart.getDate() + 7);
        cursorEnd.setDate(cursorEnd.getDate() + 7);
    }

    return occurrences;
}


@Route("/api/org/teams")
export class MeetingsController extends Controller {
    private readonly authentikClient = new AuthentikClient();

    /**
     * Returns meetings scheduled for a team, ordered by start time. When `from`
     * and/or `to` are supplied, only occurrences starting within that range are
     * returned (used to load a single visible week).
     *
     * @param teamId Authentik group PK of the team
     * @param from   ISO datetime; include occurrences starting at or after this
     * @param to     ISO datetime; include occurrences starting before this
     */
    @Get("{teamId}/meetings")
    @Tags("Team Meetings")
    @SuccessResponse(200)
    @Security("oidc")
    async getTeamMeetings(
        @Path() teamId: string,
        @Query() from?: Date,
        @Query() to?: Date,
    ): Promise<APITeamMeetingResponse[]> {
        const filter: Record<string, unknown> = { teamPk: teamId };
        if (from || to) {
            const range: Record<string, Date> = {};
            if (from) range.$gte = from;
            if (to) range.$lt = to;
            filter.start = range;
        }

        const meetings = await TeamMeeting
            .find(filter)
            .sort({ start: 1 })
            .lean()
            .exec();

        /* `recurring` is derived, never stored: a series is recurring when more
           than one occurrence shares its seriesId. The visible week may hold only
           one occurrence of a series, so the count is resolved across all of them. */
        const seriesIds = [...new Set(meetings.map((m) => m.seriesId))];
        const counts = await TeamMeeting.aggregate<{ _id: string; count: number }>([
            { $match: { seriesId: { $in: seriesIds } } },
            { $group: { _id: "$seriesId", count: { $sum: 1 } } },
        ]);
        const seriesSize = new Map(counts.map((c) => [c._id, c.count]));

        return meetings.map((m) => ({
            ...m,
            recurring: (seriesSize.get(m.seriesId) ?? 1) > 1,
        })) as any as APITeamMeetingResponse[];
    }

    /**
     * Creates a new meeting for the given team.
     * Requires the requesting user to be a Team Owner or hold the
     * `corp:meetingsmgmt` bindle for the team.
     *
     * @param teamId Authentik group PK of the team
     * @param body   Meeting details
     */
    @Post("{teamId}/meetings")
    @Tags("Team Meetings")
    @SuccessResponse(201)
    @Security("bindles", ["corp:meetingsmgmt"])
    async createTeamMeeting(
        @Request() req: express.Request,
        @Path() teamId: string,
        @Body() body: APITeamMeetingCreateRequest,
    ): Promise<APITeamMeetingResponse[]> {
        const start = new Date(body.start);
        const end = new Date(body.end);
        if (start.getTime() >= end.getTime()) {
            throw new CustomValidationError(400, "Meeting start time must be before end time");
        }

        let occurrences: Array<{ start: Date; end: Date }>;
        if (body.recurring) {
            /* Recurring meetings repeat weekly through the team's end date */
            const teamInfo = await this.authentikClient.getGroupInfo(teamId);
            const teamEndDate = teamInfo.attributes.teamEndDate;
            if (!teamEndDate) {
                throw new CustomValidationError(400, "Team has no end date set; cannot create a recurring meeting");
            }
            const until = new Date(`${teamEndDate}T23:59:59`);
            if (until.getTime() < start.getTime()) {
                throw new CustomValidationError(400, "Team end date is before the meeting start");
            }
            occurrences = generateWeeklyOccurrences(start, end, until);
        } else {
            occurrences = [{ start, end }];
        }

        const seriesId = randomUUID();
        const docs = occurrences.map((occurrence) => ({
            teamPk:      teamId,
            seriesId,
            name:        body.name,
            description: body.description ?? "",
            start:       occurrence.start,
            end:         occurrence.end,
            createdBy:   req.session.authorizedUser!.pk,
        }));

        const created = await TeamMeeting.insertMany(docs);

        /* Derived for the response only — every doc just created shares one series. */
        const recurring = created.length > 1;

        this.setStatus(201);
        return created.map((doc) => ({ ...doc.toObject(), recurring }) as APITeamMeetingResponse);
    }

    /**
     * Updates an existing team meeting. Only the fields provided in the
     * request body are changed.
     * Requires the requesting user to be a Team Owner or hold the
     * `corp:meetingsmgmt` bindle for the team.
     *
     * @param teamId    Authentik group PK of the team
     * @param meetingId MongoDB ObjectId of the meeting
     * @param body      Fields to update
     */
    @Patch("{teamId}/meetings/{meetingId}")
    @Tags("Team Meetings")
    @SuccessResponse(200)
    @Security("bindles", ["corp:meetingsmgmt"])
    async updateTeamMeeting(
        @Path() teamId: string,
        @Path() meetingId: string,
        @Body() body: APITeamMeetingUpdateRequest,
    ): Promise<APITeamMeetingResponse[]> {
        const target = await TeamMeeting.findOne({ _id: meetingId, teamPk: teamId });
        if (!target) throw new CustomValidationError(404, "Meeting not found");

        const newStart = body.start !== undefined ? new Date(body.start) : undefined;
        const newEnd   = body.end   !== undefined ? new Date(body.end)   : undefined;

        const effectiveStart = newStart ?? target.start;
        const effectiveEnd   = newEnd   ?? target.end;
        if (effectiveStart.getTime() >= effectiveEnd.getTime()) {
            throw new CustomValidationError(400, "Meeting start time must be before end time");
        }

        /* A time edit moves/resizes the clicked occurrence; for "following"/"all"
           the same start-of-day shift and duration are applied to each sibling so
           they keep their own dates. Omitted fields fall back to the target's
           current values, so a start-only or end-only edit still resizes correctly. */
        const targetNewStart = newStart ?? target.start;
        const targetNewEnd   = newEnd   ?? target.end;
        const startDelta = targetNewStart.getTime() - target.start.getTime();
        const duration   = targetNewEnd.getTime() - targetNewStart.getTime();
        const timeChanged = newStart !== undefined || newEnd !== undefined;

        /* Editing never reassigns seriesId. A "this"-scope edit therefore keeps the
           occurrence linked to its series (standard calendar behavior: it can still
           be swept by a later "following"/"all" edit) rather than detaching it. */
        const scope: MeetingScope = body.scope ?? "this";
        const filter: Record<string, unknown> = { seriesId: target.seriesId, teamPk: teamId };
        if (scope === "this") {
            filter._id = target._id;
        } else if (scope === "following") {
            filter.start = { $gte: target.start };
        }

        const occurrences = await TeamMeeting.find(filter);
        for (const occurrence of occurrences) {
            if (body.name        !== undefined) occurrence.name        = body.name;
            if (body.description !== undefined) occurrence.description = body.description;
            if (timeChanged) {
                occurrence.start = new Date(occurrence.start.getTime() + startDelta);
                occurrence.end   = new Date(occurrence.start.getTime() + duration);
            }
            await occurrence.save();
        }

        /* Series membership is unchanged by an edit, so a single count suffices. */
        const recurring = await TeamMeeting.countDocuments({ seriesId: target.seriesId }) > 1;
        return occurrences.map((occurrence) => ({ ...occurrence.toObject(), recurring }) as APITeamMeetingResponse);
    }

    /**
     * Permanently deletes a team meeting.
     * Requires the requesting user to be a Team Owner or hold the
     * `corp:meetingsmgmt` bindle for the team.
     *
     * @param teamId    Authentik group PK of the team
     * @param meetingId MongoDB ObjectId of the meeting
     * @param scope     Which occurrences to remove (defaults to "this")
     */
    @Delete("{teamId}/meetings/{meetingId}")
    @Tags("Team Meetings")
    @SuccessResponse(204)
    @Security("bindles", ["corp:meetingsmgmt"])
    async deleteTeamMeeting(
        @Path() teamId: string,
        @Path() meetingId: string,
        @Query() scope?: MeetingScope,
    ): Promise<void> {
        const target = await TeamMeeting.findOne({ _id: meetingId, teamPk: teamId });
        if (!target) throw new CustomValidationError(404, "Meeting not found");

        const effectiveScope: MeetingScope = scope ?? "this";
        const filter: Record<string, unknown> = { seriesId: target.seriesId, teamPk: teamId };
        if (effectiveScope === "this") {
            filter._id = target._id;
        } else if (effectiveScope === "following") {
            filter.start = { $gte: target.start };
        }

        await TeamMeeting.deleteMany(filter);
    }
}
