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

import { Document, Schema, model } from "mongoose";

export const MAX_RSVP_REASON_CHARS = 200;

export enum RsvpStatus {
    ACCEPT = 'Accept',
    DECLINE = 'Decline',
    CANCEL = 'Cancel',
}

export interface IRsvp extends Document {
  eventId: string; // Event id of corresponding event.
  status: RsvpStatus;
  userPk?: string; // Pk id of corresponding user if in App Dev.
  userInfo?: {           // Info of user. Should be used for
    firstName: string,   // public events if user does not
    lastName: string,    // have a PeoplePortal account.
    email: string
  };
  reason?: string; // Optional reason for attendance declination.
}

const rsvpSchema = new Schema<IRsvp>({
    eventId: {
        type: String,
        required: true,
        lowercase: true,
    },
    status: {
        type: String,
        enum: Object.values(RsvpStatus),
        required: true,
    },
    userPk: {
        type: String,
        required: false,
    },
    userInfo: {
        type: {
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
            email: { 
                type: String,
                required: true,
                match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
            },
        },
        required: false,
    },
    reason: {
        type: String,
        required: false,
        validate: {
            validator: (r: string) => r.length < MAX_RSVP_REASON_CHARS,
            message: `Reason must be less than ${MAX_RSVP_REASON_CHARS} characters.`,
        },
    },
}, {timestamps: true});


// Ensure either userPk or userInfo is given.
// rsvpSchema.pre("validate", function(this: HydratedDocument<IRsvp>, next: CallbackWithoutResultAndOptionalError) {
//   if (!this.userPk && !this.userInfo) {
//     this.invalidate("userPk", "You must provide either a userPk or a userInfo object.");
//     this.invalidate('userInfo', "You must provide either a userPk or a userInfo object.");
//   }
//   next();
// });


export const EventRsvp = model<IRsvp>('RSVP', rsvpSchema);     