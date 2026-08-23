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

import { Schema, model, Document } from 'mongoose';

/**
 * A per-user capability token that authenticates calendar-feed requests.
 *
 * Calendar apps (Google Calendar, Apple Calendar, Outlook) poll a subscribed
 * iCalendar URL on their own schedule without any session cookie, so the URL
 * itself must carry the credential — the same model Canvas uses for its
 * "Calendar Feed" links. One token per user; rotating it invalidates every
 * feed URL that user previously added to a calendar app.
 */
export interface ICalendarFeedToken extends Document {
    /** Authentik user PK the token acts on behalf of */
    userPk: number;
    /** 256-bit random, URL-safe secret embedded in the feed URL */
    token: string;
    /** Last time a calendar client fetched a feed with this token */
    lastAccessedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const CalendarFeedTokenSchema = new Schema<ICalendarFeedToken>({
    userPk:         { type: Number, required: true, unique: true, index: true },
    token:          { type: String, required: true, unique: true, index: true },
    lastAccessedAt: { type: Date, default: null },
}, { timestamps: true });

export const CalendarFeedToken = model<ICalendarFeedToken>('CalendarFeedToken', CalendarFeedTokenSchema);
