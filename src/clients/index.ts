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

import { BindlePermissionMap } from "../controllers/BindleController";
import { RootTeamSettingMap } from "../controllers/OrgController";
import { GetGroupInfoResponse } from "./AuthentikClient/models";

/**
 * Interface to define clients that manipulate Shared Resources like,
 * Gitea, Slack, etc.
 */
export interface SharedResourceClient {
    getResourceName(): string
    getSupportedBindles(): BindlePermissionMap

    handleOrgBindleSync(
        org: GetGroupInfoResponse,
        callback: (updatedResourceCount: number, status: string) => void
    ): Promise<boolean>
}

/**
 * Interface to define clients that are impacted by root team setting
 * changes like, AWS accounts, etc.
 */
export interface RootTeamSettingClient {
    getResourceName(): string
    getSupportedSettings(): RootTeamSettingMap
    syncSettingUpdate(org: GetGroupInfoResponse): Promise<boolean>
}