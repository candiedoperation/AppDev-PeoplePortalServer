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
import { Request, Body, Controller, Get, Patch, Path, Post, Queries, Res, Route, SuccessResponse } from "tsoa";
import { AddGroupMemberRequest, CreateTeamRequest, CreateTeamResponse, GetGroupInfoResponse, GetTeamsListOptions, GetTeamsListResponse, GetUserListOptions, GetUserListResponse, SeasonType, TeamType, UserInformationBrief } from "../clients/AuthentikClient/models";
import { AuthentikClient } from "../clients/AuthentikClient";
import { UUID } from "crypto";
import { Invite } from "../models/Invites";
import { EmailClient } from "../clients/EmailClient";
import { SharedResourceClient } from '../clients';
import { GiteaClient } from '../clients/GiteaClient';

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

@Route("/api/org")
export class OrgController extends Controller {
    private sharedResources: SharedResourceClient[];
    private readonly authentikClient;
    private readonly emailClient;

    constructor() {
        super()
        this.authentikClient = new AuthentikClient()
        this.emailClient = new EmailClient()
        this.sharedResources = [
            new GiteaClient()
        ]
    }
    
    @Get("people")
    @SuccessResponse(200)
    async getPeople(@Queries() options: GetUserListOptions): Promise<GetUserListResponse> {
        return await this.authentikClient.getUserList(options)
    }

    @Get("people/{personId}")
    @SuccessResponse(200)
    async getPersonInfo(@Path() personId: number): Promise<APIUserInfoResponse> {
        const authentikUserInfo = await this.authentikClient.getUserInfo(personId)
        return { 
            ...authentikUserInfo 
        }
    }

    @Get("teams")
    @SuccessResponse(200)
    async getTeams(@Queries() options: GetTeamsListOptions): Promise<GetTeamsListResponse> {
        return await this.authentikClient.getGroupsList(options)
    }

    @Post("invites/new")
    @SuccessResponse(201)
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

    @Get("teams/{teamId}")
    @SuccessResponse(200)
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

    @Post("teams/{teamId}/addmember")
    @SuccessResponse(201)
    async addTeamMember(@Path() teamId: string, @Body() req: { userPk: number }) {
        /* Needs Is Team owner Middleware?! */
        await this.addTeamMemberWrapper({
            groupId: teamId,
            userPk: req.userPk
        })
    }

    @Post("teams/{teamId}/subteam")
    @SuccessResponse(201)
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
                return newTeam
            }
        }
    }

    @Patch("teams/{teamId}/syncbindles")
    @SuccessResponse(200)
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
                res.write(JSON.stringify({ progressPercent: (updatedResources/computeEffort)*100, status }))
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