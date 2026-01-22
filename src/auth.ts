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
import { AuthorizedUser, OpenIdClient } from "./clients/OpenIdClient";
import jwt from "jsonwebtoken"
import { BindleController } from "./controllers/BindleController";
import { AuthentikClient } from "./clients/AuthentikClient";
import { UserInformationBrief } from "./clients/AuthentikClient/models";
import { ResourceAccessError } from "./utils/errors";
import { formatBindleAccessError } from "./utils/strings";

export async function NativeExpressOIDCAuthPort(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    /* Obtain Auth Status */
    try {
        const res = await expressAuthentication(req, "oidc")
        next()
    } catch (e) {
        /* Auth Exception */
        res.redirect(301, "/api/auth/login")
        next(e)
    }
}

export async function expressAuthentication(
    request: express.Request,
    securityName: string,
    scopes?: string[]
): Promise<any> {
    try {
        if (securityName == "oidc")
            return await oidcAuthVerify(request, scopes);

        else if (securityName == "bindles")
            return await bindlesAuthVerify(request, scopes);

        else if (securityName == "ats_otp") {
            if (!request.session.tempsession?.jwt || !request.session.tempsession?.user) {
                return Promise.reject(new ResourceAccessError(401, "Session is Invalid"));
            }

            try {
                jwt.verify(request.session.tempsession.jwt, process.env.PEOPLEPORTAL_TOKEN_SECRET!);
                return Promise.resolve(true)
            } catch (error) {
                delete request.session.tempsession;
                return Promise.reject(new ResourceAccessError(401, "Invalid or expired token"));
            }
        }

        else
            throw new Error("Invalid Security Name!")
    } catch (e) {
        return Promise.reject(e)
    }
}

async function oidcAuthVerify(request: express.Request, scopes?: string[]): Promise<boolean> {
    try {
        const authToken = request.session.accessToken
        if (!authToken)
            return Promise.reject(new ResourceAccessError(401, "No Token Provided"));

        const userData = await OpenIdClient.verifyAccessToken(authToken)
        if (!request.session.accessToken || !request.session.authorizedUser) {
            request.session.accessToken = authToken
            request.session.authorizedUser = userData
        }

        return Promise.resolve(true)
    } catch (e) {
        /* OIDC Authorization Failed! */
        return Promise.reject(new ResourceAccessError(401, "Invalid or expired token"));
    }
}

/**
 * Verifies if user has the required bindles. When req.params.teamId exists in the request
 * we automatically process Bindle Authorization for that team. Otherwise, a Dynamic Locator
 * is needed to be present as the first element in scopes to resolve the teamId.
 * 
 * @param request Express Request Object
 * @param scopes Array of Bindles or Dynamic Locator + Bindles
 * @returns User Authorization Status (Boolean)
 */
async function bindlesAuthVerify(request: express.Request, scopes?: string[]): Promise<boolean> {
    /* 1. We Need OIDC Verification by Default (The Superset) */
    const isAuthenticated = await oidcAuthVerify(request, scopes);
    if (!isAuthenticated || !request.session.authorizedUser)
        return Promise.reject(new ResourceAccessError(401, "Invalid or expired token"));

    if (!scopes || scopes.length === 0) {
        return Promise.reject(new ResourceAccessError(403, "Bindle Security Check failed: No Scopes Defined"));
    }

    /* 2. Resolve Team ID & Required Bindles */
    let teamId: string | undefined;
    let requiredBindles: string[] = [];

    if (request.params.teamId) {
        /* Default: Standard REST Path (teams/:teamId) */
        teamId = request.params.teamId;
        requiredBindles = scopes;
    } else {
        /* Fallback: Dynamic Locator Path */
        const locatorPath = scopes[0];
        requiredBindles = scopes.slice(1);

        if (locatorPath) {
            const resolvedId = locatorPath.split(".").reduce((o: any, i) => o?.[i], request);
            if (typeof resolvedId === "string")
                teamId = resolvedId;
        }
    }

    if (!teamId || requiredBindles.length === 0) {
        return Promise.reject(new ResourceAccessError(403, "Bindle Security Check failed: Could not resolve Team ID or missing Required Bindles"));
    }

    const authorizedUser: AuthorizedUser = request.session.authorizedUser;
    const authentikClient = new AuthentikClient();

    try {
        const teamInfo = await authentikClient.getGroupInfo(teamId);

        /* 3. Check Owner (Optimized Recursive Group Name Check) */
        /* Convert user groups to Set for O(1) Lookup */
        const userGroupSet = new Set(authorizedUser.groups);
        let authoritativeTeam = teamInfo;

        /* If Subteam, Elevate to Parent for Ownership Check */
        if (teamInfo.parentPk) {
            authoritativeTeam = await authentikClient.getGroupInfo(teamInfo.parentPk);
        }

        /* Verify PeoplePortal Validity & Check Membership */
        /* Note: We rely on unique Group Names enforced by People Portal */
        if (authoritativeTeam.attributes.peoplePortalCreation) {
            if (userGroupSet.has(authoritativeTeam.name)) {
                return Promise.resolve(true);
            }
        }

        /* 4. Granular Permission Check */
        const effectivePermissions = BindleController.getEffectivePermissionSet(teamInfo, authorizedUser.groups);

        /* Ensure User has ALL required bindles */
        const missingBindles = requiredBindles.filter(bindle => !effectivePermissions.has(bindle));
        if (missingBindles.length === 0)
            return Promise.resolve(true);

        /* Access Denied */
        const owners = authoritativeTeam.users.map(u => u.name);
        return Promise.reject(new ResourceAccessError(403, formatBindleAccessError(owners, missingBindles)));

    } catch (e) {
        console.error("Bindle Permission Check Failed", e);
        if (e instanceof ResourceAccessError) return Promise.reject(e);
        return Promise.reject(new ResourceAccessError(403, "Bindle Permission Check Failed"));
    }
}