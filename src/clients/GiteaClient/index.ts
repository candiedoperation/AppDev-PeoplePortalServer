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

import axios, { AxiosError } from "axios"
import { SharedResourceClient } from ".."
import { GetGroupInfoResponse } from "../AuthentikClient/models"
import { GiteaAPITeamDefinition, GiteaAPIUserDefinition, GiteaBranchProtection, GiteaRepository, GiteaRepositoryBrief } from "./models";
import { computeStringArrStateDiff } from "../../utils/operations";
import { BindlePermission, BindlePermissionMap } from "../../controllers/BindleController";
import { GiteaHookSetup } from "./hooksetup";
import { GITEA_DEFAULT_BRANCH_PROTECTION, GITEA_DEFAULT_ORG_NAME } from "./config";

class GiteaClientResourceNotExists extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GiteaClientResourceNotExists";
    }
}

interface GiteaOrgCreateRequest {
    grpSharedResourceId: string,
    displayName: string,
    orgWebsite: string
}

interface GiteaTeamCreateRequest {
    grpSharedResourceId: string,
    teamSharedResourceId: string,
    canCreateRespositories: boolean,
    description: string,
    writeAccess: boolean
}

export class GiteaClient implements SharedResourceClient {
    private static INITIALIZED = false
    private static readonly TAG = "GiteaClient"
    private GITEA_TOKEN = process.env.PEOPLEPORTAL_GITEA_TOKEN
    public readonly GiteaBaseConfig = {
        baseURL: process.env.PEOPLEPORTAL_GITEA_ENDPOINT ?? "",
        maxBodyLength: Infinity,
        headers: {
            'Accept': "application/json",
            'Authorization': `Bearer ${this.GITEA_TOKEN}`
        }
    }

    private readonly supportedBindles: BindlePermissionMap = {
        "repo:allowcreate": {
            friendlyName: "Allow Repository Creation",
            description: "Enabling this allows members in this subteam to create repositories",
        },

        "repo:brprotect-approvals": {
            friendlyName: "Allow Pull Request Approvals",
            description: "Enabling this allows members in this subteam to approve and review PRs"
        },

        "repo:brprotect-push": {
            friendlyName: "Allow Git Push",
            description: "Enabling this allows members in this subteam to push to the repository",
        },

        "repo:brprotect-merge": {
            friendlyName: "Allow Git Merge",
            description: "Enabling this allows members in this subteam to merge Pull Requests"
        }
    }

    constructor() {
        if (!this.GiteaBaseConfig.baseURL)
            throw new Error("Gitea Backend URL is Invalid!")

        if (!this.GITEA_TOKEN)
            throw new Error("Gitea Token is Invalid!")
    }

    async init(): Promise<void> {
        if (!GiteaClient.INITIALIZED) {
            await GiteaHookSetup.setupHooks(this.GiteaBaseConfig)
            GiteaClient.INITIALIZED = true
        }
    }

    getResourceName(): string {
        return GiteaClient.TAG
    }

    getSupportedBindles(): BindlePermissionMap {
        return this.supportedBindles
    }

