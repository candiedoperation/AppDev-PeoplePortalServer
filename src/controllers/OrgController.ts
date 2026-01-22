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

import * as express from 'express'
import { Request, Body, Controller, Get, Patch, Path, Post, Queries, Res, Route, SuccessResponse, Put, Security, Delete, Tags } from "tsoa";
import { AddGroupMemberRequest, CreateTeamRequest, CreateTeamResponse, GetGroupInfoResponse, GetTeamsListOptions, GetTeamsListResponse, GetUserListOptions, GetUserListResponse, RemoveGroupMemberRequest, SeasonType, TeamType, UserInformationBrief, GetTeamsForUsernameResponse } from "../clients/AuthentikClient/models";
import { AuthentikClient } from "../clients/AuthentikClient";
import { UUID } from "crypto";
import { IInvite, Invite } from "../models/Invites";
import { EmailClient } from "../clients/EmailClient";
import { SharedResourceClient } from '../clients';
import { GiteaClient } from '../clients/GiteaClient';
import { ENABLED_SHARED_RESOURCES, ENABLED_TEAMSETTING_RESOURCES } from '../config';
import { SlackClient } from '../clients/SlackClient';
import { AWSClient } from '../clients/AWSClient';
import { sanitizeUserFullName } from '../utils/strings';
import { BindleController, EnabledBindlePermissions } from '../controllers/BindleController';
import { AuthorizedUser } from '../clients/OpenIdClient';

export interface EnabledRootSettings {
    [key: string]: boolean
}

export interface RootTeamSettingMap {
    [key: string]: RootTeamSettingInfo
}

export interface RootTeamSettingInfo {
    friendlyName: string,
    description: string,
}

/* Define Request Interfaces */
interface APIUserInfoResponse extends UserInformationBrief {

}

interface APICreateSubTeamRequest {
    friendlyName: string,
    description: string
}

interface APICreateTeamRequest {
    friendlyName: string,
    teamType: TeamType,
    seasonType: SeasonType,
    seasonYear: number,
    description: string
}

interface APIUpdateTeamRequest {
    /** @minLength 1 */
    friendlyName?: string,
    /** @minLength 1 */
    description?: string,
    /** @minLength 1 */
    [key: string]: string
}

interface APITeamInfoResponse {
    team: GetGroupInfoResponse,
    subteams: GetGroupInfoResponse[]
}

interface APITeamMemberAddResponse {
    coreAdditionComplete: boolean,
    slackAdditionComplete: boolean
}

interface APITeamInviteCreateRequest {
    inviteeName: string;
    inviteeEmail: string;
    roleTitle: string;
    teamPk: string;
    subteamPk: string;
}

interface APITeamInviteGetResponse {
    inviteName: string;
    inviteEmail: string;
    roleTitle: string;
    teamPk: string;
    subteamPk: string;
    inviterPk: number;
    expiresAt: Date;
}

interface APITeamInviteAcceptRequest {
    password: string;
    major: string;
    expectedGrad: Date;
    phoneNumber: string;
}

interface APIGetTeamsListOptions {
    search?: string,
    subgroupsOnly?: boolean,
    includeUsers?: boolean,

    /** @default 20 */
    limit?: number;
    /** Base-64 Encoded Cursor */
    cursor?: string;
}

interface ExpressRequestSessionShim {
    session: { authorizedUser: AuthorizedUser }
}

@Route("/api/org")
export class OrgController extends Controller {
    private teamSettingList: { [key: string]: RootTeamSettingMap } = {}
    private sharedResources: SharedResourceClient[];
    private readonly authentikClient;
    private readonly emailClient;
    private readonly slackClient;

    constructor() {
        super()
        this.authentikClient = new AuthentikClient()
        this.emailClient = new EmailClient()
        this.slackClient = ENABLED_SHARED_RESOURCES.slackClient as SlackClient
        this.sharedResources = Object.values(ENABLED_SHARED_RESOURCES)

        for (const teamSettingResource of Object.values(ENABLED_TEAMSETTING_RESOURCES)) {
            const resourceName = teamSettingResource.getResourceName()
            this.teamSettingList[resourceName] = teamSettingResource.getSupportedSettings()
        }
    }

