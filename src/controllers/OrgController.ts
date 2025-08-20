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

import { Body, Controller, Get, Post, Queries, Route, SuccessResponse } from "tsoa";
import { CreateTeamRequest, CreateTeamResponse, GetTeamsListOptions, GetTeamsListResponse, GetUserListOptions, GetUserListResponse, SeasonType, TeamType } from "../clients/AuthentikClient/models";
import { AuthentikClient } from "../clients/AuthentikClient";

/* Define Request Interfaces */
interface APICreateTeamRequest {
    friendlyName: string,
    teamType: TeamType,
    seasonType: SeasonType,
    seasonYear: number,
}

@Route("/api/org")
export class OrgController extends Controller {
    private readonly authentikClient;

    constructor() {
        super()
        this.authentikClient = new AuthentikClient()
    }
    
    @Get("people")
    @SuccessResponse(200)
    async getPeople(@Queries() options: GetUserListOptions): Promise<GetUserListResponse> {
        return await this.authentikClient.getUserList(options)
    }

    @Get("teams")
    @SuccessResponse(200)
    async getTeams(@Queries() options: GetTeamsListOptions): Promise<GetTeamsListResponse> {
        return await this.authentikClient.getTeamsList(options)
    }

    @Post("teams/create")
    @SuccessResponse(201)
    async createTeam(@Body() req: APICreateTeamRequest): Promise<CreateTeamResponse> {
        const parentTeamCreateRes = await this.authentikClient.createNewTeam(req)
        // create slack channel
        
        switch (req.teamType) {
            case TeamType.CORPORATE:
                /* WE NEED TO ADD THE CURRENT USER TO THE GROUP!!! */
                return parentTeamCreateRes

            case TeamType.PROJECT: {
                /* Create Leadership and Member Sub-teams! */

                /* Setup Gitea Organization and Teams */
                return parentTeamCreateRes
            }

            case TeamType.BOOTCAMP: {
                return parentTeamCreateRes
            }
        }
    }
}