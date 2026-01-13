import { S3Client } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

dotenv.config();

export const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
