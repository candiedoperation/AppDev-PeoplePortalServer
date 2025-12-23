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

import axios from "axios"
import log from "loglevel"
import { AddGroupMemberRequest, AuthentikClientError, CreateTeamRequest, CreateTeamResponse, CreateUserRequest, GetGroupInfoResponse as GetGroupInfoResponse, GetTeamsListOptions as GetGroupsListOptions, GetTeamsListResponse as GetGroupsListResponse, GetUserListOptions, GetUserListResponse, TeamAttributeDefinition, TeamInformationBrief, UserInformationBrief } from "./models"
import { randomUUID } from "crypto"
import { sanitizeGroupName } from "../../utils/strings"
import { EnabledRootSettings } from "../../controllers/OrgController"

export class AuthentikClient {
    private static readonly TAG = "AuthentikClient"
    private AUTHENTIK_TOKEN = process.env.PEOPLEPORTAL_AUTHENTIK_TOKEN
    private readonly AxiosBaseConfig = {
        baseURL: process.env.PEOPLEPORTAL_AUTHENTIK_ENDPOINT ?? "",
        maxBodyLength: Infinity,
        headers: {
            'Accept': "application/json",
            'Authorization': `Bearer ${this.AUTHENTIK_TOKEN}`
        }
    }

    constructor() {
        if (!this.AxiosBaseConfig.baseURL)
            throw new Error("Authentik Backend URL is Invalid!")

        if (!this.AUTHENTIK_TOKEN)
            throw new Error("Authentik Token is Invalid!")
    }

