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
import { Request, Body, Controller, Get, Patch, Path, Post, Queries, Res, Route, SuccessResponse, Put, Security } from "tsoa";
import { AddGroupMemberRequest, CreateTeamRequest, CreateTeamResponse, GetGroupInfoResponse, GetTeamsListOptions, GetTeamsListResponse, GetUserListOptions, GetUserListResponse, SeasonType, TeamType, UserInformationBrief } from "../clients/AuthentikClient/models";
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

interface APITeamInfoResponse {
    team: GetGroupInfoResponse,
    subteams: GetGroupInfoResponse[]
}

interface APITeamMemberAddResponse {
    coreAdditionComplete: boolean,
    slackAdditionComplete: boolean
}

interface APITeamInviteCreateRequest {
    inviteName: string;
    inviteEmail: string;
    roleTitle: string;
    teamPk: string;
    inviterPk: number;
}

interface APITeamInviteGetResponse {
    inviteName: string;
    inviteEmail: string;
    roleTitle: string;
    teamPk: string;
    inviterPk: number;
    expiresAt: Date;
}

interface APITeamInviteAcceptRequest {
    password: string;
    major: string;
    expectedGrad: Date;
    phoneNumber: string;
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

    @Get("people")
    @SuccessResponse(200)
    @Security("oidc")
    async getPeople(@Queries() options: GetUserListOptions): Promise<GetUserListResponse> {
        return await this.authentikClient.getUserList(options)
    }

    @Get("people/{personId}")
    @SuccessResponse(200)
    @Security("oidc")
    async getPersonInfo(@Path() personId: number): Promise<APIUserInfoResponse> {
        const authentikUserInfo = await this.authentikClient.getUserInfo(personId)
        return {
            ...authentikUserInfo
        }
    }

    @Get("teamsettings")
    @SuccessResponse(200)
    @Security("oidc")
    async listRootTeamSettings() {
        return this.teamSettingList;
    }

    @Get("teams")
    @SuccessResponse(200)
    @Security("oidc")
    async getTeams(@Queries() options: GetTeamsListOptions): Promise<GetTeamsListResponse> {
        return await this.authentikClient.getGroupsList(options)
    }

    @Post("invites/new")
    @SuccessResponse(201)
    @Security("oidc")
    async createInvite(@Body() req: APITeamInviteCreateRequest) {
        const inviterPk = req.inviterPk;
        const teamInfo = await this.getTeamInfo(req.teamPk)
        const invitorInfo = await this.getPersonInfo(inviterPk) /* inviterPk should be obtained from SSO */

        /* Verify Team Owner Status */
        // if (!teamInfo.team.users.includes(inviterPk)) {
        //     this.setStatus(403);
        //     throw new Error(`You're not authorized to perform Team Management options for the resource ${teamInfo.team.name}`)
        // }

        /* Create New Invite */
        const createdInvite = await Invite.create({
            inviteName: req.inviteName,
            inviteEmail: req.inviteEmail,
            roleTitle: req.roleTitle,
            teamPk: req.teamPk,
            inviterPk: req.inviterPk,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        })

        /* Send an Email to the Invitee and the Invitor */
        await this.emailClient.send({
            to: req.inviteEmail,
            cc: [invitorInfo.email],
            replyTo: [invitorInfo.email],
            subject: `${teamInfo.team.attributes.friendlyName} Team Invitation`,
            templateName: "invite",
            templateVars: {
                inviteName: req.inviteName,
                invitorName: invitorInfo.name,
                teamName: teamInfo.team.attributes.friendlyName,
                roleTitle: req.roleTitle,
                onboardUrl: `${process.env.PEOPLEPORTAL_BASE_URL}/onboard/${createdInvite._id}`
            }
        })
    }

    @Get("invites/{inviteId}")
    @SuccessResponse(200)
    async getInviteInfo(@Path() inviteId: string): Promise<APITeamInviteGetResponse> {
        const invite = await Invite.findById(inviteId).lean<APITeamInviteGetResponse>().exec()
        if (!invite)
            throw new Error("Invalid Invite ID!")

        return invite
    }

    @Put("invites/{inviteId}")
    @SuccessResponse(201)
    async acceptInvite(@Path() inviteId: string, @Body() req: APITeamInviteAcceptRequest) {
        const invite = await Invite.findById(inviteId).exec()
        if (!invite)
            throw new Error("Invalid Invite ID")


        /* Check Slack Presence! */
        const slackPresence = await this.slackClient.validateUserPresence(invite.inviteEmail)
        if (!slackPresence)
            throw new Error("User has not joined the Slack Workspace!")

        /* Create the New User */
        await this.authentikClient.createNewUser({
            name: invite.inviteName,
            email: invite.inviteEmail,
            groupPk: invite.teamPk,
            password: req.password,
            attributes: {
                major: req.major,
                expectedGrad: req.expectedGrad,
                phoneNumber: req.phoneNumber,
                roles: {
                    [invite.teamPk]: invite.roleTitle
                }
            }
        })
    }

    @Post("tools/verifyslack")
    @SuccessResponse(200)
    async verifySlack(@Body() req: { email: string }): Promise<boolean> {
        return await this.slackClient.validateUserPresence(req.email)
    }

    @Get("teams/{teamId}")
    @SuccessResponse(200)
    @Security("oidc")
    async getTeamInfo(@Path() teamId: string): Promise<APITeamInfoResponse> {
        const primaryTeam = await this.authentikClient.getGroupInfo(teamId)

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

    @Get("teams/{teamId}/awsaccess")
    @SuccessResponse(201)
    @Security("oidc")
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

    @Patch("teams/{teamId}/updateconf")
    @SuccessResponse(201)
    @Security("oidc")
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

    @Post("teams/{teamId}/addmember")
    @SuccessResponse(201)
    @Security("oidc")
    async addTeamMember(@Path() teamId: string, @Body() req: { userPk: number }) {
        /* Needs Is Team owner Middleware?! */
        await this.addTeamMemberWrapper({
            groupId: teamId,
            userPk: req.userPk
        })
    }

    @Post("teams/{teamId}/subteam")
    @SuccessResponse(201)
    @Security("oidc")
    async createSubTeam(@Path() teamId: string, @Body() req: APICreateSubTeamRequest): Promise<CreateTeamResponse> {
        const parentInfo = await this.authentikClient.getGroupInfo(teamId)
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

    @Post("teams/create")
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
                await this.createSubTeam(newTeam.pk, { friendlyName: 'Mentors', description: 'Mentors for Bootcamp' })
                await this.createSubTeam(newTeam.pk, { friendlyName: 'Interviewers', description: 'Interviewers for Bootcamp' })
                return newTeam
            }
        }
    }

    @Patch("teams/{teamId}/syncbindles")
    @SuccessResponse(200)
    @Security("oidc")
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


    /* Other Wrapper Functions */
    async addTeamMemberWrapper(request: AddGroupMemberRequest): Promise<APITeamMemberAddResponse> {
        const coreAdditionComplete = await this.authentikClient.addGroupMember(request)
        /* DO SLACK and GIT REPO here! */

        return {
            coreAdditionComplete,
            slackAdditionComplete: false
        }
    }
}