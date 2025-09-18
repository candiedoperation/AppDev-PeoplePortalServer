import { Document, model, Schema } from "mongoose";

export interface ITeamRecruitingStatus extends Document {
  teamPk: string;
  isRecruiting: boolean;
  recruitingSubteamPks: string[];
}

const TeamRecruitingStatusSchema = new Schema<ITeamRecruitingStatus>({
  teamPk: { type: String, required: true, unique: true, index: true },
  isRecruiting: { type: Boolean, required: true, default: false },
  recruitingSubteamPks: [{ type: String, required: true }]
}, { timestamps: true });

export const TeamRecruitingStatus = model<ITeamRecruitingStatus>('TeamRecruitingStatus', TeamRecruitingStatusSchema);
