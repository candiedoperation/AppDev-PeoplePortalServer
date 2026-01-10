import { Document, Schema, model } from "mongoose";

interface IApplicant extends Document {
  email: string;
  fullName: string;
  // validation
  profile?: Map<string, string>; // question -> answer
  applicationIds: Schema.Types.ObjectId[];
  createdAt: Date;
}

const ApplicantSchema = new Schema<IApplicant>({
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  profile: {
    type: Map,
    of: String,
    required: false
  },
  applicationIds: [{ type: Schema.Types.ObjectId, ref: 'Application' }]
}, { timestamps: true });

export const Applicant = model<IApplicant>('Applicant', ApplicantSchema);

export type ApplicantProfile = { [key: string]: string };
