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

import { EnabledBindlePermissions } from "../../controllers/BindleController"
import { EnabledRootSettings, RootTeamSettingInfo } from "../../controllers/OrgController"

export enum TeamType {
    PROJECT = "PROJECT",
    CORPORATE = "CORPORATE",
    BOOTCAMP = "BOOTCAMP"
}

export enum SeasonType {
    FALL = "FALL",
    SPRING = "SPRING"
}

export interface TeamAttributeDefinition {
    friendlyName: string,
    teamType: TeamType,
    seasonType: SeasonType,
    seasonYear: number,
    peoplePortalCreation?: boolean,
    flaggedForDeletion?: boolean,
    description: string,
    rootTeamSettings: {
        /* The key is the setting name (Ex. AwsAccount, AppleDevAccount, etc.) */
        [key: string]: EnabledRootSettings
    },

    bindlePermissions: {
        /* The key is the Client name (Ex. GiteaClient, OpenIdClient, etc.) */
        [key: string]: EnabledBindlePermissions
    }
}

export interface UserAttributeDefinition {
    peoplePortalCreation?: boolean,
    major: string,
    expectedGrad: Date,
    phoneNumber: string,
    roles: {
        /* Org ID Mapped to Role Title */
        [key: string]: string
    }
}

export interface PaginationDefinition {

}

/* Teams API Models */
export interface GetUserListOptions {
    page?: number,
    search?: string
}

export interface GetTeamsListOptions {
    subgroupsOnly?: boolean,
    includeUsers?: boolean,
    search?: string
}

export interface TeamInformationBrief {
    parent: string,
    name: string,
    pk: string,
}

export interface GetTeamsListResponse {
    pagination: PaginationDefinition,
    teams: TeamInformationBrief[]
}

export interface GetGroupInfoResponse {
    pk: string,
    name: string,
    users: UserInformationBrief[],
    parentPk: string,
    subteamPkList: string[],
    subteams: GetGroupInfoResponse[],
    attributes: TeamAttributeDefinition
}

export interface AddGroupMemberRequest {
    groupId: string,
    userPk: number
}

export interface RemoveGroupMemberRequest {
    groupId: string,
    userPk: number
}

export interface CreateUserRequest {
    name: string;
    email: string;
    groupPk: string;
    password: string;
    attributes: {
        major: string;
        expectedGrad: Date;
        phoneNumber: string;
        roles: { [key: string]: string }
    }
}

export interface CreateTeamRequest {
    parent?: string,
    parentName?: string,
    isSuperuser?: boolean,
    attributes: {
        friendlyName: string,
        teamType: TeamType,
        seasonType: SeasonType,
        seasonYear: number,
        description: string
    }
}

export interface CreateTeamResponse {
    pk: string,
    name: string
}

/* User Information API Models */
export interface UserInformationBrief {
    pk: string,
    username: string,
    name: string,
    email: string,
    memberSince: Date,
    active: boolean,
    attributes: UserAttributeDefinition,
}

export interface GetUserListResponse {
    pagination: PaginationDefinition,
    users: UserInformationBrief[]
}

export class AuthentikClientError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "AuthentikClientError"
    }
}