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

import { createHash, randomBytes } from "crypto";
import * as express from "express";
import log from "loglevel";
import {
    Controller,
    Get,
    Path,
    Post,
    Produces,
    Query,
    Request,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import { AuthentikClient } from "../clients/AuthentikClient";
import { UserInformationDetail } from "../clients/AuthentikClient/models";
import { AuthorizedUser } from "../clients/OpenIdClient";
import { CalendarFeedToken, ICalendarFeedToken } from "../models/CalendarFeedToken";
import { CustomValidationError } from "../utils/errors";
import { buildICalendar, ICalEvent } from "../utils/ics";
import { APITeamMeetingResponse, MeetingsController } from "./MeetingsController";

/** Both spellings of a feed URL: plain HTTPS, and `webcal://` for one-click subscribe. */
export interface APICalendarFeedLinks {
    url: string;
    webcalUrl: string;
}

export interface APICalendarSubscriptionResponse {
    /** Feed of every meeting visible to the requester across all teams they belong to */
    allTeams: APICalendarFeedLinks;
    /** Feed restricted to the team passed as `teamId`; null when none was requested */
    team: APICalendarFeedLinks | null;
    /** When the current feed link was issued (first creation or last reset) */
    issuedAt: Date;
    /** Last time a calendar app fetched a feed with this link, if ever */
    lastAccessedAt: Date | null;
}

/** Minutes before each meeting the feed's built-in reminder fires */
const FEED_ALARM_MINUTES_BEFORE = 15;

/** Advisory re-fetch hint written into the feed (clients poll on their own schedule) */
const FEED_REFRESH_INTERVAL = "PT1H";

const FEED_FILENAME = "peopleportal.ics";

/**
 * Subscribable iCalendar feed of team meetings.
 *
 * Works like Canvas's calendar feed: each user gets a private, unguessable URL
 * they add to Google Calendar / Apple Calendar / Outlook as a *subscription*.
 * The calendar app then re-fetches the URL on its own schedule, so meetings
 * created, moved, or cancelled in People Portal show up (and notify) without
 * the user doing anything further. Because calendar apps fetch without a
 * session, the URL embeds a per-user token that stands in for the login.
 */
@Route("/api/calendar")
export class CalendarController extends Controller {
    private readonly authentikClient = new AuthentikClient();

    /* ----------------------------- helpers ----------------------------- */

    private static newToken(): string {
        return randomBytes(32).toString("base64url");
    }

    /**
     * Public origin used to build absolute feed URLs. Prefers the configured
     * base URL (what calendar apps must be able to reach) and falls back to the
     * origin of the current request.
     */
    private publicOrigin(req: express.Request): string {
        const configured = process.env.PEOPLEPORTAL_BASE_URL?.trim();
        if (configured) return configured.replace(/\/+$/, "");
        return `${req.protocol}://${req.get("host")}`;
    }

    private feedLinks(origin: string, token: string, teamId?: string): APICalendarFeedLinks {
        const scope = teamId ? `/teams/${encodeURIComponent(teamId)}` : "";
        const url = `${origin}/api/calendar/feed/${encodeURIComponent(token)}${scope}/${FEED_FILENAME}`;
        return { url, webcalUrl: url.replace(/^https?:\/\//i, "webcal://") };
    }

    private async getOrCreateToken(userPk: number): Promise<ICalendarFeedToken> {
        const existing = await CalendarFeedToken.findOne({ userPk }).lean<ICalendarFeedToken>();
        if (existing) return existing;
        try {
            const created = await CalendarFeedToken.create({ userPk, token: CalendarController.newToken() });
            return created.toObject() as ICalendarFeedToken;
        } catch (e: any) {
            /* Two first-time requests raced on the unique userPk index: use the winner's */
            if (e?.code === 11000) {
                const winner = await CalendarFeedToken.findOne({ userPk }).lean<ICalendarFeedToken>();
                if (winner) return winner;
            }
            throw e;
        }
    }

    private toSubscriptionResponse(
        req: express.Request,
        record: ICalendarFeedToken,
        teamId?: string,
    ): APICalendarSubscriptionResponse {
        const origin = this.publicOrigin(req);
        return {
            allTeams: this.feedLinks(origin, record.token),
            team: teamId ? this.feedLinks(origin, record.token, teamId) : null,
            issuedAt: record.updatedAt,
            lastAccessedAt: record.lastAccessedAt ?? null,
        };
    }

    /**
     * Exchanges a feed token for the user it represents, rebuilt from Authentik
     * into the same `AuthorizedUser` shape the session normally carries so the
     * meeting visibility rules run unchanged. Any failure is reported as a 404
     * so a guessed URL can't distinguish "no such token" from "disabled user".
     */
    private async resolveViewer(token: string): Promise<AuthorizedUser> {
        const record = await CalendarFeedToken.findOne({ token }).lean<ICalendarFeedToken>();
        if (!record) throw new CustomValidationError(404, "Calendar feed not found");

        let info: UserInformationDetail;
        try {
            info = await this.authentikClient.getUserInfo(record.userPk);
        } catch {
            throw new CustomValidationError(404, "Calendar feed not found");
        }
        if (!info.active) throw new CustomValidationError(404, "Calendar feed not found");

        /* Best-effort access stamp; `timestamps: false` keeps updatedAt == issuedAt */
        CalendarFeedToken
            .updateOne({ _id: record._id }, { $set: { lastAccessedAt: new Date() } }, { timestamps: false })
            .catch((e) => log.warn("CalendarController: failed to stamp feed access", e));

        return {
            sub: String(info.pk),
            email: info.email,
            name: info.name,
            pk: Number(info.pk),
            attributes: info.attributes,
            is_superuser: info.is_superuser,
            username: info.username,
            /* Direct group names, matching how the owner and bindle checks consume the OIDC `groups` claim */
            groups: (info.groupsInfo ?? []).map((g) => g.name),
        };
    }

    /**
     * Collects every meeting the viewer may see in each team, through the exact
     * same code path the calendar page uses (`MeetingsController.getTeamMeetings`),
     * and maps them to iCalendar events. A synthetic request carrying only the
     * session user is enough because that is all the visibility checks read.
     */
    private async collectEvents(
        origin: string,
        viewer: AuthorizedUser,
        teams: Array<{ pk: string; name: string }>,
        labelWithTeam: boolean,
    ): Promise<ICalEvent[]> {
        const meetingsController = new MeetingsController();
        const viewerRequest = { session: { authorizedUser: viewer } } as unknown as express.Request;
        const uidDomain = (() => {
            try { return new URL(origin).hostname || "peopleportal"; } catch { return "peopleportal"; }
        })();

        const events: ICalEvent[] = [];
        for (const team of teams) {
            let meetings: APITeamMeetingResponse[];
            try {
                meetings = await meetingsController.getTeamMeetings(viewerRequest, team.pk);
            } catch (e) {
                /* One unreachable team must not blank the whole feed */
                log.warn(`CalendarController: skipping team ${team.pk} in feed`, e);
                continue;
            }

            for (const meeting of meetings) {
                const id = String(meeting._id);
                const pageUrl = `${origin}/org/teams/${encodeURIComponent(meeting.teamPk)}/meetings`;
                const created = new Date(meeting.createdAt);
                const updated = new Date(meeting.updatedAt);

                const descriptionParts: string[] = [];
                if (meeting.description?.trim()) descriptionParts.push(meeting.description.trim());
                descriptionParts.push(
                    [
                        `Team: ${team.name}`,
                        meeting.recurring ? "Repeats weekly" : null,
                        `Open in People Portal: ${pageUrl}`,
                    ].filter(Boolean).join("\n"),
                );

                events.push({
                    uid: `${id}@${uidDomain}`,
                    start: new Date(meeting.start),
                    end: new Date(meeting.end),
                    summary: labelWithTeam ? `${meeting.name} [${team.name}]` : meeting.name,
                    description: descriptionParts.join("\n\n"),
                    url: pageUrl,
                    categories: [team.name],
                    created,
                    lastModified: updated,
                    /* Monotonic per occurrence: every edit moves updatedAt forward */
                    sequence: Math.max(0, Math.floor((updated.getTime() - created.getTime()) / 1000)),
                    alarmMinutesBefore: FEED_ALARM_MINUTES_BEFORE,
                });
            }
        }

        events.sort((a, b) => a.start.getTime() - b.start.getTime());
        return events;
    }

    /**
     * Writes the iCalendar document straight to the response (tsoa would JSON-
     * encode a returned string). Honors `If-None-Match` so calendar apps that
     * poll often get a cheap 304 when nothing changed.
     */
    private sendCalendar(req: express.Request, body: string): void {
        const res = (req as any).res as express.Response;
        const etag = `"${createHash("sha1").update(body).digest("hex")}"`;

        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", `inline; filename="${FEED_FILENAME}"`);
        res.setHeader("Cache-Control", "private, no-cache");
        res.setHeader("ETag", etag);

        if (req.headers["if-none-match"] === etag) {
            res.status(304).end();
            return;
        }
        res.status(200).send(body);
    }

    /* ----------------------------- routes ------------------------------ */

    /**
     * Returns the requesting user's private calendar feed links, creating the
     * underlying token on first use. Pass `teamId` to also receive links for a
     * feed limited to that one team. Treat these URLs like a password: anyone
     * holding one can read the meetings the user can see.
     *
     * @param teamId Authentik group PK of a team to build a single-team feed link for
     */
    @Get("subscription")
    @Tags("Calendar Feed")
    @SuccessResponse(200)
    @Security("oidc")
    async getSubscription(
        @Request() req: express.Request,
        @Query() teamId?: string,
    ): Promise<APICalendarSubscriptionResponse> {
        const record = await this.getOrCreateToken(req.session.authorizedUser!.pk);
        return this.toSubscriptionResponse(req, record, teamId);
    }

    /**
     * Replaces the requesting user's feed token. Every feed URL previously added
     * to a calendar app stops working immediately; the response carries the new
     * links. Use this if a link was shared or leaked.
     *
     * @param teamId Authentik group PK of a team to build a single-team feed link for
     */
    @Post("subscription/rotate")
    @Tags("Calendar Feed")
    @SuccessResponse(200)
    @Security("oidc")
    async rotateSubscription(
        @Request() req: express.Request,
        @Query() teamId?: string,
    ): Promise<APICalendarSubscriptionResponse> {
        const record = await CalendarFeedToken.findOneAndUpdate(
            { userPk: req.session.authorizedUser!.pk },
            { $set: { token: CalendarController.newToken(), lastAccessedAt: null } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean<ICalendarFeedToken>();
        return this.toSubscriptionResponse(req, record!, teamId);
    }

    /**
     * iCalendar feed of every meeting the token's owner can see across all the
     * teams they belong to. Public by design — the token in the path *is* the
     * credential — so calendar apps can poll it without a session.
     *
     * @param token Per-user feed token issued by `GET /api/calendar/subscription`
     */
    @Get("feed/{token}/peopleportal.ics")
    @Tags("Calendar Feed")
    @Produces("text/calendar")
    @SuccessResponse(200)
    async getAllTeamsFeed(
        @Request() req: express.Request,
        @Path() token: string,
    ): Promise<void> {
        const viewer = await this.resolveViewer(token);
        const origin = this.publicOrigin(req);

        const { teams } = await this.authentikClient.getRootTeamsForUsername(viewer.username);
        const teamRefs = teams.map((t) => ({ pk: t.pk, name: t.friendlyName || t.name }));
        const events = await this.collectEvents(origin, viewer, teamRefs, true);

        this.sendCalendar(req, buildICalendar({
            prodId: "-//People Portal//Team Meetings//EN",
            name: "People Portal Meetings",
            description: "Team meetings from People Portal. Updates automatically.",
            refreshInterval: FEED_REFRESH_INTERVAL,
            events,
        }));
    }

    /**
     * iCalendar feed limited to one team's meetings (those the token's owner can
     * see). Same token as the all-teams feed; handy for people who only want a
     * single team on their calendar.
     *
     * @param token  Per-user feed token issued by `GET /api/calendar/subscription`
     * @param teamId Authentik group PK of the team
     */
    @Get("feed/{token}/teams/{teamId}/peopleportal.ics")
    @Tags("Calendar Feed")
    @Produces("text/calendar")
    @SuccessResponse(200)
    async getTeamFeed(
        @Request() req: express.Request,
        @Path() token: string,
        @Path() teamId: string,
    ): Promise<void> {
        const viewer = await this.resolveViewer(token);
        const origin = this.publicOrigin(req);

        let teamName: string;
        try {
            const teamInfo = await this.authentikClient.getGroupInfo(teamId);
            teamName = teamInfo.attributes?.friendlyName || teamInfo.name;
        } catch {
            throw new CustomValidationError(404, "Team not found");
        }

        const events = await this.collectEvents(origin, viewer, [{ pk: teamId, name: teamName }], false);

        this.sendCalendar(req, buildICalendar({
            prodId: "-//People Portal//Team Meetings//EN",
            name: `${teamName} Meetings`,
            description: `${teamName} team meetings from People Portal. Updates automatically.`,
            refreshInterval: FEED_REFRESH_INTERVAL,
            events,
        }));
    }
}
