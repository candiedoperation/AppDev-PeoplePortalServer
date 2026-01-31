/**
  People Portal Server
  Copyright (C) 2026  Atheesh Thirumalairajan

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "../clients/AWSClient/S3Client";

const avatarUrlCache = new Map<string, { url: string, expiresAt: number }>();

/**
 * Generates a pre-signed URL for downloading a user's avatar.
 * Uses in-memory caching to reduce S3 API calls.
 * 
 * @param userPk The PK of the user whose avatar to fetch
 * @param avatarKey The S3 key of the avatar image
 * @returns Promise<string> The signed URL or an empty string if no avatar is provided
 */
export async function signAvatarUrl(userPk: string | number, avatarKey?: string): Promise<string> {
    const pk = userPk.toString();

    if (!avatarKey) return "";

    const cached = avatarUrlCache.get(pk);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
    }

    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: avatarKey,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 });

        avatarUrlCache.set(pk, {
            url: url,
            expiresAt: Date.now() + 86400 * 1000 // 24 hours
        });

        return url;
    } catch (e) {
        console.error(`Failed to sign avatar URL for user ${pk}`, e);
        return "";
    }
}
