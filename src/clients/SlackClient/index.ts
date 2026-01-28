/**
  App Dev Club People Portal Server
  Copyright (C) 2025  Atheesh Thirumalairajan

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

import { WebClient } from '@slack/web-api';
import { BindlePermissionMap } from '../../controllers/BindleController';
import { SharedResourceClient } from '..';
import { GetGroupInfoResponse, UserInformationBrief } from '../AuthentikClient/models';
import { computeStringArrStateDiff } from '../../utils/operations';

export class SlackClient implements SharedResourceClient {
    private static readonly TAG = "SlackClient"
    private readonly slackClient: WebClient;
    private botUserId: string | undefined;

    private async executeWithRateLimitRetry<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error: any) {
            if (error?.code === 'slack_web_api_rate_limited_error' || error?.data?.error === 'ratelimited') {
                console.warn(`Slack rate limit hit. Waiting 3 seconds before retrying...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                return await operation();
            }
            throw error;
        }
    }

    private readonly supportedBindles: BindlePermissionMap = {
        "channels:universalaccess": {
            friendlyName: "Enable Universal Access",
            description: "Enabling this adds the members of this subteam to all of the project's slack channels",
        }
    }

    constructor() {
        this.slackClient = new WebClient(process.env.PEOPLEPORTAL_SLACK_BOT_TOKEN);
    }

    private async getBotUserId(): Promise<string> {
        if (this.botUserId) return this.botUserId;
        const result = await this.executeWithRateLimitRetry(() => this.slackClient.auth.test());
        if (result.user_id) {
            this.botUserId = result.user_id;
            return result.user_id;
        }
        throw new Error("Could not fetch Bot User ID");
    }

    getResourceName(): string {
        return SlackClient.TAG
    }

    getSupportedBindles(): BindlePermissionMap {
        return this.supportedBindles
    }

    async handleOrgBindleSync(org: GetGroupInfoResponse, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {
        console.log(`[SlackClient] handleOrgBindleSync started for org: ${org.name}`);
        console.log(`[SlackClient] Found ${org.subteams?.length ?? 0} subteams`);
        // Cache for email -> userId mapping to avoid redundant API calls across channels
        const userIdCache = new Map<string, string>();
        const botId = await this.getBotUserId();

        const resolveUserId = async (email: string): Promise<string | undefined> => {
            if (userIdCache.has(email)) return userIdCache.get(email);
            try {
                const userLookup = await this.executeWithRateLimitRetry(() => this.slackClient.users.lookupByEmail({ email }));
                const userId = userLookup.user?.id;
                if (userId) {
                    userIdCache.set(email, userId);
                    return userId;
                }
            } catch (error: any) {
                if (error?.data?.error !== 'users_not_found') {
                    console.error(`Failed to resolve user ${email}`, error);
                }
            }
            return undefined;
        };

        // Universal access bindle
        const universalAccessUsers: UserInformationBrief[] = [];
        const universalAccessEmailSet = new Set<string>();
        for (const subteam of org.subteams) {
            const bindlePermissions = subteam.attributes.bindlePermissions;
            if (bindlePermissions && bindlePermissions[SlackClient.TAG]?.["channels:universalaccess"]) {
                console.log(`[SlackClient] Subteam ${subteam.name} has universal access enabled`);
                for (const user of subteam.users) {
                    if (!universalAccessEmailSet.has(user.email)) {
                        universalAccessUsers.push(user);
                        universalAccessEmailSet.add(user.email);
                    }
                }
            }
        }
        console.log(`[SlackClient] Identified ${universalAccessUsers.length} users for universal access`);

        // Pre-resolve common users (Org Owners + Universal Access)
        const commonUserIds = new Set<string>();
        const commonUsers = [...org.users, ...universalAccessUsers];
        for (const user of commonUsers) {
            const uid = await resolveUserId(user.email);
            if (uid) commonUserIds.add(uid);
        }

        for (const subteam of org.subteams) {
            const channelName = subteam.name
                .replace(/(?<!^)(?=[A-Z][a-z])/g, '-')
                .replace(/(?<!^)(?=(FALL|SPRING|SUMMER|WINTER)\d{4})/g, '-')
                .toLowerCase();

            //callback(0, `Processing Slack Channel: ${channelName.trim()}`);

            try {
                const channelId = await this.createOrGetChannel(channelName);

                if (channelId) {
                    // 1. Get Current Channel Members
                    const currentMemberIds = await this.getChannelMembers(channelId);

                    // 2. Resolve Target Members (Subteam + Common Users)
                    const targetUserIds = new Set<string>(commonUserIds);

                    for (const user of subteam.users) {
                        const uid = await resolveUserId(user.email);
                        if (uid) targetUserIds.add(uid);
                    }

                    // 3. Calculate Diff
                    const { additions, deletions } = computeStringArrStateDiff(Array.from(targetUserIds), Array.from(currentMemberIds));

                    // 4. Handle Additions
                    if (additions.length > 0) {
                        // Slack allows up to 1000 users per invite call, joined by commas.
                        const usersToInvite = additions.join(',');
                        await this.executeWithRateLimitRetry(() => this.slackClient.conversations.invite({
                            channel: channelId,
                            users: usersToInvite
                        })).catch((e: any) => {
                            if (e?.data?.error !== 'already_in_channel') {
                                console.error(`Failed to add users to channel ${channelName}`, e);
                            }
                        });
                    }

                    // 5. Handle Deletions
                    for (const uid of deletions) {
                        if (uid === botId) continue; // NEVER remove the bot
                        await this.removeUserFromChannel(channelId, uid);
                    }

                    //callback(0, `Synced Slack Channel: ${channelName.trim()}`);
                } else {
                    console.error(`Could not create or find channel: ${channelName}`);
                }

            } catch (e: any) {
                console.error(`Error processing slack channel ${channelName}: ${e.message}`);
            }
        }

        return true;
    }

    private async createOrGetChannel(channelName: string): Promise<string | undefined> {
        try {
            const result = await this.executeWithRateLimitRetry(() => this.slackClient.conversations.create({
                name: channelName,
                is_private: true
            }));
            return result.channel?.id;
        } catch (error: any) {
            if (error?.data?.error === 'name_taken') {
                try {
                    let cursor: string | undefined;
                    do {
                        const options: any = {
                            types: 'private_channel',
                        };
                        if (cursor) options.cursor = cursor;

                        const listResult: any = await this.executeWithRateLimitRetry(() => this.slackClient.conversations.list(options));

                        const found = listResult.channels?.find((c: any) => c.name === channelName);
                        if (found) {
                            // Only return the ID if the existing channel is private
                            if (!found.is_private) {
                                console.warn(`Channel ${channelName} exists but is PUBLIC. Skipping to enforce privacy.`);
                                return undefined;
                            }
                            return found.id;
                        }

                        cursor = listResult.response_metadata?.next_cursor;
                    } while (cursor);
                } catch (listError) {
                    console.error("Error listing channels to find existing one", listError);
                }
            }
            console.error("Error creating channel", channelName, error);
            return undefined;
        }
    }

    private async getChannelMembers(channelId: string): Promise<Set<string>> {
        const currentMemberIds = new Set<string>();
        let cursor: string | undefined;
        do {
            const options: any = { channel: channelId };
            if (cursor) options.cursor = cursor;

            const membersResult: any = await this.executeWithRateLimitRetry(() => this.slackClient.conversations.members(options));
            if (membersResult.members) {
                for (const m of membersResult.members) currentMemberIds.add(m);
            }
            cursor = membersResult.response_metadata?.next_cursor;
        } while (cursor);
        return currentMemberIds;
    }



    private async removeUserFromChannel(channelId: string, userId: string) {
        try {
            await this.executeWithRateLimitRetry(() => this.slackClient.conversations.kick({
                channel: channelId,
                user: userId
            }));
        } catch (error: any) {
            const code = error?.data?.error;
            if (code !== 'not_in_channel' && code !== 'cant_kick_self') {
                console.error(`Failed to remove user ${userId} from channel ${channelId}`, error);
            }
        }
    }

    public async validateUserPresence(email: string): Promise<boolean> {
        try {
            const result = await this.executeWithRateLimitRetry(() => this.slackClient.users.lookupByEmail({ email }));
            return !!result.user;
        } catch (error: any) {
            if (error?.data?.error === 'users_not_found') {
                return false;
            }
            throw new Error(`Slack verification failed: ${error.message}`);
        }
    }
}