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

export interface ITeamMeeting extends Document {
    teamPk: string;
    name: string;
    description: string;
    /** 0 = Monday … 4 = Friday */
    day: number;
    /** Decimal hour, e.g. 9.5 = 9:30 AM */
    start: number;
    /** Decimal hour, e.g. 10.5 = 10:30 AM */
    end: number;
    /** Authentik user PK of the person who created the meeting */
    createdBy: number;
    createdAt: Date;
    updatedAt: Date;
}

const TeamMeetingSchema = new Schema<ITeamMeeting>({
    teamPk:      { type: String, required: true, index: true },
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    day:         { type: Number, required: true, min: 0, max: 4 },
    start:       { type: Number, required: true },
    end:         { type: Number, required: true },
    createdBy:   { type: Number, required: true },
}, { timestamps: true });

export const TeamMeeting = model<ITeamMeeting>('TeamMeeting', TeamMeetingSchema);
