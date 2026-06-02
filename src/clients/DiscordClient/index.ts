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

import { Client, GatewayIntentBits, GuildBasedChannel } from 'discord.js'
import { SharedResourceClient } from '..';
import { BindlePermissionMap } from '../../controllers/BindleController';
import { GetGroupInfoResponse } from '../AuthentikClient/models';


export class DiscordClient implements SharedResourceClient {
    private static readonly TAG = "DiscordClient";
    private static readonly INTENTS = [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ];
    private readonly discordClient: Client;

    private readonly supportedBindles: BindlePermissionMap = {};

    public isReady: boolean;

    constructor() {
        if (!process.env.PEOPLEPORTAL_DISCORD_BOT_TOKEN) {
            throw new Error("PEPOLEPORTAL_DISCORD_BOT_TOKEN is undefined");
        }
        if (!process.env.PEOPLEPORTAL_DISCORD_SERVER_ID) {
            throw new Error("PEOPLEPORTAL_DISCORD_SERVER_ID is undefined");
        }

        this.isReady = false;

        this.discordClient = new Client({ intents: DiscordClient.INTENTS });
        this.discordClient.on("clientReady", () => this.isReady = true);
        this.discordClient.login(process.env.PEOPLEPORTAL_DISCORD_BOT_TOKEN);
    }

    async init(): Promise<void> {
        return this.waitForReady();
    }

    waitForReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.discordClient.isReady()) {
                return resolve();
            }

            const timeout = setTimeout(() => reject(new Error("Discord bot was not ready on time.")), 15000);
            this.discordClient.once("clientReady", () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    getResourceName(): string {
        return DiscordClient.TAG;
    }

    getSupportedBindles(): BindlePermissionMap {
        return this.supportedBindles;
    }

    // Implement later when needed.
    async handleOrgBindleSync(org: GetGroupInfoResponse, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {
        return Promise.resolve(true);
    }

    async getChannelFromName(channelName: string) {
        if (!this.isReady) await this.waitForReady();

        // Uses guild id in .env in case bot is in multiple servers.
        const guild = await this.discordClient.guilds.fetch(process.env.PEOPLEPORTAL_DISCORD_SERVER_ID!);
        return guild.channels.cache.find(ch => ch.name === channelName && ch.isTextBased());
    }

    async sendMessageInChannel(channel: GuildBasedChannel, message: string) {
        if (channel.isSendable()) {
            return await channel.send(message);
        }
        throw new Error(`Channel ${channel.name} is not sendable.`);
    }
}