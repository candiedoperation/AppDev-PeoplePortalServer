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

import { RootTeamSettingClient, SharedResourceClient } from "..";
import { BindlePermissionMap } from "../../controllers/BindleController";
import { RootTeamSettingMap } from "../../controllers/OrgController";
import { GetGroupInfoResponse } from "../AuthentikClient/models";
import { AWSAccountTeamSetting } from "./models";

export class AWSClient implements RootTeamSettingClient {
    private static readonly TAG = "AWSClient"
    private readonly AWS_SECRET = "123"

    private readonly SUPPORTED_ROOTSETTINGS: RootTeamSettingMap = {
        "awsclient:provision": {
            friendlyName: "Provision AWS Account",
            description: "Creates a new AWS Account just for your team"
        }
    }

    constructor() {
        if (!this.AWS_SECRET)
            throw new Error("AWS Secret is Invalid!")
    }

    getResourceName(): string {
        return AWSClient.TAG;
    }

    getSupportedSettings(): RootTeamSettingMap {
        return this.SUPPORTED_ROOTSETTINGS;
    }

    syncSettingUpdate(org: GetGroupInfoResponse, callback: (updatePercent: number, status: string) => void): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}