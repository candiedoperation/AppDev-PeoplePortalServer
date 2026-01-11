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
  teamPk: string;
  rolePreferences: string[]; // Ordered array: ["1st choice", "2nd choice", ...]
  stage: ApplicationStage;
  responses: Map<string, string>;
  appliedAt: Date;
  stageHistory: Array<{
    stage: ApplicationStage;
    changedAt: Date;
    changedBy?: string;
  }>;
  hiredRole?: string;
}

const ApplicationSchema = new Schema<IApplication>({
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
  teamPk: { type: String, required: true, index: true },
  rolePreferences: {
    type: [String],
    required: true,
    validate: {
      validator: (v: string[]) => v && v.length > 0,
      message: 'At least one role preference is required'
    }
  },
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
    required: true,
    default: new Map()
  },
  appliedAt: { type: Date, default: Date.now, required: true },
  stageHistory: [{
    stage: {
      type: String,
      enum: Object.values(ApplicationStage),
      required: true
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String }
  }],
  hiredRole: { type: String, required: false }
}, { timestamps: true });

// Updated indexes for team-level queries
ApplicationSchema.index({ teamPk: 1, stage: 1 });
ApplicationSchema.index({ applicantId: 1, teamPk: 1 }, { unique: true }); // One application per team per applicant

export const Application = model<IApplication>('Application', ApplicationSchema);

