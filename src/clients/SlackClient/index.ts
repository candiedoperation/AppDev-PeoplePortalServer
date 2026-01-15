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
        // throw new Error('Method not implemented.');
        return true
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