    public async handleOrgBindleSync(org: GetGroupInfoResponse, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {
        /* If the Org's Not Created, Create it! */
        await this.ensureOrganizationExists({
            grpSharedResourceId: org.name,
            displayName: `${org.attributes.friendlyName} ${org.attributes.seasonType} ${org.attributes.seasonYear}`,
            orgWebsite: `${process.env.PEOPLEPORTAL_BASE_URL}/org/teams/${org.pk}`
        })

        /* Perform Team Bindle Sync & Apply Branch Protections */
        await this.handleTeamBindleSync(org, org.name, callback)
        await this.handleBranchProtectionSync(org);
        return true
    }

    /**
     * Creates a team if doesn't exist and syncs the team members. Translates Bindle Permissions
     * to the Organization's Rules.
     * 
     * @param team 
     * @param orgRoot If Org Root, we create a fake resource to map the root team members
     * @param callback 
     * @returns 
     */
    private async handleTeamBindleSync(team: GetGroupInfoResponse, orgId: string, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {
        /* We'll put team owners in the Shared Owners Team so, People Portal has Supreme Access */
        const teamSharedResourceId = (orgId == team.name) ? GITEA_DEFAULT_ORG_NAME : team.name
        await this.createTeamIfNotExists({
            teamSharedResourceId,
            canCreateRespositories: true,
            description: `Permissions Group Replication for ${teamSharedResourceId}`,
            grpSharedResourceId: orgId,
            writeAccess: true
        })

        /* Obtain Current Team Members */
        const teamInfoBrief = await this.getTeamInfo(orgId, teamSharedResourceId)
        const teamMemberList = await this.getTeamMembers(teamInfoBrief.id)

        /* Map Objects to Obtain Usernames */
        const finalStateUsernames = team.users.map((user) => user.username)
        const currentStateUsernames = teamMemberList.map((member) => member.login)

        /* Perform User Delta Operations */
        const { additions, deletions } = computeStringArrStateDiff(finalStateUsernames, currentStateUsernames)
        for (const username of additions) {
            this.addTeamMember(teamInfoBrief.id, username)
                .then(() => callback(1, "Git Permissions Updated for " + username))
                .catch(() => callback(1, "Permission Update Failed for " + username))
        }

        for (const username of deletions) {
            this.removeTeamMember(teamInfoBrief.id, username)
                .then(() => callback(1, "Git Permissions Updated for " + username))
                .catch(() => callback(1, "Permission Update Failed for " + username))
        }

        /* Increased Processed Count for Existing Elements */
        const existingCount = finalStateUsernames.length - additions.length
        callback(existingCount, "Git Permissions Updated for " + teamInfoBrief.name)

        /* Recurse Sub Teams */
        for (const subteam of team.subteams ?? []) {
            await this.handleTeamBindleSync(subteam, orgId, callback)
        }

        /* We're Good Now! */
        return true
    }

    public async handleBranchProtectionSync(
        team: GetGroupInfoResponse,
        repositories?: GiteaRepositoryBrief[],
    ) {
        if (!repositories)
            repositories = await this.getOrgRepositories(team.name)

        /* Define Base List */
        const approvals_whitelist_teams = [GITEA_DEFAULT_ORG_NAME]
        const merge_whitelist_teams = [GITEA_DEFAULT_ORG_NAME]
        const push_whitelist_teams = [GITEA_DEFAULT_ORG_NAME]

        /* Enumerate Permissions from Team Information */
        for (const subteam of team.subteams) {
            const bindlePermissions = subteam.attributes.bindlePermissions[this.getResourceName()]
            if (!bindlePermissions)
                continue;

            if (bindlePermissions["repo:brprotect-approvals"] === true)
                approvals_whitelist_teams.push(subteam.name)

            if (bindlePermissions["repo:brprotect-merge"] === true)
                merge_whitelist_teams.push(subteam.name)

            if (bindlePermissions["repo:brprotect-push"] === true)
                push_whitelist_teams.push(subteam.name)
        }

        /* Define Branch Protection Rules, Apply Default Override */
        const branchProt: GiteaBranchProtection = {
            approvals_whitelist_teams,
            merge_whitelist_teams,
            push_whitelist_teams,
            ...GITEA_DEFAULT_BRANCH_PROTECTION
        }

        /* Apply Branch Protection Rules */
        await this.applyBranchProtections(repositories, branchProt)
    }

    private async applyBranchProtections(
        repositories: GiteaRepositoryBrief[],
        branchProt: GiteaBranchProtection
    ) {
        for (const repository of repositories) {
            var updateRequestConfig: any = {
                ...this.GiteaBaseConfig,
                method: 'patch',
                url: `/api/v1/repos/${repository.owner.username}/${repository.name}/branch_protections/${branchProt.rule_name}`,
                data: branchProt,
            }

            try {
                /* Apply Branch Protection Update */
                await axios.request(updateRequestConfig)
            } catch (e: any) {
                if (!e.response || e.response.status != 404)
                    throw e;

                /* Branch Protection Doesn't Exist, Create it! */
                var createRequestConfig: any = {
                    ...this.GiteaBaseConfig,
                    method: 'post',
                    url: `/api/v1/repos/${repository.owner.username}/${repository.name}/branch_protections`,
                    data: branchProt,
                }

                /* Excecute Request, Throws on Error! */
                await axios.request(createRequestConfig)
            }
        }
    }

    /**
     * Fetches all repositories owned by an organization.
     * Uses the Gitea API internally.
     * 
     * @param orgName Shared Resource ID
     * @returns Repository List
     */
    private async getOrgRepositories(orgName: string): Promise<GiteaRepository[]> {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'get',
            url: `/api/v1/orgs/${orgName}/repos`,
        }

        /* Excecute Request */
        const response = await axios.request(RequestConfig)
        return response.data as GiteaRepository[]
    }

    private async addTeamMember(teamId: number, username: string) {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'put',
            url: `/api/v1/teams/${teamId}/members/${username}`,
        }

        /* Excecute Request */
        await axios.request(RequestConfig)
    }

