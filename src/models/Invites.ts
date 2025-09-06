import { Schema, model, Document } from 'mongoose';

export interface IInvite extends Document {
  inviteName: string;
  inviteEmail: string;
  roleTitle: string;
  teamPk: string;
  inviterPk: number;
  expiresAt: Date;
}

const inviteSchema = new Schema<IInvite>({
    inviteName: {
        type: String,
        required: true
    },
  inviteEmail: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  roleTitle: {
    type: String,
    required: true,
  },
  teamPk: {
    type: String,
    required: true,
  },
  inviterPk: {
    type: Number,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  }
}, { timestamps: true });

export const Invite = model<IInvite>('Invite', inviteSchema);