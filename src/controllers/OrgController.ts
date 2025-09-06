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

import { Body, Controller, Get, Path, Post, Queries, Route, SuccessResponse } from "tsoa";
import { AddGroupMemberRequest, CreateTeamRequest, CreateTeamResponse, GetGroupInfoResponse, GetTeamsListOptions, GetTeamsListResponse, GetUserListOptions, GetUserListResponse, SeasonType, TeamType, UserInformationBrief } from "../clients/AuthentikClient/models";
import { AuthentikClient } from "../clients/AuthentikClient";
import { UUID } from "crypto";
import { Invite } from "../models/Invites";
import { EmailClient } from "../clients/EmailClient";

/* Define Request Interfaces */
interface APIUserInfoResponse extends UserInformationBrief {

}

interface APICreateTeamRequest {
    friendlyName: string,
    teamType: TeamType,
    seasonType: SeasonType,
    seasonYear: number,
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
    private readonly authentikClient;
    private readonly emailClient;

    constructor() {
        super()
        this.authentikClient = new AuthentikClient()
        this.emailClient = new EmailClient()
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
        const subteamList = await this.authentikClient.getGroupsList({
            subgroupsOnly: true,
            search: primaryTeam.attributes.friendlyName.replaceAll(" ", "")
        })

        const subteamResponses: GetGroupInfoResponse[] = []
        const filteredSubTeams = subteamList.teams.filter((team) => team.parent == teamId)
        for (const team of filteredSubTeams) {
            subteamResponses.push(await this.authentikClient.getGroupInfo(team.pk))
        }

        return {
            team: primaryTeam,
            subteams: subteamResponses
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
                const leadershipTeam = await this.authentikClient.createNewTeam({ parent: newTeam.pk, attributes: { ...req, friendlyName: `${req.friendlyName} Lead`} })
                await this.authentikClient.createNewTeam({  parent: newTeam.pk, attributes: { ...req, friendlyName: `${req.friendlyName} Engr`} })

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