    private async removeTeamMember(teamId: number, username: string) {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'delete',
            url: `/api/v1/teams/${teamId}/members/${username}`,
        }

        /* Excecute Request */
        await axios.request(RequestConfig)
    }

    private async createTeamIfNotExists(req: GiteaTeamCreateRequest): Promise<boolean> {
        try {
            await this.getTeamInfo(req.grpSharedResourceId, req.teamSharedResourceId);
            return true;
        } catch (error: any) {
            if (!(error instanceof GiteaClientResourceNotExists))
                throw error
        }

        /* Team Doesn't Exist, Create it! */
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'post',
            url: `/api/v1/orgs/${req.grpSharedResourceId}/teams`,
            data: {
                name: req.teamSharedResourceId,
                description: req.description,
                permission: req.writeAccess ? "write" : "read",
                units: ["repo.actions", "repo.code", "repo.issues", "repo.pulls", "repo.releases", "repo.projects"],
                includes_all_repositories: true,
            }
        }

        /* Throws an Exception! */
        await axios.request(RequestConfig)
        return true;
    }

    private async ensureOrganizationExists(req: GiteaOrgCreateRequest): Promise<boolean> {
        try {
            /* Try to Obtain Org Info */
            const orgInfo = await this.getOrganizationInfo(req.grpSharedResourceId)

            /* Check if we need to update the organization */
            const description = `Code Repository for the ${req.displayName} team.  \nManaged by [**People Portal**](https://github.com/candiedoperation/AppDev-PeoplePortalServer).`

            if (orgInfo.full_name != req.displayName || orgInfo.website != req.orgWebsite || orgInfo.description != description) {
                await this.updateOrganization(req)
            }

            return true;
        } catch (error: any) {
            if (!(error instanceof GiteaClientResourceNotExists)) {
                throw error
            }
        }

        /* Org Doesn't Exist */
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'post',
            url: `/api/v1/orgs`,
            data: {
                username: req.grpSharedResourceId,
                full_name: req.displayName,
                description: `Code Repository for the ${req.displayName} team.  \nManaged by [**People Portal**](https://github.com/candiedoperation/AppDev-PeoplePortalServer).`,
                website: req.orgWebsite
            }
        }

        /* Throws an Exception! */
        await axios.request(RequestConfig)
        return true;
    }

    private async updateOrganization(req: GiteaOrgCreateRequest): Promise<boolean> {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'patch',
            url: `/api/v1/orgs/${req.grpSharedResourceId}`,
            data: {
                full_name: req.displayName,
                description: `Code Repository for the ${req.displayName} team.  \nManaged by [**People Portal**](https://github.com/candiedoperation/AppDev-PeoplePortalServer).`,
                website: req.orgWebsite
            }
        }

        /* Throws an Exception! */
        await axios.request(RequestConfig)
        return true;
    }

    private async getTeamMembers(giteaTeamId: number): Promise<GiteaAPIUserDefinition[]> {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'get',
            url: `/api/v1/teams/${giteaTeamId}/members`
        }

        const teamMembers = await axios.request(RequestConfig)
        return teamMembers.data
    }

    private async getTeamInfo(orgName: string, teamName: string): Promise<GiteaAPITeamDefinition> {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'get',
            url: `/api/v1/orgs/${orgName}/teams/search?q=${teamName}`
        }

        const teamInfo = await axios.request(RequestConfig)
        const matchedTeams = teamInfo.data.data

        if (matchedTeams.length < 1)
            throw new GiteaClientResourceNotExists("Team Doesn't Exist")

        return matchedTeams[0]
    }

    private async getOrganizationInfo(orgName: string) {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'get',
            url: `/api/v1/orgs/${orgName}`
        }

        try {
            const orgInfo = await axios.request(RequestConfig)
            return orgInfo.data
        } catch (e) {
            const error = e as AxiosError;
            if (error.response?.status == 404)
                throw new GiteaClientResourceNotExists("Organization Doesn't Exist")

            /* Throw the error, otherwise */
            throw e
        }
    }

    /* Repository Management */
    public async deleteRepository(owner: string, repo: string) {
        var RequestConfig: any = {
            ...this.GiteaBaseConfig,
            method: 'delete',
            url: `/api/v1/repos/${owner}/${repo}`
        }

        try {
            /* Call the DELETE API */
            await axios.request(RequestConfig)
        } catch (e) {
            const error = e as AxiosError;
            if (error.response?.status == 404)
                throw new GiteaClientResourceNotExists("Repository Doesn't Exist")

            /* Throw the error, otherwise */
            throw e
        }
    }
}