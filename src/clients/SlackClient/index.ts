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
    private GITEA_TOKEN = process.env.PEOPLEPORTAL_GITEA_TOKEN
    private readonly SlackBaseConfig = {
        baseURL: process.env.PEOPLEPORTAL_GITEA_ENDPOINT ?? "",
        maxBodyLength: Infinity,
        headers: {
            'Accept': "application/json",
            'Authorization': `Bearer ${this.GITEA_TOKEN}`
        }
    }

    private readonly supportedBindles: BindlePermissionMap = {
        
    }

    constructor() {
        if (!this.SlackBaseConfig.baseURL)
            throw new Error("Slack Backend URL is Invalid!")

        if (!this.GITEA_TOKEN)
            throw new Error("Slack Token is Invalid!")
    }

    getResourceName(): string {
        return SlackClient.TAG
    }

    getSupportedBindles(): BindlePermissionMap {
        return this.supportedBindles
    }
    
    handleOrgBindleSync(org: GetGroupInfoResponse, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
}