import { Document, Schema, model } from "mongoose";

interface IApplicant extends Document {
  email: string;
  fullName: string;
  // validation
  profile?: {
    resumeUrl?: string;
    linkedinUrl?: string; // take off 
    githubUrl?: string;
    whyAppDev?: string;
    previousInvolvement?: string;
    additionalInfo?: string;
    instagramFollow?: string;
  }
  applicationIds: Schema.Types.ObjectId[];
  createdAt: Date;
}

const ApplicantSchema = new Schema<IApplicant>({
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  profile: {
    resumeUrl: { type: String },
    linkedinUrl: { type: String },
    githubUrl: { type: String },
    whyAppDev: { type: String },
    previousInvolvement: { type: String },
    additionalInfo: { type: String },
    instagramFollow: { type: String }
  },
  applicationIds: [{ type: Schema.Types.ObjectId, ref: 'Application' }]
}, { timestamps: true });

export const Applicant = model<IApplicant>('Applicant', ApplicantSchema);

export interface ApplicantProfile {
  resumeUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  whyAppDev?: string;
  additionalInfo?: string;
  previousInvolvement?: string;
  instagramFollow?: string;
}
