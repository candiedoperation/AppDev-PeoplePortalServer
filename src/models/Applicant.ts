import { Document, Schema, model } from "mongoose";

interface IApplicant extends Document {
  email: string;
  fullName: string;
  applicationIds: Schema.Types.ObjectId[];
  createdAt: Date;
}

const ApplicantSchema = new Schema<IApplicant>({
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  fullName: { type: String, required: true },
  applicationIds: [{ type: Schema.Types.ObjectId, ref: 'Application' }]
}, { timestamps: true });

export const Applicant = model<IApplicant>('Applicant', ApplicantSchema);
