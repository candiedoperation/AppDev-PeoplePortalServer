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
import { AuthentikClientError, GetTeamsListOptions, GetTeamsListResponse, GetUserListOptions, GetUserListResponse, UserInformationBrief } from "./models"

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

        try {
            const res = await axios.request(RequestConfig)
            const userListArray: UserInformationBrief[] = res.data.results.map((user: any) => ({
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

    public getTeamsList = async (options: GetTeamsListOptions): Promise<GetTeamsListResponse> => {
        var RequestConfig: any = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: '/api/v3/core/groups/',
            params: {
                include_users: false
            }
        }

        if (options.includeUsers)
            RequestConfig.params.include_users = options.includeUsers

        try {
            const res = await axios.request(RequestConfig)
            const teamListArray: UserInformationBrief[] = res.data.results.map((team: any) => ({
                name: team.name
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
}