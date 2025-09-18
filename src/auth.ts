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

import * as express from "express";
import { OpenIdClient } from "./clients/OpenIdClient";
import jwt from "jsonwebtoken"

export function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[]
): Promise<any> {
    if (securityName == "oidc") {
        return new Promise(async (resolve, reject) => {
            try {
                const authHeader = request.headers.authorization?.replace("Bearer ", "")
                const authToken = authHeader || request.session.accessToken
                if (!authToken)
                    return reject({})

                const userData = await OpenIdClient.verifyAccessToken(authToken)
                if (!request.session.accessToken || !request.session.authorizedUser) {
                    request.session.accessToken = authHeader ?? ""
                    request.session.authorizedUser = userData
                }
                
                resolve({})
            } catch (e) {
                reject({})
            }
        })
    } else if (securityName == "ats_otp") {
        if (!request.session.tempsession?.jwt || !request.session.tempsession?.user) {
            return Promise.reject({ error: "Session is Invalid" });
        }

        try {
            jwt.verify(request.session.tempsession.jwt, process.env.JWT_SECRET!);
            return Promise.resolve({})
        } catch (error) {
            delete request.session.tempsession;
            return Promise.reject({ error: "Invalid or expired token" });
        }
    } else {
        return Promise.reject({})
    }
}

function oidcAuthVerify(req: express.Request, scopes?: string[]): boolean {
    let tokenExpiry = req.session.tokenExpiry
    return (
        tokenExpiry != undefined && 
        new Date() < tokenExpiry,
        req.session.authorizedUser != undefined
    )
}