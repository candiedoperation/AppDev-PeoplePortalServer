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
    peoplePortalCreation?: boolean
}

export interface UserAttributeDefinition {

}

export interface PaginationDefinition {

}

/* Teams API Models */
export interface GetUserListOptions {
    page?: number
}

export interface GetTeamsListOptions {
    includeUsers?: boolean
}

export interface TeamInformationBrief {
    name: string,
    pk: string,
}

export interface GetTeamsListResponse {
    pagination: PaginationDefinition,
    teams: TeamInformationBrief[]
}

export interface CreateTeamRequest {
    friendlyName: string,
    teamType: TeamType,
    seasonType: SeasonType,
    seasonYear: number,
    parent?: string,
    isSuperuser?: boolean
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