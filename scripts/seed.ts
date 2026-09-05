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

/**
 * Seeds local development through the real HTTP API.
 *
 * Nothing here writes to Mongo or Authentik directly. Every record is created
 * by calling the same endpoint the UI calls, so the seed exercises real
 * validation, real authorization, and real side effects (Authentik groups,
 * Slack channels, scheduled reminders). It cannot drift from the schema,
 * because there is no second copy of the schema to drift from.
 *
 *   npm run seed
 *
 * AUTHENTICATION
 *
 * The API has no header-based auth: oidcAuthVerify reads the access token from
 * the server-side session only, which is populated by the OIDC redirect. So the
 * seed borrows a real browser session rather than inventing a way around the
 * auth layer.
 *
 *   1. Sign in at the UI as a superuser.
 *   2. Copy the session cookie value (DevTools > Application > Cookies).
 *   3. PEOPLEPORTAL_SEED_COOKIE="connect.sid=s%3A..." npm run seed
 *
 * Deliberately not automated: scripting the login means handling a password,
 * and a dev-only bypass route is an auth bypass one bad merge away from
 * production.
 */

import { ENVIRONMENT, isProduction, loadEnvironmentFiles } from "../src/config/environment";

loadEnvironmentFiles();

const BASE_URL = (process.env.PEOPLEPORTAL_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const COOKIE =
    process.env.PEOPLEPORTAL_SEED_COOKIE ??
    process.argv.find((a) => a.startsWith("--cookie="))?.slice("--cookie=".length);

const currentYear = new Date().getFullYear();
const iso = (daysFromNow: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
};

interface SeedSubteam { friendlyName: string; description: string }
interface SeedMeeting {
    name: string; description: string; startInDays: number; hour: number;
    recurring?: boolean; visibleToAll?: boolean;
}
interface SeedTeam {
    friendlyName: string;
    teamType: "PROJECT" | "BOOTCAMP" | "CORPORATE";
    seasonType: "FALL" | "SPRING";
    seasonYear: number;
    description: string;
    requestorRole: string;
    subteams: SeedSubteam[];
    meetings: SeedMeeting[];
}

const TEAMS: SeedTeam[] = [
    {
        friendlyName: "Web Dev", teamType: "PROJECT", seasonType: "FALL", seasonYear: currentYear,
        description: "Full-stack project team building internal tools.",
        requestorRole: "Tech Lead",
        subteams: [
            { friendlyName: "Frontend", description: "React and design system work." },
            { friendlyName: "Backend", description: "API, data model and integrations." },
        ],
        meetings: [
            { name: "Web Dev Standup", description: "Weekly standup.", startInDays: 3, hour: 18, recurring: true, visibleToAll: true },
            { name: "Leads Retro", description: "Leads only.", startInDays: 5, hour: 19, visibleToAll: false },
        ],
    },
    {
        friendlyName: "ML Bootcamp", teamType: "BOOTCAMP", seasonType: "FALL", seasonYear: currentYear,
        description: "Semester-long applied machine learning bootcamp.",
        requestorRole: "Bootcamp Director",
        subteams: [{ friendlyName: "Core", description: "Curriculum and instruction." }],
        meetings: [
            { name: "Bootcamp Session 1", description: "Kickoff and environment setup.", startInDays: 2, hour: 19, visibleToAll: true },
        ],
    },
    {
        /* Last season, so it lands in Archive Teams > Expired. */
        friendlyName: "Infrastructure", teamType: "PROJECT", seasonType: "SPRING", seasonYear: currentYear,
        description: "Platform and deployment work from the previous cycle.",
        requestorRole: "Tech Lead",
        subteams: [],
        meetings: [],
    },
];

const EVENTS = [
    {
        title: "Fall Symposium", description: "End-of-semester project showcase.",
        startTime: iso(12, 18), endTime: iso(12, 20), location: "Iribe Antonov Auditorium",
        scope: "public", marketingChannels: [] as string[],
    },
    {
        title: "Exec Sync", description: "Weekly executive board sync.",
        startTime: iso(4, 17), endTime: iso(4, 18), location: "Iribe 4105",
        scope: "exec", marketingChannels: [] as string[],
    },
    {
        title: "Member Social", description: "Open to all active members.",
        startTime: iso(7, 19), endTime: iso(7, 21), location: "Stamp Student Union",
        scope: "internal", marketingChannels: [] as string[],
    },
];

let created = 0;
let skipped = 0;

async function api(method: string, route: string, body?: unknown): Promise<any> {
    const response = await fetch(`${BASE_URL}${route}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(COOKIE ? { Cookie: COOKIE } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: any = undefined;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { /* not JSON */ }

    if (!response.ok) {
        const detail = parsed?.message ?? parsed?.error ?? text.slice(0, 200);
        const error = new Error(`${method} ${route} -> ${response.status}: ${detail}`);
        (error as any).status = response.status;
        throw error;
    }
    return parsed;
}

async function main(): Promise<void> {
    if (isProduction) {
        throw new Error("Refusing to seed with NODE_ENV=production.");
    }
    if (!/localhost|127\.0\.0\.1|host\.docker\.internal/.test(BASE_URL)) {
        throw new Error(
            `PEOPLEPORTAL_BASE_URL (${BASE_URL}) is not local. This creates real teams, ` +
            `Authentik groups and Slack channels; it will not run against a shared server.`
        );
    }
    if (!COOKIE) {
        throw new Error(
            "No session cookie. Sign in to the UI as a superuser, copy the session cookie, then:\n" +
            "  PEOPLEPORTAL_SEED_COOKIE=\"connect.sid=s%3A...\" npm run seed"
        );
    }

    /* Fail here, clearly, rather than with a wall of 401s. */
    let me: any;
    try {
        me = await api("GET", "/api/auth/userinfo");
    } catch (e) {
        throw new Error(
            `The session cookie was not accepted (${e instanceof Error ? e.message : String(e)}). ` +
            `Sign in again and copy a fresh one.`
        );
    }

    console.log(`environment : ${ENVIRONMENT}`);
    console.log(`server      : ${BASE_URL}`);
    console.log(`acting as   : ${me.name ?? me.username} (${me.isExecutive ? "executive" : "member"})\n`);

    if (!me.isExecutive) {
        console.warn("  This account is not an executive; team and event creation will likely be refused.\n");
    }

    const existing: any[] = (await api("GET", "/api/org/teams?limit=200").catch(() => ({ teams: [] }))).teams ?? [];
    const byFriendlyName = new Map<string, any>(
        existing.map((t: any) => [t.friendlyName ?? t.name, t])
    );

    for (const team of TEAMS) {
        let teamPk: string;
        const already = byFriendlyName.get(team.friendlyName);

        if (already) {
            teamPk = already.pk;
            skipped++;
            console.log(`  exists   team      ${team.friendlyName}`);
        } else {
            const result = await api("POST", "/api/org/teams/create", {
                friendlyName: team.friendlyName,
                teamType: team.teamType,
                seasonType: team.seasonType,
                seasonYear: team.seasonYear,
                description: team.description,
                teamEndDate: iso(120, 12).slice(0, 10),
                requestorRole: team.requestorRole,
            });
            teamPk = result?.pk ?? result?.team?.pk ?? result?.teamPk;
            created++;
            console.log(`  created  team      ${team.friendlyName.padEnd(20)} ${teamPk ?? "(pk not returned)"}`);
        }

        if (!teamPk) {
            console.warn(`           skipping children of ${team.friendlyName}: no pk available`);
            continue;
        }

        /* Existing subteams, so a re-run reports "exists" rather than relaying
           the server's generic "Failed to Create Team", which reads like a
           real failure when it only means the name is taken. */
        const existingSubteams: string[] = await api("GET", `/api/org/teams/${teamPk}`)
            .then((r: any) => (r?.subteams ?? []).map((st: any) => st.attributes?.friendlyName ?? st.friendlyName))
            .catch(() => []);
        const subteamNames = new Set(existingSubteams.filter(Boolean));

        for (const subteam of team.subteams) {
            if (subteamNames.has(subteam.friendlyName)) {
                skipped++;
                console.log(`  exists   subteam   ${subteam.friendlyName}`);
                continue;
            }
            try {
                await api("POST", `/api/org/teams/${teamPk}/subteam`, subteam);
                created++;
                console.log(`  created  subteam   ${subteam.friendlyName}`);
            } catch (e: any) {
                skipped++;
                console.log(`  skipped  subteam   ${subteam.friendlyName} (${e.message.split(": ").pop()})`);
            }
        }

        /* Existing meetings for this team, so a re-run does not duplicate them.
           A recurring meeting expands into a whole series server-side, so
           creating one twice is not a small mistake. */
        const existingMeetings: any[] = await api("GET", `/api/org/teams/${teamPk}/meetings`)
            .then((r: any) => (Array.isArray(r) ? r : r?.meetings ?? []))
            .catch(() => []);
        const meetingNames = new Set(existingMeetings.map((m: any) => m.name));

        for (const meeting of team.meetings) {
            if (meetingNames.has(meeting.name)) {
                skipped++;
                console.log(`  exists   meeting   ${meeting.name}`);
                continue;
            }
            try {
                await api("POST", `/api/org/teams/${teamPk}/meetings`, {
                    name: meeting.name,
                    description: meeting.description,
                    start: iso(meeting.startInDays, meeting.hour),
                    end: iso(meeting.startInDays, meeting.hour + 1),
                    recurring: meeting.recurring ?? false,
                    visibleToAll: meeting.visibleToAll ?? true,
                });
                created++;
                console.log(`  created  meeting   ${meeting.name}`);
            } catch (e: any) {
                skipped++;
                console.log(`  skipped  meeting   ${meeting.name} (${e.message.split(": ").pop()})`);
            }
        }
    }

    /* GET /api/events returns ids only, so titles need a lookup per event.
       Done once up front rather than per candidate. */
    const eventIds: string[] = await api("GET", "/api/events")
        .then((r: any) => r?.data ?? [])
        .catch(() => []);
    const eventTitles = new Set<string>();
    for (const id of eventIds) {
        const detail = await api("GET", `/api/events/${id}`).catch(() => null);
        const title = detail?.data?.eventName ?? detail?.eventName;
        if (title) eventTitles.add(title);
    }

    for (const event of EVENTS) {
        if (eventTitles.has(event.title)) {
            skipped++;
            console.log(`  exists   event     ${event.title}`);
            continue;
        }
        try {
            await api("POST", "/api/events", event);
            created++;
            console.log(`  created  event     ${event.title}`);
        } catch (e: any) {
            skipped++;
            console.log(`  skipped  event     ${event.title} (${e.message.split(": ").pop()})`);
        }
    }

    console.log(`\n${created} created, ${skipped} skipped.`);
}

main().catch((e: unknown) => {
    console.error(`\nSeed failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
});
