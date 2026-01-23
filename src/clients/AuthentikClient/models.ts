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
    BOOTCAMP = "BOOTCAMP",
    EXECBOARD = "EXECBOARD"
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

export interface AuthentikFilterCursor {
    authentikPage: number;
    authentikIndex: number;
    searchHash: string;
}


export interface PaginationDefinition {
    next: number;
    previous: number;
    count: number;
    current: number;
    total_pages: number;
    start_index: number;
    end_index: number;
}

/* Teams API Models */
export interface GetUserListOptions {
    page?: number,
    search?: string
}

export interface GetTeamsListOptions {
    subgroupsOnly?: boolean,
    includeUsers?: boolean,
    search?: string,
    limit?: number,
    cursor?: string
}

export interface GetTeamsForUsernameResponse {
    teams: TeamInformationBrief[]
}

export interface TeamInformationBrief {
    parent: string,
    name: string,
    pk: string,
}

export interface GetTeamsListResponse {
    teams: TeamInformationBrief[],
    nextCursor?: string
}

export interface GetGroupInfoRequestOptions {
    includeParentInfo?: boolean,
    includeChildren?: boolean,
    includeUsers?: boolean,
    disableSubteamMemberPopulate?: boolean
}

export interface GetGroupInfoResponse {
    pk: string,
    name: string,
    users: UserInformationBrief[],
    parentPk: string,
    parentInfo?: GetGroupInfoResponse, /* Optional to Avoid Breaking Changes */
    subteamPkList: string[],
    subteams: GetGroupInfoResponse[],
    attributes: TeamAttributeDefinition
}

export interface AddGroupMemberRequest {
    groupId: string,
    userPk: number
}

export interface RemoveGroupMemberRequest {
    groupInfo?: GetGroupInfoResponse, /* We Can Optimize Calls if using Bindle Auth */
    groupId: string,
    userPk: number
}

export interface CreateUserRequest {
    name: string;
    email: string;
    groupPk?: string;
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

export class AuthentikServerVersion {
    private version: string;
    constructor(version: string) {
        this.version = version;
    }

    /**
     * Compares two Authentik Version Strings
     * 
     * @param v1 Authentik Version String
     * @param v2 Authentik Version String
     * @returns -1, 0 or 1 for numeric comparison
     */
    private static compare(v1: string, v2: string): number {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        const len = Math.max(p1.length, p2.length);

        for (let i = 0; i < len; i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    }

    public isAtLeast(other: string): boolean {
        return AuthentikServerVersion.compare(this.version, other) >= 0;
    }

    public isAtMost(other: string): boolean {
        return AuthentikServerVersion.compare(this.version, other) <= 0;
    }

    public toString(): string {
        return this.version;
    }
}