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
import { AuthentikClientError, GetUserListOptions, GetUserListResponse } from "./models"

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
    
    public getUserList = async (options?: GetUserListOptions): Promise<GetUserListResponse> => {
        const RequestConfig = {
            ...this.AxiosBaseConfig,
            method: 'get',
            url: '/api/v3/core/users/',
        }

        try {
            const res = await axios.request(RequestConfig)
            console.log(res.data)
            return {}
        } catch (e) {
            log.error(AuthentikClient.TAG, "Get User List Request Failed with Error: ", e)
            throw new AuthentikClientError("Get User Request Failed")
        }
    }
}