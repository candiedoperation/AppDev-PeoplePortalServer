import { Document, Schema, model } from "mongoose";

export enum ApplicationStage {
  NEW_APPLICATIONS = 'New Applications',
  REJECTED = 'Rejected',
  INTERVIEW = 'Interview',
  REJECTED_AFTER_INTERVIEW = 'Rejected After Interview',
  HIRED = 'Hired'
}

export interface IApplication extends Document {
  applicantId: Schema.Types.ObjectId;
  subteamPk: string;
  roles: string[]; // Changed from single role to array of roles
  stage: ApplicationStage;
  responses?: Map<string, string>; // question -> answer (aggregated from all roles)
  appliedAt: Date;
  stageHistory: Array<{
    stage: ApplicationStage;
    changedAt: Date;
    changedBy?: string;
  }>;
}

const ApplicationSchema = new Schema<IApplication>({
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
  subteamPk: { type: String, required: true, index: true },
  roles: [{ type: String, required: true }], // Array of roles within the subteam
  stage: {
    type: String,
    enum: Object.values(ApplicationStage),
    default: ApplicationStage.NEW_APPLICATIONS,
    required: true,
    index: true
  },
  responses: {
    type: Map,
    of: String,
    required: false
  },
  appliedAt: { type: Date, default: Date.now },
  stageHistory: [{
    stage: {
      type: String,
      enum: Object.values(ApplicationStage),
      required: true
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String }
  }]
}, { timestamps: true });

// Updated indexes
ApplicationSchema.index({ subteamPk: 1, stage: 1 });
ApplicationSchema.index({ subteamPk: 1, roles: 1 }); // Supports queries on specific roles

export const Application = model<IApplication>('Application', ApplicationSchema);