    /**
     * Fetches the list of people in the organization.
     * Uses the Authentik Client for internal filtering.
     * 
     * @param options Options for searching and pagination
     * @returns Paginated List of People in the Organization
     */
    @Get("people")
    @Tags("People Management")
    @SuccessResponse(200)
    @Security("oidc")
    async getPeople(@Queries() options: GetUserListOptions): Promise<GetUserListResponse> {
        return await this.authentikClient.getUserList(options)
    }

    /**
     * Fetches basic user information and additional attributes set
     * by People Portal, given the user's primary key ID.
     * 
     * @param personId Internal User ID
     * @returns User Information
     */
    @Get("people/{personId}")
    @Tags("People Management")
    @SuccessResponse(200)
    @Security("oidc")
    async getPersonInfo(@Path() personId: number): Promise<APIUserInfoResponse> {
        const authentikUserInfo = await this.authentikClient.getUserInfo(personId)
        return {
            ...authentikUserInfo
        }
    }

    /**
     * Provides the list of available root team settings supported
     * by People Portal teams.
     * 
     * @returns Team Settings List
     */
    @Get("teamsettings")
    @Tags("Team Configuration")
    @SuccessResponse(200)
    @Security("oidc")
    async listRootTeamSettings() {
        return this.teamSettingList;
    }

    /**
     * Fetches the list of all People Portal teams in the organization.
     * API includes a Base64-encoded cursor for pagination to assist with
     * post fetch filtering from Authentik and infinite scrolling.
     * 
     * @param options Get Team List Options
     * @returns Cursor-Paginated List of Teams
     */
    @Get("teams")
    @Tags("Team Management")
    @SuccessResponse(200)
    @Security("oidc")
    async getTeams(@Queries() options: APIGetTeamsListOptions): Promise<GetTeamsListResponse> {
        return await this.authentikClient.getGroupsList(options)
    }

    /**
     * Fetches the list of all People Portal teams in the organization that
     * the user is a member of. Uses the Request Session Cookie for user
     * information. **List size is capped to 1000.**
     * 
     * @param req Express Request Object
     * @returns Non-Paginated List of Teams
     */
    @Get("myteams")
    @Tags("Team Management")
    @SuccessResponse(200)
    @Security("oidc")
    async getMyTeams(@Request() req: express.Request): Promise<GetTeamsForUsernameResponse> {
        return await this.authentikClient.getTeamsForUsername(req.session.authorizedUser!.username)
    }

    /**
     * Creates a new invite for a user to join a team. To call the API,
     * the user must either be a team owner or have the `corp:membermgmt`
     * bindle. The invitee is automatically sent an email with a unique
     * invite link for onboarding.
     * 
     * Bindle Exceptions:
     * - This function supports being called by the ATS Module allowing
     *   the ATS to create invites on behalf of the requester.
     * 
     * - The ATS module is enforced to require the `corp:hiringaccess` bindle
     *   to offset for the bindle exception.
     * 
     * @param req Express Request Object
     * @param inviteReq Invite Create Request
     */
    @Post("invites/new")
    @Tags("User Onboarding", "Team Management")
    @SuccessResponse(201)
    @Security("bindles", ["corp:membermgmt"])
    async createInvite(@Request() req: express.Request | ExpressRequestSessionShim, @Body() inviteReq: APITeamInviteCreateRequest) {
        const authorizedUser = req.session.authorizedUser!;
        const teamInfo = await this.getTeamInfo(inviteReq.teamPk)
        const invitorInfo = await this.authentikClient.getUserInfoFromEmail(authorizedUser.email)

        /* Create New Invite */
        const createdInvite = await Invite.create({
            inviteName: inviteReq.inviteeName,
            inviteEmail: inviteReq.inviteeEmail,
            roleTitle: inviteReq.roleTitle,
            teamName: teamInfo.team.attributes.friendlyName,
            subteamPk: inviteReq.subteamPk,
            inviterPk: invitorInfo.pk,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) /* 48 Hours */
        })

