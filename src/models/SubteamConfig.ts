import { Schema, model, Document } from 'mongoose';

export interface ISubteamConfig extends Document {
  subteamPk: string;
  isRecruiting: boolean;
  roles: string[];
  roleSpecificQuestions: Map<string, string[]>; // role -> array of questions
}

const SubteamConfigSchema = new Schema<ISubteamConfig>({
  subteamPk: { type: String, required: true, unique: true, index: true },
  isRecruiting: { type: Boolean, required: true, default: false },
  roles: [{ type: String, required: true }],
  roleSpecificQuestions: {
    type: Map,
    of: [String], // Array of questions for each role
    default: new Map()
  }
}, { timestamps: true });

export const SubteamConfig = model<ISubteamConfig>('SubteamConfig', SubteamConfigSchema);
