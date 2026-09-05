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

import mongoose from "mongoose";
import {
    Controller,
    Get,
    Path,
    Query,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import { TeamMeeting } from "../models/TeamMeeting";
import { MeetingAttendance, AttendanceRole } from "../models/MeetingAttendance";
import { MeetingSubteamAttendance } from "../models/MeetingSubteamAttendance";
import { TeamRecruitingStatus } from "../models/TeamRecruitingStatus";
import { SubteamConfig } from "../models/SubteamConfig";
import { Application, ApplicationStage } from "../models/Application";
import { Applicant } from "../models/Applicant";
import { AuthentikClient } from "../clients/AuthentikClient";
import {
    AuthentikClientError,
    AuthentikClientErrorType,
    GetGroupInfoRequestOptions,
    GetGroupInfoResponse,
    PaginationDefinition,
    TeamAttributeDefinition,
    TeamInformationBrief,
    UserInformationBrief,
} from "../clients/AuthentikClient/models";
import { CustomValidationError } from "../utils/errors";

/* ------------------------------------------------------------------------- */
/* Response DTOs (concrete types; tsoa builds the OpenAPI spec from these)   */
/* ------------------------------------------------------------------------- */

export interface APIHorizonsHealthResponse {
    status: "ok";
    serverTime: Date;
}

export interface APIHorizonsMetaResponse {
    service: "horizons";
    serverTime: Date;
    databaseConnected: boolean;
    counts: {
        meetings: number;
        attendanceRecords: number;
        subteamInvites: number;
        applications: number;
        applicants: number;
        recruitingTeams: number;
    };
}

export interface APIHorizonsUserSummary {
    pk: number;                       // Number(UserInformationBrief.pk)
    username: string;
    name: string;
    email: string;
    active: boolean;
    memberSince: Date;
    alumniAccount: boolean;
    major: string | null;
    expectedGrad: Date | null;
    /** Authentik group PK -> role title */
    roles: Record<string, string>;
}

export interface APIHorizonsUsersResponse {
    pagination: PaginationDefinition; // Authentik-native page pagination
    users: APIHorizonsUserSummary[];
}

export interface APIHorizonsUserGroupMembership {
    pk: string;
    name: string;
    friendlyName: string | null;
    teamType: string | null;
    roleTitle: string | null;
}

export interface APIHorizonsUserDetailResponse extends APIHorizonsUserSummary {
    lastLogin: Date | null;
    isSuperuser: boolean;
    groups: APIHorizonsUserGroupMembership[]; // from UserInformationDetail.groupsInfo
}

export interface APIHorizonsTeamsResponse {
    teams: TeamInformationBrief[];    // TeamAttributeDefinition + { parent, name, pk }
    nextCursor?: string;              // opaque base64 cursor, pass back verbatim
}

export interface APIHorizonsSubteamSummary {
    pk: string;
    name: string;
    friendlyName: string | null;
    flaggedForDeletion: boolean;
    memberCount: number | null;       // null when includeMembers=false
    members: APIHorizonsRosterMember[] | null;
}

export interface APIHorizonsTeamDetailResponse {
    pk: string;
    name: string;
    parentPk: string | null;
    attributes: TeamAttributeDefinition;
    members: APIHorizonsRosterMember[] | null; // direct (non-subteam) members
    subteams: APIHorizonsSubteamSummary[];
}

export interface APIHorizonsRosterMember {
    pk: number;
    username: string;
    name: string;
    email: string;
    roleTitle: string | null;
    /** Subteams (within this team) the member belongs to */
    subteams: { pk: string; name: string }[];
}

export interface APIHorizonsTeamRosterResponse {
    teamPk: string;
    teamName: string;
    memberCount: number;
    members: APIHorizonsRosterMember[];
}

export interface APIHorizonsMeeting {
    id: string;                       // TeamMeeting _id.toString()
    teamPk: string;
    seriesId: string;
    name: string;
    description: string;
    start: Date;
    end: Date;
    createdBy: number;
    visibleToAll: boolean;
    isRecurring: boolean;             // derived: occurrenceCount > 1
    occurrenceCount: number;          // docs sharing this seriesId
    createdAt: Date;
    updatedAt: Date;
}

export interface APIHorizonsMeetingsResponse {
    total: number;                    // countDocuments for the filter
    limit: number;
    offset: number;
    meetings: APIHorizonsMeeting[];
}

export interface APIHorizonsAttendanceRecord {
    meetingId: string;
    teamPk: string;
    seriesId: string;
    userPk: number;
    role: AttendanceRole;             // "required" | "optional"
    present: boolean;
    markedBy: number | null;
    markedAt: Date | null;
}

export interface APIHorizonsSubteamInvite {
    meetingId: string;
    teamPk: string;
    subteamPk: string;
    role: AttendanceRole;
}

export interface APIHorizonsMeetingAttendanceResponse {
    meetingId: string;
    teamPk: string;
    start: Date;
    records: APIHorizonsAttendanceRecord[];
    subteamInvites: APIHorizonsSubteamInvite[];
}

export interface APIHorizonsAttendanceListResponse {
    total: number;
    limit: number;
    offset: number;
    records: APIHorizonsAttendanceRecord[];
}

export interface APIHorizonsUserAttendanceStat {
    userPk: number;
    invited: number;                  // materialized rows only; see caveat on the endpoint
    present: number;
    requiredInvited: number;
    requiredPresent: number;
    /** present / invited, 0 when invited is 0 */
    attendanceRate: number;
}

export interface APIHorizonsTeamAttendanceSummaryResponse {
    teamPk: string;
    from: Date | null;
    to: Date | null;
    totalMeetings: number;
    subteamInviteCount: number;       // materialization caveat context
    users: APIHorizonsUserAttendanceStat[];
}

export interface APIHorizonsUserTeamAttendanceStat {
    teamPk: string;
    teamName: string | null;          // null if team no longer resolvable
    invited: number;
    present: number;
    attendanceRate: number;
}

export interface APIHorizonsUserAttendanceSummaryResponse {
    userPk: number;
    from: Date | null;
    to: Date | null;
    teams: APIHorizonsUserTeamAttendanceStat[];
}

export interface APIHorizonsRecruitingSubteam {
    subteamPk: string;
    isRecruiting: boolean;
    roles: string[];                  // SubteamConfig.roles; question text NOT included
}

export interface APIHorizonsTeamRecruitingStatus {
    teamPk: string;
    isRecruiting: boolean;
    recruitingSubteams: APIHorizonsRecruitingSubteam[];
}

export interface APIHorizonsRecruitingStatusResponse {
    teams: APIHorizonsTeamRecruitingStatus[];
}

export interface APIHorizonsFunnelEntry {
    teamPk: string;
    /** Complete map: every ApplicationStage key present, 0 when empty */
    stages: Record<ApplicationStage, number>;
    total: number;
    avgStars: number | null;          // null when no applications
}

export interface APIHorizonsFunnelResponse {
    teams: APIHorizonsFunnelEntry[];
}

/**
 * Read-only analytics API for "AppDev Horizons", an external service-to-service
 * consumer. Every endpoint (except the public liveness probe) is protected by
 * the sessionless `horizons` static API key scheme: no cookies, no OIDC.
 */
@Route("/api/horizons")
export class HorizonsController extends Controller {
    private static readonly TAG = "HorizonsController";

    /**
     * Authentik group PKs are UUIDs. Anything else (e.g. a path-traversal
     * payload like `../tokens/x`) must never reach the IdP admin API.
     */
    private static readonly GROUP_PK_PATTERN =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    private readonly authentikClient: AuthentikClient;

    /**
     * Per-request memo of Authentik group lookups (tsoa constructs a fresh
     * controller per request), keyed by group PK + request options.
     */
    private readonly groupInfoCache = new Map<string, Promise<GetGroupInfoResponse>>();

    constructor() {
        super();
        this.authentikClient = new AuthentikClient();
    }

    /* --------------------------------------------------------------------- */
    /* 1. Health & 2. Meta                                                    */
    /* --------------------------------------------------------------------- */

    /**
     * Public liveness probe so uptime monitors need no API key.
     * Touches no secrets and no database.
     */
    @Get("health")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    async getHealth(): Promise<APIHorizonsHealthResponse> {
        return { status: "ok", serverTime: new Date() };
    }

    /**
     * Service metadata: server time, mongoose connection state, and cheap
     * estimated document counts for the analytics-relevant collections.
     */
    @Get("meta")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getMeta(): Promise<APIHorizonsMetaResponse> {
        const [meetings, attendanceRecords, subteamInvites, applications, applicants, recruitingTeams] =
            await Promise.all([
                TeamMeeting.estimatedDocumentCount(),
                MeetingAttendance.estimatedDocumentCount(),
                MeetingSubteamAttendance.estimatedDocumentCount(),
                Application.estimatedDocumentCount(),
                Applicant.estimatedDocumentCount(),
                TeamRecruitingStatus.estimatedDocumentCount(),
            ]);

        return {
            service: "horizons",
            serverTime: new Date(),
            databaseConnected: mongoose.connection.readyState === 1,
            counts: { meetings, attendanceRecords, subteamInvites, applications, applicants, recruitingTeams },
        };
    }

    /* --------------------------------------------------------------------- */
    /* 3-5. Users                                                             */
    /* --------------------------------------------------------------------- */

    /**
     * Paginated directory of onboarded users (Authentik-native page
     * pagination). Profile fields only; avatar URLs are neither signed nor
     * returned.
     *
     * @param page   Authentik page number (1-based)
     * @param search Free-text search over username/name/email
     * @isInt page `page` must be an integer
     * @minimum page 1 `page` must be at least 1
     */
    @Get("users")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getUsers(
        @Query() page?: number,
        @Query() search?: string,
    ): Promise<APIHorizonsUsersResponse> {
        const userList = await this.authentikClient.getUserList({
            ...(page !== undefined && { page }),
            ...(search !== undefined && { search }),
        });
        return {
            pagination: userList.pagination,
            users: userList.users.map((user) => HorizonsController.toUserSummary(user)),
        };
    }

    /**
     * Single user detail including group memberships (from Authentik
     * `groupsInfo`) with per-team role titles.
     *
     * @param userPk Authentik user PK
     */
    @Get("users/{userPk}")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getUserDetail(@Path() userPk: number): Promise<APIHorizonsUserDetailResponse> {
        try {
            const user = await this.authentikClient.getUserInfo(userPk);
            return {
                ...HorizonsController.toUserSummary(user),
                lastLogin: user.last_login ?? null,
                isSuperuser: user.is_superuser,
                groups: (user.groupsInfo ?? []).map((group) => ({
                    pk: group.pk,
                    name: group.name,
                    friendlyName: group.attributes?.friendlyName ?? null,
                    teamType: group.attributes?.teamType ?? null,
                    roleTitle: user.attributes?.roles?.[group.pk] ?? null,
                })),
            };
        } catch (e) {
            if (e instanceof AuthentikClientError && e.code === AuthentikClientErrorType.USER_NOT_FOUND)
                throw new CustomValidationError(404, "User not found");

            console.error(HorizonsController.TAG, "User Detail Request Failed:", e);
            throw e;
        }
    }

    /**
     * Per-team attendance aggregates for one user over an optional window.
     *
     * Caveat: subteam invitees have no individual MeetingAttendance row until
     * first check-in or manager mark, so `invited` counts materialized rows
     * only.
     *
     * @param userPk Authentik user PK
     * @param from   ISO datetime; include meetings starting at or after this
     * @param to     ISO datetime; include meetings starting before this
     */
    @Get("users/{userPk}/attendance/summary")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getUserAttendanceSummary(
        @Path() userPk: number,
        @Query() from?: Date,
        @Query() to?: Date,
    ): Promise<APIHorizonsUserAttendanceSummaryResponse> {
        HorizonsController.assertValidWindow(from, to);

        const rows = await MeetingAttendance.find({ userPk }).lean();
        const meetingIds = [...new Set(rows.map((row) => row.meetingId))];
        const meetings = meetingIds.length > 0
            ? await TeamMeeting.find({ _id: { $in: meetingIds } }).select("start teamPk").lean()
            : [];
        const meetingById = new Map(meetings.map((meeting) => [String(meeting._id), meeting]));

        /* Aggregate per team, dropping rows outside the window (or whose meeting is gone) */
        const perTeam = new Map<string, { invited: number; present: number }>();
        for (const row of rows) {
            const meeting = meetingById.get(row.meetingId);
            if (!meeting) continue;

            const start = new Date(meeting.start).getTime();
            if (from && start < from.getTime()) continue;
            if (to && start >= to.getTime()) continue;

            const stat = perTeam.get(meeting.teamPk) ?? { invited: 0, present: 0 };
            stat.invited += 1;
            if (row.present) stat.present += 1;
            perTeam.set(meeting.teamPk, stat);
        }

        /* Best-effort team name enrichment; teams may have been deleted since */
        const teams = await Promise.all([...perTeam.entries()].map(async ([teamPk, stat]) => {
            let teamName: string | null = null;
            try {
                const info = await this.getGroupInfoCached(teamPk, {
                    includeUsers: false,
                    disableSubteamMemberPopulate: true,
                });
                teamName = info.name;
            } catch (e) {
                if (!(e instanceof AuthentikClientError && e.code === AuthentikClientErrorType.GROUP_NOT_FOUND))
                    throw e;
            }

            return {
                teamPk,
                teamName,
                invited: stat.invited,
                present: stat.present,
                attendanceRate: stat.invited > 0 ? stat.present / stat.invited : 0,
            };
        }));

        return { userPk, from: from ?? null, to: to ?? null, teams };
    }

    /* --------------------------------------------------------------------- */
    /* 6-9. Teams & Recruiting (single team)                                  */
    /* --------------------------------------------------------------------- */

    /**
     * Cursor-paginated team list. The cursor is opaque; pass `nextCursor`
     * back verbatim to fetch the next slice.
     *
     * @param scope  "root" for top-level teams (default) or "subteams"
     * @param search Free-text search over team names
     * @param limit  Page size
     * @param cursor Opaque cursor from a previous response
     * @isInt limit `limit` must be an integer
     * @minimum limit 1 `limit` must be at least 1
     */
    @Get("teams")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getTeams(
        @Query() scope?: "root" | "subteams",
        @Query() search?: string,
        @Query() limit: number = 20,
        @Query() cursor?: string,
    ): Promise<APIHorizonsTeamsResponse> {
        const teamsList = await this.authentikClient.getGroupsList({
            subgroupsOnly: scope === "subteams",
            includeUsers: false,
            limit,
            ...(search !== undefined && { search }),
            ...(cursor !== undefined && { cursor }),
        });

        return {
            teams: teamsList.teams,
            ...(teamsList.nextCursor !== undefined && { nextCursor: teamsList.nextCursor }),
        };
    }

    /**
     * Team detail: attributes, parent, and one level of subteams. Member
     * lists (and subteam member counts) are included unless
     * `includeMembers=false`.
     *
     * @param teamId         Authentik group PK of the team
     * @param includeMembers Include per-team and per-subteam member lists
     */
    @Get("teams/{teamId}")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getTeamDetail(
        @Path() teamId: string,
        @Query() includeMembers: boolean = true,
    ): Promise<APIHorizonsTeamDetailResponse> {
        const info = await this.getGroupInfoOr404(teamId, {
            includeParentInfo: true,
            includeChildren: true,
            includeUsers: includeMembers,
            disableSubteamMemberPopulate: !includeMembers,
        });

        return {
            pk: info.pk,
            name: info.name,
            parentPk: info.parentPk ?? null,
            attributes: info.attributes,
            members: includeMembers
                ? (info.users ?? []).map((user) =>
                    HorizonsController.toRosterMember(user, [info.pk], []))
                : null,
            subteams: (info.subteams ?? []).map((subteam) => ({
                pk: subteam.pk,
                name: subteam.name,
                friendlyName: subteam.attributes?.friendlyName ?? null,
                flaggedForDeletion: subteam.attributes?.flaggedForDeletion ?? false,
                memberCount: includeMembers ? (subteam.users?.length ?? 0) : null,
                members: includeMembers
                    ? (subteam.users ?? []).map((user) =>
                        HorizonsController.toRosterMember(user, [info.pk, subteam.pk], [{ pk: subteam.pk, name: subteam.name }]))
                    : null,
            })),
        };
    }

    /**
     * Flattened, de-duplicated membership for one team: the team's direct
     * users plus everyone in its subteams (skipping subteams flagged for
     * deletion), each with a role title and their subteam assignments.
     *
     * @param teamId Authentik group PK of the team
     */
    @Get("teams/{teamId}/roster")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getTeamRoster(@Path() teamId: string): Promise<APIHorizonsTeamRosterResponse> {
        const info = await this.getGroupInfoOr404(teamId, {
            includeChildren: true,
            includeUsers: true,
        });

        const members = new Map<number, APIHorizonsRosterMember>();
        for (const user of info.users ?? []) {
            members.set(Number(user.pk), HorizonsController.toRosterMember(user, [info.pk], []));
        }

        for (const subteam of info.subteams ?? []) {
            if (subteam.attributes?.flaggedForDeletion) continue;

            for (const user of subteam.users ?? []) {
                const pk = Number(user.pk);
                let member = members.get(pk);
                if (!member) {
                    member = HorizonsController.toRosterMember(user, [info.pk, subteam.pk], []);
                    members.set(pk, member);
                }

                if (!member.roleTitle)
                    member.roleTitle = user.attributes?.roles?.[subteam.pk] ?? null;

                member.subteams.push({ pk: subteam.pk, name: subteam.name });
            }
        }

        const roster = [...members.values()].sort((a, b) => a.name.localeCompare(b.name));
        return {
            teamPk: info.pk,
            teamName: info.name,
            memberCount: roster.length,
            members: roster,
        };
    }

    /**
     * Recruiting status for one team. A team with no TeamRecruitingStatus
     * document simply is not recruiting (normal state, not a 404).
     *
     * @param teamId Authentik group PK of the team
     */
    @Get("teams/{teamId}/recruiting")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getTeamRecruiting(@Path() teamId: string): Promise<APIHorizonsTeamRecruitingStatus> {
        const status = await TeamRecruitingStatus.findOne({ teamPk: teamId }).lean();
        if (!status)
            return { teamPk: teamId, isRecruiting: false, recruitingSubteams: [] };

        const [mapped] = await HorizonsController.attachSubteamConfigs([status]);
        return mapped ?? { teamPk: teamId, isRecruiting: false, recruitingSubteams: [] };
    }

    /* --------------------------------------------------------------------- */
    /* 10-13. Meetings & Attendance                                           */
    /* --------------------------------------------------------------------- */

    /**
     * Meetings across teams, filterable by team and start-time window
     * (`$gte from`, `$lt to`; a meeting starting exactly at `to` is
     * excluded). Includes derived recurrence info per occurrence.
     *
     * @param teamPk Authentik group PK to filter by
     * @param from   ISO datetime; include meetings starting at or after this
     * @param to     ISO datetime; include meetings starting before this
     * @param limit  Page size
     * @param offset Number of records to skip
     * @isInt limit `limit` must be an integer
     * @minimum limit 1 `limit` must be at least 1
     * @maximum limit 500 `limit` must be at most 500
     * @isInt offset `offset` must be an integer
     * @minimum offset 0 `offset` must be at least 0
     */
    @Get("meetings")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getMeetings(
        @Query() teamPk?: string,
        @Query() from?: Date,
        @Query() to?: Date,
        @Query() limit: number = 100,
        @Query() offset: number = 0,
    ): Promise<APIHorizonsMeetingsResponse> {
        HorizonsController.assertValidWindow(from, to);

        const filter: Record<string, unknown> = {};
        if (teamPk) filter.teamPk = teamPk;
        if (from || to) {
            const range: Record<string, Date> = {};
            if (from) range.$gte = from;
            if (to) range.$lt = to;
            filter.start = range;
        }

        const [total, meetings] = await Promise.all([
            TeamMeeting.countDocuments(filter),
            /* `_id` tiebreaker keeps equal-start orderings stable across offset pages */
            TeamMeeting.find(filter).sort({ start: 1, _id: 1 }).skip(offset).limit(limit).lean(),
        ]);

        /* Derive recurrence: how many occurrences share each seriesId */
        const seriesIds = [...new Set(meetings.map((meeting) => meeting.seriesId))];
        const seriesCounts = seriesIds.length > 0
            ? await TeamMeeting.aggregate<{ _id: string; count: number }>([
                { $match: { seriesId: { $in: seriesIds } } },
                { $group: { _id: "$seriesId", count: { $sum: 1 } } },
            ])
            : [];
        const seriesSize = new Map(seriesCounts.map((entry) => [entry._id, entry.count]));

        return {
            total,
            limit,
            offset,
            meetings: meetings.map((meeting) => ({
                id: String(meeting._id),
                teamPk: meeting.teamPk,
                seriesId: meeting.seriesId,
                name: meeting.name,
                description: meeting.description,
                start: meeting.start,
                end: meeting.end,
                createdBy: meeting.createdBy,
                visibleToAll: meeting.visibleToAll,
                isRecurring: (seriesSize.get(meeting.seriesId) ?? 1) > 1,
                occurrenceCount: seriesSize.get(meeting.seriesId) ?? 1,
                createdAt: meeting.createdAt,
                updatedAt: meeting.updatedAt,
            })),
        };
    }

    /**
     * One meeting's attendance: individual rows plus subteam invites (which
     * are stored by reference). Subteam invitees only gain an individual row
     * once materialized by a first check-in or manager mark.
     *
     * @param meetingId MongoDB ObjectId of the meeting occurrence
     */
    @Get("meetings/{meetingId}/attendance")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getMeetingAttendance(@Path() meetingId: string): Promise<APIHorizonsMeetingAttendanceResponse> {
        const meeting = mongoose.isValidObjectId(meetingId)
            ? await TeamMeeting.findById(meetingId).lean()
            : null;
        if (!meeting) throw new CustomValidationError(404, "Meeting not found");

        const [records, invites] = await Promise.all([
            MeetingAttendance.find({ meetingId }).lean(),
            MeetingSubteamAttendance.find({ meetingId }).lean(),
        ]);

        return {
            meetingId: String(meeting._id),
            teamPk: meeting.teamPk,
            start: meeting.start,
            records: records.map((record) => HorizonsController.toAttendanceRecord(record)),
            subteamInvites: invites.map((invite) => ({
                meetingId: invite.meetingId,
                teamPk: invite.teamPk,
                subteamPk: invite.subteamPk,
                role: invite.role,
            })),
        };
    }

    /**
     * Raw individual attendance records, filterable by team, user, and the
     * start-time window of the referenced meetings.
     *
     * @param teamPk Authentik group PK to filter by
     * @param userPk Authentik user PK to filter by
     * @param from   ISO datetime; include records of meetings starting at or after this
     * @param to     ISO datetime; include records of meetings starting before this
     * @param limit  Page size
     * @param offset Number of records to skip
     * @isInt userPk `userPk` must be an integer
     * @isInt limit `limit` must be an integer
     * @minimum limit 1 `limit` must be at least 1
     * @maximum limit 1000 `limit` must be at most 1000
     * @isInt offset `offset` must be an integer
     * @minimum offset 0 `offset` must be at least 0
     */
    @Get("attendance")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getAttendanceRecords(
        @Query() teamPk?: string,
        @Query() userPk?: number,
        @Query() from?: Date,
        @Query() to?: Date,
        @Query() limit: number = 200,
        @Query() offset: number = 0,
    ): Promise<APIHorizonsAttendanceListResponse> {
        HorizonsController.assertValidWindow(from, to);

        const filter: Record<string, unknown> = {};
        if (teamPk) filter.teamPk = teamPk;
        if (userPk !== undefined) filter.userPk = userPk;

        /* MeetingAttendance rows carry no meeting start time; resolve the
           window to a set of meeting ids first. */
        if (from || to) {
            const range: Record<string, Date> = {};
            if (from) range.$gte = from;
            if (to) range.$lt = to;

            const meetingFilter: Record<string, unknown> = { start: range };
            if (teamPk) meetingFilter.teamPk = teamPk;

            const meetingDocs = await TeamMeeting.find(meetingFilter).select("_id").lean();
            filter.meetingId = { $in: meetingDocs.map((doc) => String(doc._id)) };
        }

        const [total, records] = await Promise.all([
            MeetingAttendance.countDocuments(filter),
            MeetingAttendance.find(filter)
                .sort({ markedAt: -1, _id: -1 })
                .skip(offset)
                .limit(limit)
                .lean(),
        ]);

        return {
            total,
            limit,
            offset,
            records: records.map((record) => HorizonsController.toAttendanceRecord(record)),
        };
    }

    /**
     * Per-user attendance aggregates for one team over an optional window.
     *
     * Caveat: subteam invitees have no individual MeetingAttendance row until
     * first check-in or manager mark, so `invited` counts materialized rows
     * only. `subteamInviteCount` is exposed so consumers can detect this and
     * expand subteam membership themselves (via the team detail/roster
     * endpoints) when they need full denominators.
     *
     * @param teamId Authentik group PK of the team
     * @param from   ISO datetime; include meetings starting at or after this
     * @param to     ISO datetime; include meetings starting before this
     */
    @Get("teams/{teamId}/attendance/summary")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getTeamAttendanceSummary(
        @Path() teamId: string,
        @Query() from?: Date,
        @Query() to?: Date,
    ): Promise<APIHorizonsTeamAttendanceSummaryResponse> {
        HorizonsController.assertValidWindow(from, to);

        const meetingFilter: Record<string, unknown> = { teamPk: teamId };
        if (from || to) {
            const range: Record<string, Date> = {};
            if (from) range.$gte = from;
            if (to) range.$lt = to;
            meetingFilter.start = range;
        }

        const meetingDocs = await TeamMeeting.find(meetingFilter).select("_id").lean();
        const meetingIds = meetingDocs.map((doc) => String(doc._id));

        const [stats, subteamInviteCount] = await Promise.all([
            MeetingAttendance.aggregate<{
                _id: number;
                invited: number;
                present: number;
                requiredInvited: number;
                requiredPresent: number;
            }>([
                { $match: { meetingId: { $in: meetingIds } } },
                {
                    $group: {
                        _id: "$userPk",
                        invited: { $sum: 1 },
                        present: { $sum: { $cond: ["$present", 1, 0] } },
                        requiredInvited: { $sum: { $cond: [{ $eq: ["$role", "required"] }, 1, 0] } },
                        requiredPresent: { $sum: { $cond: [{ $and: ["$present", { $eq: ["$role", "required"] }] }, 1, 0] } },
                    },
                },
            ]),
            MeetingSubteamAttendance.countDocuments({ meetingId: { $in: meetingIds } }),
        ]);

        return {
            teamPk: teamId,
            from: from ?? null,
            to: to ?? null,
            totalMeetings: meetingIds.length,
            subteamInviteCount,
            users: stats.map((stat) => ({
                userPk: stat._id,
                invited: stat.invited,
                present: stat.present,
                requiredInvited: stat.requiredInvited,
                requiredPresent: stat.requiredPresent,
                attendanceRate: stat.invited > 0 ? stat.present / stat.invited : 0,
            })),
        };
    }

    /* --------------------------------------------------------------------- */
    /* 14-15. Recruiting (org-wide)                                           */
    /* --------------------------------------------------------------------- */

    /**
     * Recruiting status for all teams: TeamRecruitingStatus documents joined
     * with their SubteamConfig role lists.
     */
    @Get("recruiting/status")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getRecruitingStatus(): Promise<APIHorizonsRecruitingStatusResponse> {
        const statuses = await TeamRecruitingStatus.find().lean();
        return { teams: await HorizonsController.attachSubteamConfigs(statuses) };
    }

    /**
     * Application funnel aggregates: counts by stage per team, plus totals
     * and average star ratings. Contains zero applicant PII: no names,
     * emails, responses, or notes are ever projected.
     *
     * @param teamPk Authentik group PK to filter by
     */
    @Get("recruiting/funnel")
    @Tags("Horizons Analytics")
    @SuccessResponse(200)
    @Security("horizons")
    async getRecruitingFunnel(@Query() teamPk?: string): Promise<APIHorizonsFunnelResponse> {
        const buckets = await Application.aggregate<{
            _id: { teamPk: string; stage: ApplicationStage };
            count: number;
            avgStars: number | null;
        }>([
            ...(teamPk ? [{ $match: { teamPk } }] : []),
            {
                $group: {
                    _id: { teamPk: "$teamPk", stage: "$stage" },
                    count: { $sum: 1 },
                    avgStars: { $avg: "$stars" },
                },
            },
        ]);

        const byTeam = new Map<string, APIHorizonsFunnelEntry>();
        const starSums = new Map<string, number>();

        for (const bucket of buckets) {
            let entry = byTeam.get(bucket._id.teamPk);
            if (!entry) {
                entry = {
                    teamPk: bucket._id.teamPk,
                    stages: HorizonsController.emptyStageCounts(),
                    total: 0,
                    avgStars: null,
                };
                byTeam.set(bucket._id.teamPk, entry);
            }

            entry.stages[bucket._id.stage] = bucket.count;
            entry.total += bucket.count;
            starSums.set(bucket._id.teamPk, (starSums.get(bucket._id.teamPk) ?? 0) + (bucket.avgStars ?? 0) * bucket.count);
        }

        /* Weighted average stars across stages, rounded to 2 decimal places */
        for (const entry of byTeam.values()) {
            entry.avgStars = entry.total > 0
                ? Math.round(((starSums.get(entry.teamPk) ?? 0) / entry.total) * 100) / 100
                : null;
        }

        return { teams: [...byTeam.values()] };
    }

    /* --------------------------------------------------------------------- */
    /* Private helpers                                                        */
    /* --------------------------------------------------------------------- */

    private getGroupInfoCached(groupPk: string, options?: GetGroupInfoRequestOptions): Promise<GetGroupInfoResponse> {
        const key = `${groupPk}:${JSON.stringify(options ?? {})}`;
        let pending = this.groupInfoCache.get(key);
        if (!pending) {
            pending = this.authentikClient.getGroupInfo(groupPk, options);
            this.groupInfoCache.set(key, pending);
        }
        return pending;
    }

    private async getGroupInfoOr404(teamId: string, options?: GetGroupInfoRequestOptions): Promise<GetGroupInfoResponse> {
        if (!HorizonsController.GROUP_PK_PATTERN.test(teamId))
            throw new CustomValidationError(404, "Team not found");

        try {
            return await this.getGroupInfoCached(teamId, options);
        } catch (e) {
            if (e instanceof AuthentikClientError && e.code === AuthentikClientErrorType.GROUP_NOT_FOUND)
                throw new CustomValidationError(404, "Team not found");

            console.error(HorizonsController.TAG, "Group Info Request Failed:", e);
            throw e;
        }
    }

    /** 400 when both window bounds are present but inverted or equal. */
    private static assertValidWindow(from?: Date, to?: Date): void {
        if (from && to && from.getTime() >= to.getTime())
            throw new CustomValidationError(400, "`from` must be earlier than `to`");
    }

    private static toUserSummary(user: UserInformationBrief): APIHorizonsUserSummary {
        return {
            pk: Number(user.pk),
            username: user.username,
            name: user.name,
            email: user.email,
            active: user.active,
            memberSince: user.memberSince,
            alumniAccount: user.attributes?.alumniAccount ?? false,
            major: user.attributes?.major ?? null,
            expectedGrad: user.attributes?.expectedGrad ?? null,
            roles: user.attributes?.roles ?? {},
        };
    }

    /**
     * Maps an Authentik user into a roster member. Role titles live in the
     * user's `attributes.roles` keyed by group PK; `roleKeys` is checked in
     * order (team first, then subteam); first hit wins.
     */
    private static toRosterMember(
        user: UserInformationBrief,
        roleKeys: string[],
        subteams: { pk: string; name: string }[],
    ): APIHorizonsRosterMember {
        let roleTitle: string | null = null;
        for (const key of roleKeys) {
            const title = user.attributes?.roles?.[key];
            if (title) {
                roleTitle = title;
                break;
            }
        }

        return {
            pk: Number(user.pk),
            username: user.username,
            name: user.name,
            email: user.email,
            roleTitle,
            subteams: [...subteams],
        };
    }

    private static toAttendanceRecord(record: {
        meetingId: string;
        teamPk: string;
        seriesId: string;
        userPk: number;
        role: AttendanceRole;
        present: boolean;
        markedBy: number | null;
        markedAt: Date | null;
    }): APIHorizonsAttendanceRecord {
        return {
            meetingId: record.meetingId,
            teamPk: record.teamPk,
            seriesId: record.seriesId,
            userPk: record.userPk,
            role: record.role,
            present: record.present,
            markedBy: record.markedBy ?? null,
            markedAt: record.markedAt ?? null,
        };
    }

    /** Joins TeamRecruitingStatus docs with their SubteamConfig role lists. */
    private static async attachSubteamConfigs(
        statuses: { teamPk: string; isRecruiting: boolean; recruitingSubteamPks: string[] }[],
    ): Promise<APIHorizonsTeamRecruitingStatus[]> {
        const subteamPks = [...new Set(statuses.flatMap((status) => status.recruitingSubteamPks ?? []))];
        const configs = subteamPks.length > 0
            ? await SubteamConfig.find({ subteamPk: { $in: subteamPks } }).lean()
            : [];
        const configBySubteam = new Map(configs.map((config) => [config.subteamPk, config]));

        return statuses.map((status) => ({
            teamPk: status.teamPk,
            isRecruiting: status.isRecruiting,
            recruitingSubteams: (status.recruitingSubteamPks ?? []).map((subteamPk) => ({
                subteamPk,
                isRecruiting: configBySubteam.get(subteamPk)?.isRecruiting ?? false,
                roles: configBySubteam.get(subteamPk)?.roles ?? [],
            })),
        }));
    }

    private static emptyStageCounts(): Record<ApplicationStage, number> {
        const stages = {} as Record<ApplicationStage, number>;
        for (const stage of Object.values(ApplicationStage)) stages[stage] = 0;
        return stages;
    }
}
