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
import { Request, Controller, Get, Route, SuccessResponse, Security } from "tsoa";
import { OpenIdClient } from '../clients/OpenIdClient';
import { UserInfoResponse } from 'openid-client';

@Route("/api/auth")
export class AuthController extends Controller {
    @Get("userinfo")
    @Security("oidc")
    @SuccessResponse(200)
    async getUserInfo(@Request() req: express.Request): Promise<UserInfoResponse> {
        if (!req.session.accessToken || !req.session.authorizedUser)
            throw new Error("Unauthorized")

        const userInfo = await OpenIdClient.getUserInfo(req.session.accessToken, req.session.authorizedUser.sub)
        return userInfo
    }
    
    @Get("login")
    @SuccessResponse(302, "Redirect")
    async handleLogin(@Request() req: express.Request) {
        let authFlowResponse = OpenIdClient.startAuthFlow()
        if (!authFlowResponse)
            throw new Error("Failed to Compute OIDC Redirect URL")

        /* Perform Redirection */
        const res = (req as any).res as express.Response
        req.session.oidcState = authFlowResponse.expectedState
        return res.redirect(302, authFlowResponse.redirectUrl.toString())
    }

    @Get("redirect")
    @SuccessResponse(302, "Redirect")
    async handleRedirect(@Request() req: express.Request) {
        try {
            const fullURL = req.protocol + '://' + req.get('host') + req.originalUrl;
            let authorizationStamp = await OpenIdClient.issueAuthorizationStamps(new URL(fullURL), req.session.oidcState!)
            req.session.accessToken = authorizationStamp.accessToken
            req.session.idToken = authorizationStamp.idToken
            req.session.authorizedUser = authorizationStamp.user
            req.session.tokenExpiry = authorizationStamp.expiry

            /* Redirect to Homepage */
            const res = (req as any).res as express.Response
            return res.redirect(302, "/")
        } catch (e) {
            console.log(e)
            throw e
        }
    }
}