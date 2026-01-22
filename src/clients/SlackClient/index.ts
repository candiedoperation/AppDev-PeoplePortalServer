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
import { GetGroupInfoResponse } from '../AuthentikClient/models';

export class SlackClient implements SharedResourceClient {
    private static readonly TAG = "SlackClient"
    private readonly slackClient: WebClient;

    private readonly supportedBindles: BindlePermissionMap = {

    }

    constructor() {
        this.slackClient = new WebClient(process.env.PEOPLEPORTAL_SLACK_BOT_TOKEN);
    }

    getResourceName(): string {
        return SlackClient.TAG
    }

    getSupportedBindles(): BindlePermissionMap {
        return this.supportedBindles
    }

    async handleOrgBindleSync(org: GetGroupInfoResponse, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {

        for (const subteam of org.subteams) {
            const channelName = `${org.attributes.friendlyName}-${subteam.attributes.friendlyName}`
                .toLowerCase()
                .replace(/ /g, '-');

            callback(0, `Processing Slack Channel: ${channelName}`);

            try {
                const channelId = await this.createOrGetChannel(channelName);

                if (channelId) {
                    // Add Subteam Members
                    for (const user of subteam.users) {
                        await this.addUserToChannel(channelId, user.email);
                    }

                    // Add Team Owners (from the parent org)
                    for (const user of org.users) {
                        await this.addUserToChannel(channelId, user.email);
                    }

                    callback(0, `Synced Slack Channel: ${channelName}`);
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
            const result = await this.slackClient.conversations.create({
                name: channelName,
                is_private: true
            });
            return result.channel?.id;
        } catch (error: any) {
            if (error?.data?.error === 'name_taken') {
                try {
                    let cursor: string | undefined;
                    do {
                        const options: any = {
                            types: 'public_channel,private_channel',
                        };
                        if (cursor) options.cursor = cursor;

                        const listResult: any = await this.slackClient.conversations.list(options);

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
            // console.error("Error creating channel", channelName, error);
            return undefined;
        }
    }

    private async addUserToChannel(channelId: string, email: string) {
        try {
            const userLookup = await this.slackClient.users.lookupByEmail({ email });
            const userId = userLookup.user?.id;
            if (!userId) return;

            await this.slackClient.conversations.invite({
                channel: channelId,
                users: userId
            });
        } catch (error: any) {
            const code = error?.data?.error;
            if (code !== 'users_not_found' && code !== 'already_in_channel') {
                console.error(`Failed to add user ${email} to channel ${channelId}`, error);
            }
        }
    }

    public async validateUserPresence(email: string): Promise<boolean> {
        try {
            const result = await this.slackClient.users.lookupByEmail({ email });
            return !!result.user;
        } catch (error: any) {
            if (error?.data?.error === 'users_not_found') {
                return false;
            }
            throw new Error(`Slack verification failed: ${error.message}`);
        }
    }
}