        /* Send an Email to the Invitee and the Invitor */
        await this.emailClient.send({
            to: inviteReq.inviteeEmail,
            cc: [invitorInfo.email],
            replyTo: [invitorInfo.email],
            subject: `Congrats! You're accepted to ${teamInfo.team.attributes.friendlyName}`,
            templateName: "RecruitNewMemberOnboard",
            templateVars: {
                inviteeName: inviteReq.inviteeName,
                invitorName: invitorInfo.name,
                teamName: teamInfo.team.attributes.friendlyName,
                roleTitle: inviteReq.roleTitle,
                onboardUrl: `${process.env.PEOPLEPORTAL_BASE_URL}/onboard/${createdInvite._id}`
            }
        })
    }

    /**
     * Public API since Invite IDs are unique and can't be guessed. Additionally,
     * temporary authentication through OTP is supported but would need an overhaul.
     * 
     * @param inviteId Invite UUID
     * @returns Invite Information
     */
    @Get("invites/{inviteId}")
    @Tags("User Onboarding")
    @SuccessResponse(200)
    async getInviteInfo(@Path() inviteId: string): Promise<APITeamInviteGetResponse> {
        const invite = await Invite.findById(inviteId).lean<APITeamInviteGetResponse>().exec()
        if (!invite)
            throw new Error("Invalid Invite ID!")

        return invite
    }

    /**
     * Accepts an invite to join a team. The invitee must provide a password
     * and major. The invitee is automatically added to the team and given
     * the role specified in the invite. Slack and other verification checks
     * are in place.
     * 
     * @param inviteId Invite UUID
     * @param req Accept Invite Request
     */
    @Put("invites/{inviteId}")
    @Tags("User Onboarding")
    @SuccessResponse(201)
    async acceptInvite(@Path() inviteId: string, @Body() req: APITeamInviteAcceptRequest) {
        const invite = await Invite.findById(inviteId).exec()
        if (!invite)
            throw new Error("Invalid Invite ID")


        /* Check Slack Presence! */
        const slackPresence = await this.slackClient.validateUserPresence(invite.inviteEmail)
        if (!slackPresence)
            throw new Error("User has not joined the Slack Workspace!")

        /* Create the New User & add to Group */
        await this.authentikClient.createNewUser({
            name: invite.inviteName,
            email: invite.inviteEmail,
            groupPk: invite.subteamPk,
            password: req.password,
            attributes: {
                major: req.major,
                expectedGrad: req.expectedGrad,
                phoneNumber: req.phoneNumber,
                roles: {
                    [invite.subteamPk]: invite.roleTitle
                }
            }
        })

        /* Delete the Invite */
        await invite.deleteOne()
    }

    /**
     * Verifies if a user is a member of the Slack Workspace. Uses the
     * Slack Shared Resources Client for operations.
     * 
     * @param req Verify Slack Request
     * @returns True if the user is a member of the Slack Workspace, false otherwise
     */
    @Post("tools/verifyslack")
    @Tags("Generic Organization Tools")
    @SuccessResponse(200)
    async verifySlack(@Body() req: { email: string }): Promise<boolean> {
        return await this.slackClient.validateUserPresence(req.email)
    }

    /**
     * Provides information about a specific team in the organization. Includes
     * subteams, users and attributes. Access granted to all OIDC authenticated
     * users without any bindle restrictions.
     * 
     * @param teamId Team ID
     * @returns Team Information
     */
    @Get("teams/{teamId}")
    @Tags("Team Configuration")
    @SuccessResponse(200)
    @Security("oidc")
    async getTeamInfo(@Path() teamId: string): Promise<APITeamInfoResponse> {
        const primaryTeam = await this.authentikClient.getGroupInfo(teamId);

        /* Recursive Team Population Logic for Authentik Versions less than 2025.8 */
        // const subteamList = await this.authentikClient.getGroupsList({
        //     subgroupsOnly: true,
        //     search: primaryTeam.attributes.friendlyName.replaceAll(" ", "")
        // })

        // const subteamResponses: GetGroupInfoResponse[] = []
        // const filteredSubTeams = subteamList.teams.filter((team) => team.parent == teamId)
        // for (const team of filteredSubTeams) {
        //     subteamResponses.push(await this.authentikClient.getGroupInfo(team.pk))
        // }

        return {
            team: primaryTeam,
            subteams: primaryTeam.subteams
        }
    }

    /**
     * Provides a list of available bindles, collated from shared resources,
     * that are supported by teams. This feature is usually populated and used
     * in a subteam-level context.
     * 
     * @param teamId Team ID
     * @returns Bindle Permissions Map
     */
    @Get("teams/{teamId}/bindles")
    @Tags("Team Configuration", "Bindle Authorization Layer")
    @SuccessResponse(200)
    @Security("oidc")
    async getTeamBindles(@Path() teamId: string): Promise<{ [key: string]: EnabledBindlePermissions }> {
        const teamInfo = await this.authentikClient.getGroupInfo(teamId);
        return teamInfo.attributes.bindlePermissions ?? {}; /* Legacy Teams don't have bindles! */
    }

    /**
     * Updates the bindle permissions for a team. This method is used in a
     * subteam-level context. Team Owners can update subteam level permissions
     * and other members need to hold the `corp:permissionsmgmt` bindle.
     * 
     * **WARNING:**
     * This method does not sync the bindles for users across the shared resources.
     * A seperate team bindle sync call needs to be made to sync bindles for all subteams and
     * users in a team.
     * 
     * @param teamId Team or Subteam ID
     * @param bindleConf Bindle Permissions Map
     */
    @Patch("teams/{teamId}/bindles")
    @Tags("Team Configuration", "Bindle Authorization Layer")
    @SuccessResponse(201)
    @Security("bindles", ["corp:permissionsmgmt"])
    async updateTeamBindles(@Path() teamId: string, @Body() bindleConf: { [key: string]: EnabledBindlePermissions }) {
        const bindlePermissions = BindleController.sanitizeBindlePermissions(bindleConf);
        await this.authentikClient.updateBindlePermissions(teamId, bindlePermissions);
    }

    /**
     * Generates a temporary link to access the team's AWS Console. Account Provisioning
     * is handled by AWSClient and Root Team Settings. Access is moderated by the Bindle
     * Authorization Layer.
     * 
     * To enable AWS Access, the team owner or `corp:rootsettings` bindle is required. For 
     * generating a console link from this API, the user must either be a Team Owner or
     * hold the corp:awsaccess bindle.
     * 
     * @param req Express Request Object
     * @param teamId Team ID
     * @returns Temporary AWS Console Link
     */
    @Get("teams/{teamId}/awsaccess")
    @Tags("Team External Integrations")
    @SuccessResponse(201)
    @Security("bindles", ["corp:awsaccess"])
    async fetchAWSAccessCredentials(@Request() req: express.Request, @Path() teamId: string) {
        const res = (req as any).res as express.Response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        const awsRes = Object.values(ENABLED_TEAMSETTING_RESOURCES).find((res) => res.getResourceName() == "AWSClient") as unknown as AWSClient;

        res.write(JSON.stringify({ progressPercent: 10, status: "Retrieving Team Credentials..." }))
        const teamInfo = await this.authentikClient.getGroupInfo(teamId)

        // Check if provisioning is enabled
        const settings = teamInfo.attributes.rootTeamSettings?.[awsRes.getResourceName()];
        const shouldProvision = settings && settings["awsclient:provision"] === true;

        if (!shouldProvision) {
            res.write(JSON.stringify({ progressPercent: 100, status: "AWS Provisioning is not enabled for this team.", error: true }))
            res.end()
            return
        }

        /* Provide Progess Update */
        res.write(JSON.stringify({ progressPercent: 30, status: "Locating AWS Account..." }))

        const name = teamInfo.name
        const accountId = await awsRes.findAccountIdByName(teamInfo.name);

        if (!accountId) {
            res.write(JSON.stringify({ progressPercent: 100, status: "AWS Account not found! Please contact an administrator.", error: true }))
            res.end()
            return
        }

        res.write(JSON.stringify({ progressPercent: 60, status: "Generating Session..." }))
        try {
            const currentUser = req.session.authorizedUser?.name ?? "GenericDashboardUser"
            const link = await awsRes.generateConsoleLink(accountId, sanitizeUserFullName(currentUser))
            res.write(JSON.stringify({ progressPercent: 100, status: "Link Generated!", link: link }))
        } catch (e: any) {
            res.write(JSON.stringify({ progressPercent: 100, status: "Failed to generate link: " + e.message, error: true }))
        }

        res.end()
    }

    /**
     * Updates the Root Team Settings for a Team. To perform this action, the user
     * must either be a Team Owner or hold the `corp:rootsettings` bindle.
     * 
     * @param teamId Team ID
     * @param conf Root Team Settings Map
     */
    @Patch("teams/{teamId}/updateconf")
    @Tags("Team Configuration")
    @SuccessResponse(201)
    @Security("bindles", ["corp:rootsettings"])
    async updateRootTeamSetting(@Path() teamId: string, @Body() conf: { [key: string]: EnabledRootSettings }) {
        /* Filter for only the available settings */
        const applySettingsList: { [key: string]: EnabledRootSettings } = {};
        for (const client in conf) {
            if (!this.teamSettingList[client])
                continue;

            const supportedSettings = this.teamSettingList[client];
            const filteredSettings: EnabledRootSettings = {};
            for (const setting in conf[client]) {
                if (!supportedSettings[setting])
                    continue;

                /* Update Filtered Setting */
                filteredSettings[setting] = conf[client][setting] ?? false;
            }

            /* Apply the Filtered Settings to the Final List */
            applySettingsList[client] = filteredSettings;
        }

        /* Call Authentik to Update the Attributes */
        await this.authentikClient.updateRootTeamSettings(teamId, applySettingsList);

        /* Get updated team info and sync each RootTeamSettingClient */
        const updatedTeamInfo = await this.authentikClient.getGroupInfo(teamId);
        for (const client of Object.values(ENABLED_TEAMSETTING_RESOURCES)) {
            await client.syncSettingUpdate(updatedTeamInfo);
        }
    }

    /**
     * Adds an existing member to a team. To perform this action, the user must 
     * either be a Team Owner or hold the `corp:membermgmt` bindle.
     * 
     * @param teamId Team ID
     * @param req User PK
     */
    @Post("teams/{teamId}/addmember")
    @Tags("Team Management")
    @SuccessResponse(201)
    @Security("bindles", ["corp:membermgmt"])
    async addTeamMember(@Path() teamId: string, @Body() req: { userPk: number }) {
        /* Needs Is Team owner Middleware?! */
        await this.addTeamMemberWrapper({
            groupId: teamId,
            userPk: req.userPk
        })
    }

    /**
     * Removes an existing member from a team. To perform this action, the user must 
     * either be a Team Owner or hold the `corp:membermgmt` bindle.
     * 
     * @param teamId Team ID
     * @param req User PK
     */
    @Post("teams/{teamId}/removemember")
    @Tags("Team Management")
    @SuccessResponse(201)
    @Security("bindles", ["corp:membermgmt"])
    async removeTeamMember(@Path() teamId: string, @Body() req: { userPk: number }) {
        /* Needs Is Team owner Middleware?! */
        await this.removeTeamMemberWrapper({
            groupId: teamId,
            userPk: req.userPk
        })
    }

    /**
     * Creates a new subteam inside a team. To perform this action, the user must
     * either be a Team Owner or hold the `corp:subteamaccess` bindle.
     * 
     * @param teamId Team ID
     * @param req Subteam Information
     * @returns Created Subteam Information
     */
    @Post("teams/{teamId}/subteam")
    @Tags("Subteam Management")
    @SuccessResponse(201)
    @Security("bindles", ["corp:subteamaccess"])
    async createSubTeam(@Path() teamId: string, @Body() req: APICreateSubTeamRequest): Promise<CreateTeamResponse> {
        const parentInfo = await this.authentikClient.getGroupInfo(teamId)

        if (parentInfo.subteams && parentInfo.subteams.length >= 15) {
            this.setStatus(400);
            throw new Error("Maximum number of subteams (15) reached for this team.");
        }

        const createdSubTeam = await this.authentikClient.createNewTeam({
            parent: teamId,
            parentName: parentInfo.attributes.friendlyName,
            attributes: {
                friendlyName: req.friendlyName,
                teamType: parentInfo.attributes.teamType,
                seasonType: parentInfo.attributes.seasonType,
                seasonYear: parentInfo.attributes.seasonYear,
                description: req.description
            }
        })

        /* Return the Sub team */
        return createdSubTeam
    }

    /** WARN: Fix Authorization? */
    @Post("teams/create")
    @Tags("Team Management")
    @SuccessResponse(201)
    @Security("oidc")
    async createTeam(@Body() req: APICreateTeamRequest): Promise<CreateTeamResponse> {
        const newTeam = await this.authentikClient.createNewTeam({ attributes: { ...req } })
        // this.addTeamMemberWrapper({ groupId: newTeam.pk, userPk: 0 })

        // create slack channel

        switch (req.teamType) {
            case TeamType.CORPORATE:
                /* WE NEED TO ADD THE CURRENT USER TO THE GROUP!!! */
                return newTeam

            case TeamType.PROJECT: {
                /* Create Leadership and Engineering Sub-teams! */
                await this.createSubTeam(newTeam.pk, { friendlyName: 'Leadership', description: 'Project and Tech Leads' })
                await this.createSubTeam(newTeam.pk, { friendlyName: 'Engineering', description: 'UI/UX, PMs, SWEs, etc.' })

                /* Add Self as Project Lead */
                // this.addTeamMemberWrapper({ groupId: leadershipTeam.pk, userPk: 0 })

                /* Setup Gitea Organization and Teams */
                return newTeam
            }

            case TeamType.BOOTCAMP: {
                await this.createSubTeam(newTeam.pk, { friendlyName: 'Learners', description: 'Bootcamp Students' })
                await this.createSubTeam(newTeam.pk, { friendlyName: 'Educators', description: 'Bootcamp Teachers' })
                await this.createSubTeam(newTeam.pk, { friendlyName: 'Interviewers', description: 'Interviewers for Bootcamp' })
                return newTeam
            }
        }
    }

    /**
     * Syncs Shared Permissions for a team. Internally, this routine will call
     * `handleOrgBindleSync` for each shared resource that is enabled. For better
     * User experience, this routine emits HTTP Server-Sent Events (SSEs) to the
     * client to provide real-time progress updates.
     * 
     * @param req Express Request Object
     * @param teamId Team ID
     */
    @Patch("teams/{teamId}/syncbindles")
    @Tags("Team Configuration", "Bindle Authorization Layer")
    @SuccessResponse(200)
    @Security("bindles", ["corp:bindlesync"])
    async syncOrgBindles(@Request() req: Request, @Path() teamId: string) {
        const res = (req as any).res as express.Response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        /* Obtain Teams and Compute Progress Effort */
        const teamInfo = await this.authentikClient.getGroupInfo(teamId)
        const computeEffort = teamInfo.users.length +
            teamInfo.subteams.reduce((acc, val) => acc + val.users.length, 0)

        let updatedResources = 0
        for (const sharedResource of this.sharedResources) {
            await sharedResource.handleOrgBindleSync(teamInfo, (updatedResourceCount, status) => {
                /* Update Progress and Write Output */
                updatedResources += updatedResourceCount
                res.write(JSON.stringify({ progressPercent: (updatedResources / computeEffort) * 100, status }))
            })
        }

        res.end()
    }

    /**
     * Updates the team's name and description. To perform this action,
     * the user must either be a Team Owner or hold the `corp:rootsettings`
     * bindle.
     * 
     * @param teamId Team ID
     * @param conf Team Name and Description Update Payload
     */
    @Patch("teams/{teamId}")
    @Tags("Team Configuration")
    @SuccessResponse(200)
    @Security("bindles", ["corp:rootsettings"])
    async updateTeamAttributes(@Path() teamId: string, @Body() conf: APIUpdateTeamRequest) {
        /* Strictly restrict updates to only name and description to prevent attribute pollution */
        await this.authentikClient.updateGroupInformation(teamId, conf);
    }

    /**
     * Performs a soft-delete by flagging the team for deletion. People Portal teams
     * can never be deleted considering the potential impacts caused by deleted states
     * on Shared Resources. Instead, the soft-delete mechanism follows these rules:
     * 
     * - If the team is a subteam (has a parent), it removes 
     *   all members to immediately revoke access.
     * 
     * - If the team is a root team (has no parent), it is just
     *   flagged for deletion as their deletion is overengineering.
     * 
     * To perform this action, the user must either be a Team Owner or hold the
     * `corp:rootsettings` bindle.
     * 
     * @param teamId Team ID
     */
    @Delete("teams/{teamId}")
    @Tags("Team Management")
    @SuccessResponse(200)
    @Security("oidc")
    async deleteTeam(@Path() teamId: string) {
        const teamInfo = await this.authentikClient.getGroupInfo(teamId);
        await this.authentikClient.flagGroupForDeletion(teamId);

        /* 2. If subteam, remove all members */
        if (teamInfo.parentPk)
            await this.authentikClient.removeAllTeamMembers(teamId);

        // sync bindles
    }

    /* === HELPER ROUTINES === */
    private isGroupSubteam(group: GetGroupInfoResponse): boolean {
        return !!group.parentPk;
    }

    /* Other Wrapper Functions */
    async addTeamMemberWrapper(request: AddGroupMemberRequest): Promise<APITeamMemberAddResponse> {
        const coreAdditionComplete = await this.authentikClient.addGroupMember(request)
        /* DO SLACK and GIT REPO here! */

        return {
            coreAdditionComplete,
            slackAdditionComplete: false
        }
    }

    async removeTeamMemberWrapper(request: RemoveGroupMemberRequest): Promise<void> {
        const userInfo = await this.authentikClient.getUserInfo(request.userPk)
        const groupInfo = await this.authentikClient.getGroupInfo(request.groupId)

        /* Check if we're removing the last owner from a Root Team */
        if (!this.isGroupSubteam(groupInfo)) {
            if (groupInfo.users.length <= 1) {
                this.setStatus(409);
                throw new Error("Cannot Remove the last Team Owner. Add someone else to remove yourself.");
            }
        }

        /* Get Parent Team Name if available, otherwise fallback to current group */
        let teamName = groupInfo.attributes.friendlyName ?? groupInfo.name
        if (groupInfo.parentPk) {
            const parentInfo = await this.authentikClient.getGroupInfo(groupInfo.parentPk)
            teamName = parentInfo.attributes.friendlyName ?? parentInfo.name
        }

        /* Remove the Role Attribute from Authentik if it exists */
        if (userInfo.attributes.roles && userInfo.attributes.roles[request.groupId]) {
            const updatedRoles = { ...userInfo.attributes.roles }
            delete updatedRoles[request.groupId]
            await this.authentikClient.updateUserAttributes(request.userPk, { roles: updatedRoles })
        }

        await this.authentikClient.removeGroupMember(request)

        /* DO SLACK and GIT REPO here! */
    }
}