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
import { Request, Controller, Get, Route, SuccessResponse, Security, Post, Body } from "tsoa";
import { OpenIdClient } from '../clients/OpenIdClient';
import { UserInfoResponse } from 'openid-client';
import { Applicant } from '../models/Applicant';
import { Application } from '../models/Application';
import jwt from "jsonwebtoken"
import { generateSecureRandomString } from '../utils/strings';
import { AuthentikClient } from '../clients/AuthentikClient';
import { EmailClient } from '../clients/EmailClient';

interface OtpInitRequest {
    email: string;
    name: string;
}

interface OtpVerifyRequest {
    email: string;
    otp: string;
}

@Route("/api/auth")
export class AuthController extends Controller {
    private emailClient: EmailClient
    public constructor() {
        super()
        this.emailClient = new EmailClient()
    }

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

    @Post("otpinit")
    @SuccessResponse(200)
    async otpInitRequest(@Body() body: OtpInitRequest, @Request() req: express.Request) {
        const { email, name } = body;

        if (!email || !name) {
            this.setStatus(400);
            return { error: "Bad Request", message: "Email and name are required" };
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Initialize tempsession if it doesn't exist
        req.session.tempsession = req.session.tempsession || {};

        // Store OTP data in tempsession
        req.session.tempsession.otp = otp;
        req.session.tempsession.otpEmail = email;
        req.session.tempsession.otpName = name;
        req.session.tempsession.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

        /* Send OTP Via Email to User */
        await this.emailClient.send({
            to: email,
            subject: 'App Dev Verification Code',
            templateName: 'AuthOtpSendCode',
            templateVars: {
                name,
                otpCode: otp
            }
        })

        return { message: "Verification Code sent successfully" };
    }

    @Post("otpverify")
    @SuccessResponse(200)
    async otpVerifyRequest(@Body() body: OtpVerifyRequest, @Request() req: express.Request) {
        const { email, otp } = body;

        // Get tempsession data
        const tempsession = req.session.tempsession || {};

        // Verify OTP from tempsession
        if (!tempsession.otp || !tempsession.otpEmail || !tempsession.otpExpiry ||
            tempsession.otpEmail !== email ||
            tempsession.otp !== otp ||
            Date.now() > tempsession.otpExpiry) {
            this.setStatus(401);
            return { error: "Unauthorized", message: "Invalid or expired OTP" };
        }

        // Find or create applicant
        let applicant = await Applicant.findOne({ email }).exec();

        if (!applicant) {
            applicant = new Applicant({
                email,
                fullName: tempsession.otpName
            });
            await applicant.save();
        }

        // Generate JWT
        const token = jwt.sign(
            { email, name: applicant.fullName, id: applicant._id },
            process.env.PEOPLEPORTAL_TOKEN_SECRET!,
            { expiresIn: "24h" }
        );

        // Store JWT and user info in tempsession
        req.session.tempsession = {
            jwt: token,
            user: {
                email: applicant.email,
                name: applicant.fullName,
                id: applicant._id as string
            }
        }

        return {
            name: applicant.fullName,
            email: applicant.email,
            profile: applicant.profile ? Object.fromEntries(applicant.profile) : {}
        };
    }

    @Get("verifyotpsession")
    @SuccessResponse(200)
    async otpVerifySession(@Request() req: express.Request) {
        const tempsession = req.session.tempsession;

        // Check if tempsession and JWT exist
        if (!tempsession?.jwt) {
            return { error: "Unauthorized", message: "No active session" };
        }

        try {
            // Verify the JWT
            const decoded = jwt.verify(tempsession.jwt, process.env.PEOPLEPORTAL_TOKEN_SECRET!) as {
                email: string;
                name: string;
                id: string;
            };

            // Find the applicant to get latest data
            const applicant = await Applicant.findById(decoded.id).exec();

            if (!applicant) {
                return { error: "Unauthorized", message: "Applicant not found" };
            }

            const applications = await Application.find({ applicantId: applicant._id }).lean()

            // Fetch subteam and parent names from Authentik
            const authentikClient = new AuthentikClient();
            const applicationsWithNames = await Promise.all(applications.map(async (app: any) => {
                try {
                    const subteamInfo = await authentikClient.getGroupInfo(app.subteamPk);
                    let parentTeamName = "";
                    try {
                        const parentInfo = await authentikClient.getGroupInfo(subteamInfo.parentPk);
                        parentTeamName = parentInfo.attributes.friendlyName || parentInfo.name;
                    } catch (pe) {
                        console.error(`Failed to fetch parent info for ${subteamInfo.parentPk}:`, pe);
                    }

                    return {
                        ...app,
                        subteamName: subteamInfo.attributes.friendlyName || subteamInfo.name,
                        parentTeamName: parentTeamName
                    };
                } catch (e) {
                    console.error(`Failed to fetch subteam info for ${app.subteamPk}:`, e);
                    return {
                        ...app,
                        subteamName: app.subteamPk, // Fallback to PK
                        parentTeamName: ""
                    };
                }
            }));

            return {
                name: applicant.fullName,
                email: applicant.email,
                profile: applicant.profile ? Object.fromEntries(applicant.profile) : {},
                applications: applicationsWithNames
            };
        } catch (error) {
            // JWT is invalid or expired
            return { error: "Unauthorized", message: "Session expired or invalid" };
        }
    }

    @Post("logout")
    @SuccessResponse(200)
    async handleLogout(@Request() req: express.Request) {
        return new Promise((resolve) => {
            req.session.destroy(() => {
                resolve({ message: "Logged out successfully" });
            });
        });
    }
}