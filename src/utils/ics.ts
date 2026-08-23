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
 * Minimal, dependency-free iCalendar (RFC 5545) serializer used by the
 * calendar feed. Only the subset needed for a published read-only feed of
 * timed events is implemented: VCALENDAR with VEVENTs and an optional
 * display VALARM per event.
 */

export interface ICalEvent {
    /** Globally unique, *stable* identifier — clients match updates on it */
    uid: string;
    start: Date;
    end: Date;
    summary: string;
    description?: string;
    /** Link clients show on the event (Apple/Google surface it as "URL") */
    url?: string;
    location?: string;
    categories?: string[];
    created?: Date;
    lastModified?: Date;
    /** Revision counter; bump whenever the event changes so clients re-import */
    sequence?: number;
    /** When set, attaches a display alarm that fires this many minutes before start */
    alarmMinutesBefore?: number;
}

export interface ICalCalendar {
    /** Shown as the calendar's name when subscribed (X-WR-CALNAME) */
    name: string;
    description?: string;
    /** e.g. "-//People Portal//Team Meetings//EN" */
    prodId: string;
    /**
     * ISO-8601 duration hinting how often clients should re-fetch the feed
     * (RFC 7986 REFRESH-INTERVAL plus the legacy X-PUBLISHED-TTL), e.g. "PT1H".
     * Most clients poll on their own schedule regardless; this is advisory.
     */
    refreshInterval?: string;
    events: ICalEvent[];
}

/** Formats a Date as an RFC 5545 UTC DATE-TIME (e.g. 20260823T140000Z). */
export function formatICalDateUTC(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
        + `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Escapes a value for an RFC 5545 TEXT property (backslash, semicolon, comma, newline). */
export function escapeICalText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line to at most 75 octets per physical line (RFC 5545 §3.1).
 * Continuation lines start with a single space. Splits on UTF-8 character
 * boundaries, never inside a multi-byte sequence.
 */
export function foldICalLine(line: string): string {
    const MAX_OCTETS = 75;
    const out: string[] = [];
    let current = "";
    let currentBytes = 0;
    /* Continuation lines carry a leading space, leaving 74 octets for content */
    let limit = MAX_OCTETS;

    for (const char of line) {
        const bytes = Buffer.byteLength(char, "utf8");
        if (currentBytes + bytes > limit) {
            out.push(current);
            current = " " + char;
            currentBytes = 1 + bytes;
            limit = MAX_OCTETS;
        } else {
            current += char;
            currentBytes += bytes;
        }
    }
    out.push(current);
    return out.join("\r\n");
}

/** Serializes a calendar to an iCalendar document with CRLF line endings. */
export function buildICalendar(calendar: ICalCalendar): string {
    const lines: string[] = [];
    const push = (name: string, value: string) => lines.push(foldICalLine(`${name}:${value}`));

    lines.push("BEGIN:VCALENDAR");
    push("VERSION", "2.0");
    push("PRODID", calendar.prodId);
    push("CALSCALE", "GREGORIAN");
    push("METHOD", "PUBLISH");
    push("X-WR-CALNAME", escapeICalText(calendar.name));
    push("NAME", escapeICalText(calendar.name));
    if (calendar.description) {
        push("X-WR-CALDESC", escapeICalText(calendar.description));
        push("DESCRIPTION", escapeICalText(calendar.description));
    }
    if (calendar.refreshInterval) {
        push("REFRESH-INTERVAL;VALUE=DURATION", calendar.refreshInterval);
        push("X-PUBLISHED-TTL", calendar.refreshInterval);
    }

    for (const event of calendar.events) {
        const stamp = event.lastModified ?? event.created ?? event.start;
        lines.push("BEGIN:VEVENT");
        push("UID", event.uid);
        push("DTSTAMP", formatICalDateUTC(stamp));
        push("DTSTART", formatICalDateUTC(event.start));
        push("DTEND", formatICalDateUTC(event.end));
        push("SUMMARY", escapeICalText(event.summary));
        if (event.description) push("DESCRIPTION", escapeICalText(event.description));
        if (event.location) push("LOCATION", escapeICalText(event.location));
        if (event.url) push("URL", event.url);
        if (event.categories && event.categories.length > 0) {
            push("CATEGORIES", event.categories.map(escapeICalText).join(","));
        }
        if (event.created) push("CREATED", formatICalDateUTC(event.created));
        if (event.lastModified) push("LAST-MODIFIED", formatICalDateUTC(event.lastModified));
        push("SEQUENCE", String(event.sequence ?? 0));
        push("STATUS", "CONFIRMED");
        push("TRANSP", "OPAQUE");
        if (event.alarmMinutesBefore !== undefined && event.alarmMinutesBefore > 0) {
            lines.push("BEGIN:VALARM");
            push("ACTION", "DISPLAY");
            push("DESCRIPTION", escapeICalText(event.summary));
            push("TRIGGER", `-PT${Math.floor(event.alarmMinutesBefore)}M`);
            lines.push("END:VALARM");
        }
        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
}