    public getUserInfo = async (userId: number): Promise<UserInformationBrief> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: `/api/v3/core/users/${userId}/`,
            params: {
                type: 'internal',
            }
        }

        try {
            const res = await axios.request(RequestConfig)
            return {
                pk: res.data.pk,
                username: res.data.username,
                name: res.data.name,
                email: res.data.email,
                memberSince: res.data.date_joined,
                active: res.data.is_active,
                attributes: res.data.attributes,
            };
        } catch (e) {
            log.error(AuthentikClient.TAG, "User Info Request Failed with Error: ", e)
            throw new AuthentikClientError("User Info Request Failed")
        }
    }

    public getUserList = async (options: GetUserListOptions): Promise<GetUserListResponse> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: '/api/v3/core/users/',
            params: {
                type: 'internal',
            }
        }

        /* Append Optional Parameters */
        if (options?.page)
            RequestConfig.params.page = options.page

        if (options?.search)
            RequestConfig.params.search = options.search

        try {
            const res = await axios.request(RequestConfig)
            const userListArray: UserInformationBrief[] = res.data.results.map((user: any) => ({
                pk: user.pk,
                username: user.username,
                name: user.name,
                email: user.email,
                memberSince: user.date_joined,
                active: user.is_active,
                attributes: user.attributes,
            }))

            /* Return Mapped List */
            return {
                pagination: res.data.pagination,
                users: userListArray
            };
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get User List Request Failed with Error: ", e)
            throw new AuthentikClientError("Get User Request Failed")
        }
    }

    public getGroupsList = async (options: GetGroupsListOptions): Promise<GetGroupsListResponse> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: '/api/v3/core/groups/',
            params: {
                include_users: false,
                is_superuser: false
            }
        }

        if (options.includeUsers)
            RequestConfig.params.include_users = options.includeUsers

        if (options.search)
            RequestConfig.params.search = options.search

        try {
            const res = await axios.request(RequestConfig)
            const filteredResults = res.data.results.filter((entry: any) => entry.attributes.peoplePortalCreation && ((options.subgroupsOnly) ? entry.parent : !entry.parent))
            const teamListArray: TeamInformationBrief[] = filteredResults.map((team: any) => ({
                name: team.name,
                pk: team.pk,
                parent: team.parent,
                ...team.attributes
            }))

            /* Return Mapped List */
            return {
                pagination: res.data.pagination,
                teams: teamListArray
            };
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get Teams List Request Failed with Error: ", e)
            throw new AuthentikClientError("Get Team Request Failed")
        }
    }

    public getGroupPkFromName = async (teamName: string): Promise<string> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: `/api/v3/core/groups/`,
            params: {
                include_users: false,
                include_children: false,
                name: teamName
            }
        }

        try {
            const res = await axios.request(RequestConfig)
            const teams = res.data.results

            if (teams.length != 1)
                throw new AuthentikClientError("Team Search Length is Invalid!")

            const team = teams[0]
            return team.pk
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get Teams PK Request Failed with Error: ", e)
            throw e
        }
    }

    public getGroupInfo = async (teamId: string): Promise<GetGroupInfoResponse> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: `/api/v3/core/groups/${teamId}/`,
            params: {
                include_users: true,
                include_children: true
            }
        }

        try {
            const res = await axios.request(RequestConfig)
            const subteams = res.data.children_obj

            /* Populate Users Within SubTeams */
            for (let subteam of subteams) {
                const subteamInfo = await this.getGroupInfo(subteam.pk)
                subteam.users = subteamInfo.users
            }

            return {
                pk: res.data.pk,
                name: res.data.name,
                subteamPkList: res.data.children,
                subteams: res.data.children_obj,
                parentPk: res.data.parent,
                attributes: res.data.attributes,
                users: res.data.users_obj.map((user: any) => ({
                    pk: user.pk,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    attributes: user.attributes
                }))
            }
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get Teams List Request Failed with Error: ", e)
            throw new AuthentikClientError("Get Team Request Failed")
        }
    }

    private updateGroupAttributes = async (teamId: string, updatePayload: Partial<TeamAttributeDefinition>): Promise<boolean> => {
        let groupInfo = await this.getGroupInfo(teamId);
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'patch',
            url: `/api/v3/core/groups/${teamId}/`,
            data: {
                attributes: {
                    ...groupInfo.attributes,
                    ...updatePayload
                }
            }
        }

        try {
            await axios.request(RequestConfig)
            return true
        } catch (e) {
            log.error(AuthentikClient.TAG, "Update Group AttributesFailed with Error: ", e)
            throw new AuthentikClientError("Update Group Attributes Failed")
        }
    }

    public updateRootTeamSettings = async (teamId: string, teamSettings: {[key: string]: EnabledRootSettings}): Promise<boolean> => {
        return await this.updateGroupAttributes(
            teamId, 
            { rootTeamSettings: teamSettings }
        )
    }

    public addGroupMember = async (request: AddGroupMemberRequest): Promise<boolean> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'post',
            url: `/api/v3/core/groups/${request.groupId}/add_user/`,
            data: { pk: request.userPk }
        }

        try {
            await axios.request(RequestConfig)
            return true
        } catch (e) {
            log.error(AuthentikClient.TAG, "Add Team Member Request Failed with Error: ", e)
            throw new AuthentikClientError("Add Team Member Request Failed")
        }
    }

    public createNewUser = async (request: CreateUserRequest): Promise<boolean> => {
        if (!request.email.endsWith("@terpmail.umd.edu"))
            throw new Error("Portal Currently Supports Terpmail Addresses Only!")

        let username = request.email.replace("@terpmail.umd.edu", "")
        var RequestConfigAddUser: any = {
            ...this.AxiosBaseConfig,
            method: 'post',
            url: '/api/v3/core/users/',
            data: {
                username,
                name: request.name,
                groups: [request.groupPk],
                email: request.email,
                attributes: {
                    ...request.attributes,
                    peoplePortalCreation: true,
                }
            }
        }

        try {
            const res = await axios.request(RequestConfigAddUser)
            const userPk = res.data.pk

            /* Set User Password */
            var RequestConfigSetPassword: any = {
                ...this.AxiosBaseConfig,
                method: 'post',
                url: `/api/v3/core/users/${userPk}/set_password/`,
                data: {
                    password: request.password
                }
            }

            await axios.request(RequestConfigSetPassword)
            return true
        } catch (e) {
            log.error(AuthentikClient.TAG, "Create Team Request Failed with Error: ", e)
            throw new AuthentikClientError("Get Team Request Failed")
        }
    }

    public createNewTeam = async (request: CreateTeamRequest): Promise<CreateTeamResponse> => {
        if (request.parent && !request.parentName)
            throw new Error("Creating a SubTeam needs a Parent Name!")

        const attr = request.attributes
        const teamName = sanitizeGroupName(`${attr.friendlyName.replaceAll(" ", "")}${attr.seasonType}${attr.seasonYear}`)
        const teamAttributes: TeamAttributeDefinition = {
            ...request.attributes,
            peoplePortalCreation: true,  /* Helps Identify People Portal Managed Entires! */
            rootTeamSettings: {}
        }

        /* Check if a team with the Same Name Exists! */
        let teamExists = false
        try {
            const teamPk = await this.getGroupPkFromName(teamName)
            teamExists = true
        } catch (e) {
            /* If its some other error than count, throw it! */
            if (!(e instanceof AuthentikClientError))
                throw e
        }

        if (teamExists)
            throw new AuthentikClientError("Team with the Same Name Already Exists!")

        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'post',
            url: '/api/v3/core/groups/',
            data: {
                is_superuser: false,
                name: (request.parent) ? `${sanitizeGroupName(request.parentName!)}${teamName}` : teamName,
                parent: request.parent,
                attributes: teamAttributes
            }
        }

        try {
            const res = await axios.request(RequestConfig)
            return {
                name: teamName,
                pk: res.data.pk
            };
        } catch (e) {
            log.error(AuthentikClient.TAG, "Create Team Request Failed with Error: ", e)
            throw new AuthentikClientError("Get Team Request Failed")
        }
    }

    public updateGroup = async (groupPk: string, data: { attributes: any }): Promise<boolean> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'patch',
            url: `/api/v3/core/groups/${groupPk}/`,
            data: data
        }

        try {
            await axios.request(RequestConfig)
            return true
        } catch (e) {
            log.error(AuthentikClient.TAG, "Update Group Request Failed with Error: ", e)
            throw new AuthentikClientError("Update Group Request Failed")
        }
    }
}