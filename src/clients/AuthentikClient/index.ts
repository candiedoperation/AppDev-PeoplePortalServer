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
import { AddGroupMemberRequest, AuthentikClientError, AuthentikServerVersion, CreateTeamRequest, CreateTeamResponse, CreateUserRequest, GetGroupInfoRequestOptions, GetGroupInfoResponse as GetGroupInfoResponse, GetTeamsListOptions as GetGroupsListOptions, GetTeamsListResponse as GetGroupsListResponse, GetTeamsForUsernameResponse, GetUserListOptions, GetUserListResponse, RemoveGroupMemberRequest, TeamAttributeDefinition, TeamInformationBrief, UserAttributeDefinition, UserInformationBrief, AuthentikFilterCursor } from "./models"
import { randomUUID } from "crypto"
import { sanitizeGroupName } from "../../utils/strings"
import { EnabledRootSettings } from "../../controllers/OrgController"
import { EnabledBindlePermissions } from "../../controllers/BindleController"

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

    /* Server Version Compatibility */
    private static readonly MIN_SERVER_VERSION = "2025.12.0" /* Breaking Changes from 2025.8+ */
    private static readonly MAX_SERVER_VERSION = "2025.12.1"

    constructor() {
        if (!this.AxiosBaseConfig.baseURL)
            throw new Error("Authentik Backend URL is Invalid!")

        if (!this.AUTHENTIK_TOKEN)
            throw new Error("Authentik Token is Invalid!")
    }

    public static validateAuthentikConnection = async () => {
        const client = new AuthentikClient();
        var RequestConfig: any = {
            ...client.AxiosBaseConfig,
            method: 'get',
            url: `/api/v3/admin/version/`,
        }

        try {
            const res = await axios.request(RequestConfig)
            const version = new AuthentikServerVersion(res.data.version_current);
            if (!version.isAtLeast(AuthentikClient.MIN_SERVER_VERSION) || !version.isAtMost(AuthentikClient.MAX_SERVER_VERSION))
                throw new AuthentikClientError(`Authentik Server Version ${version} is not compatible with People Portal. Please ensure the server is greater than ${AuthentikClient.MIN_SERVER_VERSION} and less than ${AuthentikClient.MAX_SERVER_VERSION}`);

            /* Log Authentik Connection */
            log.info(AuthentikClient.TAG, `Connection Validated to Authentik v${version}`);
        } catch (e) {
            log.error(AuthentikClient.TAG, "Authentik Connection Validation Failed: ", e);
            throw new AuthentikClientError("Critical: Failed to validate Authentik Connection or Version.");
        }
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

    public getTeamsForUsername = async (username: string): Promise<GetTeamsForUsernameResponse> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: '/api/v3/core/groups/',
            params: {
                include_users: false,
                is_superuser: false,
                include_parents: true, /* For Subteams, We return the Parent Team */
                include_children: false, /* We don't need subteams */
                members_by_username: username, /* Fetch Groups with Username as Member */
                page_size: 1000,
            }
        }

        try {
            const res = await axios.request(RequestConfig)
            const teamMap = new Map<string, TeamInformationBrief>();

            for (const group of res.data.results) {
                /* Filter by People Portal Creation */
                if (!group.attributes?.peoplePortalCreation)
                    continue;

                const parentPk = group.parents?.[0] ?? null;

                if (parentPk) {
                    /* It's a Subteam, so we append the Parent Team */
                    const parentTeam = group.parents_obj?.[0];

                    /* Safety Check */
                    if (!parentTeam) continue;

                    /* Add Parent to Map (Deduplicates) */
                    teamMap.set(parentTeam.pk, {
                        name: parentTeam.name,
                        pk: parentTeam.pk,
                        parent: null, /* Parent of a Parent is null (Root Team) */
                        ...parentTeam.attributes
                    });
                } else {
                    /* It's a Root Team */
                    teamMap.set(group.pk, {
                        name: group.name,
                        pk: group.pk,
                        parent: null,
                        ...group.attributes
                    });
                }
            }

            return {
                teams: Array.from(teamMap.values())
            };
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get Group List for User Request Failed with Error: ", e)
            throw new AuthentikClientError("Get Group List for User Request Failed")
        }
    }

    /**
     * Fetches list of groups from Authentik and filters for People Portal Creations,
     * filters out subteams and returns only root level groups. Method provides infinite
     * scrolling support via Base64 encoded cursor pagination.
     * 
     * @param options Get Groups Options
     * @returns List of Groups
     */
    public getGroupsList = async (options: GetGroupsListOptions): Promise<GetGroupsListResponse> => {
        /* Default Limits */
        const limit = options.limit ?? 20;

        /* Initial Cursor State */
        let currentCursor: AuthentikFilterCursor = {
            authentikPage: 1,
            authentikIndex: 0,
            searchHash: Buffer.from(options.search ?? "").toString('base64')
        };

        /* Decode Cursor if provided */
        if (options.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(options.cursor, 'base64').toString('ascii'));

                /* Check Search Hash Consistency */
                const currentSearchHash = Buffer.from(options.search ?? "").toString('base64');
                if (decoded.searchHash === currentSearchHash) {
                    currentCursor = decoded;
                }
            } catch (e) {
                log.warn(AuthentikClient.TAG, "Invalid Cursor Provided, resetting to start.");
            }
        }

        const collectedTeams: TeamInformationBrief[] = [];
        let hasMorePages = true;

        try {
            while (collectedTeams.length < limit && hasMorePages) {
                var RequestConfig: any = {
                    ...this.AxiosBaseConfig,
                    method: 'get',
                    url: '/api/v3/core/groups/',
                    params: {
                        include_users: false,
                        is_superuser: false,
                        page: currentCursor.authentikPage,
                        page_size: 100, /* Fetch larger chunks internally */
                        ordering: 'name', /* Standard Order for Streaming */
                    }
                }

                if (options.includeUsers)
                    RequestConfig.params.include_users = options.includeUsers

                if (options.search)
                    RequestConfig.params.search = options.search

                const res = await axios.request(RequestConfig);
                const results = res.data.results;
                const totalPages = Math.ceil(res.data.pagination.count / 100);

                /* Iterate current page starting from cursor index */
                for (let i = currentCursor.authentikIndex; i < results.length; i++) {
                    const entry = results[i];

                    /* Filter Logic */
                    const parentPk = entry.parent ?? entry.parents?.[0] ?? null;  /* 01-19-2026 (@atheesh): Filtering Patches to support Authentik v2025.12+ */
                    const isMatch = entry.attributes.peoplePortalCreation && ((options.subgroupsOnly) ? parentPk : !parentPk);

                    if (isMatch) {
                        collectedTeams.push({
                            name: entry.name,
                            pk: entry.pk,
                            parent: parentPk,
                            ...entry.attributes
                        });
                    }

                    /* Advance Cursor Index */
                    currentCursor.authentikIndex = i + 1;

                    /* If limit reached, break loop */
                    if (collectedTeams.length >= limit) {
                        break;
                    }
                }

                /* Check if we need to advance to next page */
                if (collectedTeams.length < limit) {
                    if (currentCursor.authentikPage < totalPages) {
                        currentCursor.authentikPage++;
                        currentCursor.authentikIndex = 0; /* Reset index for new page */
                    } else {
                        hasMorePages = false; /* EOF */
                    }
                }
            }

            /* Construct Next Cursor */
            let nextCursor: string | undefined = undefined;
            if (hasMorePages) {
                nextCursor = Buffer.from(JSON.stringify(currentCursor)).toString('base64');
            }

            return {
                teams: collectedTeams,
                ...(nextCursor && { nextCursor })
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

            /* Filter for Exact Match */
            const exactMatches = teams.filter((t: any) => t.name === teamName)

            if (exactMatches.length < 1)
                throw new AuthentikClientError("Team Not Found!")

            if (exactMatches.length > 1)
                throw new AuthentikClientError("Multiple Exact Matches Found!")

            const team = exactMatches[0]
            return team.pk
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get Teams PK Request Failed with Error: ", e)
            throw e
        }
    }

    public getGroupInfo = async (teamId: string, options?: GetGroupInfoRequestOptions): Promise<GetGroupInfoResponse> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: `/api/v3/core/groups/${teamId}/`,
            params: {
                /* Avoid Breaking Changes of Including Request Options, Default to True */
                include_users: options?.includeUsers ?? true,
                include_children: options?.includeChildren ?? true,
                include_parents: options?.includeParentInfo ?? false
            }
        }

        try {
            const res = await axios.request(RequestConfig)
            const subteams = res.data.children_obj

            /* Populate Users Within Subteams, Optional to Avoid Breaking Changes */
            if (!(options?.disableSubteamMemberPopulate)) {
                for (let subteam of subteams) {
                    const subteamInfo = await this.getGroupInfo(subteam.pk)
                    subteam.users = subteamInfo.users
                }
            }

            return {
                pk: res.data.pk,
                name: res.data.name,
                subteamPkList: res.data.children,
                subteams: res.data.children_obj,
                parentPk: res.data.parent ?? res.data.parents?.[0] ?? null, /* People Portal Legacy Single Parent Patch */
                parentInfo: res.data.parents_obj ? res.data.parents_obj[0] : null, /* Authentik 2025.12+ Only */
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

    /**
     * Private method to update any group attributes. 
     * Warning: Shouldn't be made public and inputs need to be sanitized as it
     * executes directly on the Authentik Backend!
     * 
     * @param teamId Target Team ID
     * @param updatePayload Raw, Sanitized Update Payload
     * @returns True if the update was successful
     */
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

    /**
     * Method to sanitize and update the Root Team Settings.
     * Internally calls updateGroupAttributes.
     * 
     * @param teamId Target Team ID
     * @param teamSettings Unsanitized Root Team Settings
     * @returns True if update was successful
     */
    public updateRootTeamSettings = async (teamId: string, teamSettings: { [key: string]: EnabledRootSettings }): Promise<boolean> => {
        return await this.updateGroupAttributes(
            teamId,
            { rootTeamSettings: teamSettings }
        )
    }

    /**
     * Method to Update Team Bindle Permissions.
     * Internally calls updateGroupAttributes.
     * 
     * @param teamId Target Team ID
     * @param bindlePermissions Unsanitized Bindle Perissions Map
     * @returns True if update was successful
     */
    public updateBindlePermissions = async (teamId: string, bindlePermissions: { [key: string]: EnabledBindlePermissions }): Promise<boolean> => {
        return await this.updateGroupAttributes(
            teamId,
            { bindlePermissions }
        )
    }

    /**
     * Flags a group for deletion.
     * Internally calls updateGroupAttributes.
     * 
     * @param teamId Target Team ID
     * @returns True if update was successful
     */
    public flagGroupForDeletion = async (teamId: string): Promise<boolean> => {
        return await this.updateGroupAttributes(
            teamId,
            { flaggedForDeletion: true }
        )
    }

    /**
     * Validates and updates group information (Friendly Name & Description).
     * 
     * @param teamId Target Team ID
     * @param conf Configuration object containing potential updates
     */
    public updateGroupInformation = async (teamId: string, conf: { [key: string]: string | undefined }) => {
        /* Strictly restrict updates to only name and description to prevent attribute pollution */
        const allowedFields = ["friendlyName", "description"];
        const filteredConf: any = {};

        for (const key of allowedFields) {
            if (conf[key] !== undefined) {
                if (conf[key]!.trim() === "") {
                    throw new Error("Attributes cannot be blank");
                }
                filteredConf[key] = conf[key];
            }
        }

        if (Object.keys(filteredConf).length === 0) {
            throw new Error("No valid fields provided for update");
        }

        await this.updateGroupAttributes(teamId, filteredConf);
    }

    /**
     * Method to update User Attibutes in the Authentik Backend.
     * Requires verified update payload of type Partial<UserAttributeDefinition>
     * 
     * @param userId Target User ID
     * @param updatePayload Verified Update Payload
     * @returns True if update was successful
     */
    public updateUserAttributes = async (userId: number, updatePayload: Partial<UserAttributeDefinition>): Promise<boolean> => {
        let userInfo = await this.getUserInfo(userId);
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'patch',
            url: `/api/v3/core/users/${userId}/`,
            data: {
                attributes: {
                    ...userInfo.attributes,
                    ...updatePayload
                }
            }
        }

        try {
            await axios.request(RequestConfig)
            return true
        } catch (e) {
            log.error(AuthentikClient.TAG, "Update User Attributes Failed with Error: ", e)
            throw new AuthentikClientError("Update User Attributes Failed")
        }
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

    public removeGroupMember = async (request: RemoveGroupMemberRequest): Promise<boolean> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'post',
            url: `/api/v3/core/groups/${request.groupId}/remove_user/`,
            data: { pk: request.userPk }
        }

        try {
            await axios.request(RequestConfig)
            return true
        } catch (e) {
            log.error(AuthentikClient.TAG, "Remove Team Member Request Failed with Error: ", e)
            throw new AuthentikClientError("Remove Team Member Request Failed")
        }
    }

    public removeAllTeamMembers = async (groupId: string): Promise<boolean> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'patch',
            url: `/api/v3/core/groups/${groupId}/`,
            data: { users: [] }
        }

        try {
            await axios.request(RequestConfig)
            return true
        } catch (e) {
            log.error(AuthentikClient.TAG, "Remove All Team Members Request Failed with Error: ", e)
            throw new AuthentikClientError("Remove All Team Members Request Failed")
        }
    }

    public getUserInfoFromEmail = async (email: string): Promise<UserInformationBrief> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: `/api/v3/core/users/`,
            params: {
                email,
                type: 'internal',
            }
        }

        try {
            const res = await axios.request(RequestConfig)
            const users = res.data.results

            /* Filter for Exact Match */
            const exactMatches = users.filter((u: any) => u.email === email)

            if (exactMatches.length < 1)
                throw new AuthentikClientError("User Not Found!")

            if (exactMatches.length > 1)
                throw new AuthentikClientError("Multiple Exact Matches Found!")

            const user = exactMatches[0]
            return {
                pk: user.pk,
                username: user.username,
                name: user.name,
                email: user.email,
                memberSince: user.date_joined,
                active: user.is_active,
                attributes: user.attributes,
            }
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get User PK Request Failed with Error: ", e)
            throw new AuthentikClientError("Get User PK Request Failed")
        }
    }

    public createNewUser = async (request: CreateUserRequest): Promise<boolean> => {
        if (!request.email.endsWith("@terpmail.umd.edu"))
            throw new Error("People Portal Currently Supports Terpmail Addresses Only!")

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
            log.error(AuthentikClient.TAG, "Create New User Failed with Error: ", e)
            throw new AuthentikClientError("Create New User Failed")
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
            rootTeamSettings: {},
            bindlePermissions: {},
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
                parents: request.parent ? [request.parent] : [], /* Patched for Authentik v2025.12+ */
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
}