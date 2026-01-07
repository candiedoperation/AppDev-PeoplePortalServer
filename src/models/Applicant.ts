import { Document, Schema, model } from "mongoose";

interface IApplicant extends Document {
  email: string;
  fullName: string;

  profile?: {
    graduationYear?: number;
    major?: string;
    phone?: string;
    resumeUrl?: string;
    linkedinUrl?: string;
    githubUrl?: string;
  }
  applicationIds: Schema.Types.ObjectId[];
  createdAt: Date;
}

const ApplicantSchema = new Schema<IApplicant>({
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  profile: {
    graduationYear: { type: Number },
    major: { type: String },
    phone: { type: String },
    resumeUrl: { type: String },
    linkedinUrl: { type: String },
    githubUrl: { type: String }
  },
  applicationIds: [{ type: Schema.Types.ObjectId, ref: 'Application' }]
}, { timestamps: true });

export const Applicant = model<IApplicant>('Applicant', ApplicantSchema);
