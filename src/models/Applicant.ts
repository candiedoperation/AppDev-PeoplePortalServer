import { Document, Schema, model } from "mongoose";

export interface IApplicant extends Document {
  email: string;
  fullName: string;
  profile: Map<string, string>; // Made required with default
  applicationIds: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ApplicantSchema = new Schema<IApplicant>({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  },
  fullName: { type: String, required: true, trim: true },
  profile: {
    type: Map,
    of: String,
    required: true,
    default: new Map()
  },
  applicationIds: [{ type: Schema.Types.ObjectId, ref: 'Application' }]
}, { timestamps: true });

export const Applicant = model<IApplicant>('Applicant', ApplicantSchema);

export interface ApplicantProfile {
  resumeUrl: string;
  whyAppDev: string;
  instagramFollow: string;
  linkedinUrl?: string;
  githubUrl?: string;
  [key: string]: string | undefined;
}

