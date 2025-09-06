/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { OrgController } from './controllers/OrgController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AuthController } from './controllers/AuthController';
import { expressAuthentication } from './auth';
// @ts-ignore - no great way to install types from subpackage
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';

const expressAuthenticationRecasted = expressAuthentication as (req: ExRequest, securityName: string, scopes?: string[], res?: ExResponse) => Promise<any>;


// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "PaginationDefinition": {
        "dataType": "refObject",
        "properties": {
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserAttributeDefinition": {
        "dataType": "refObject",
        "properties": {
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserInformationBrief": {
        "dataType": "refObject",
        "properties": {
            "pk": {"dataType":"string","required":true},
            "username": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "memberSince": {"dataType":"datetime","required":true},
            "active": {"dataType":"boolean","required":true},
            "attributes": {"ref":"UserAttributeDefinition","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GetUserListResponse": {
        "dataType": "refObject",
        "properties": {
            "pagination": {"ref":"PaginationDefinition","required":true},
            "users": {"dataType":"array","array":{"dataType":"refObject","ref":"UserInformationBrief"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GetUserListOptions": {
        "dataType": "refObject",
        "properties": {
            "page": {"dataType":"double"},
            "search": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "APIUserInfoResponse": {
        "dataType": "refObject",
        "properties": {
            "pk": {"dataType":"string","required":true},
            "username": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "memberSince": {"dataType":"datetime","required":true},
            "active": {"dataType":"boolean","required":true},
            "attributes": {"ref":"UserAttributeDefinition","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TeamInformationBrief": {
        "dataType": "refObject",
        "properties": {
            "parent": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "pk": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GetTeamsListResponse": {
        "dataType": "refObject",
        "properties": {
            "pagination": {"ref":"PaginationDefinition","required":true},
            "teams": {"dataType":"array","array":{"dataType":"refObject","ref":"TeamInformationBrief"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GetTeamsListOptions": {
        "dataType": "refObject",
        "properties": {
            "subgroupsOnly": {"dataType":"boolean"},
            "includeUsers": {"dataType":"boolean"},
            "search": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "APITeamInviteCreateRequest": {
        "dataType": "refObject",
        "properties": {
            "inviteName": {"dataType":"string","required":true},
            "inviteEmail": {"dataType":"string","required":true},
            "roleTitle": {"dataType":"string","required":true},
            "teamPk": {"dataType":"string","required":true},
            "inviterPk": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TeamType": {
        "dataType": "refEnum",
        "enums": ["PROJECT","CORPORATE","BOOTCAMP"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SeasonType": {
        "dataType": "refEnum",
        "enums": ["FALL","SPRING"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TeamAttributeDefinition": {
        "dataType": "refObject",
        "properties": {
            "friendlyName": {"dataType":"string","required":true},
            "teamType": {"ref":"TeamType","required":true},
            "seasonType": {"ref":"SeasonType","required":true},
            "seasonYear": {"dataType":"double","required":true},
            "peoplePortalCreation": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GetGroupInfoResponse": {
        "dataType": "refObject",
        "properties": {
            "pk": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "users": {"dataType":"array","array":{"dataType":"double"},"required":true},
            "attributes": {"ref":"TeamAttributeDefinition","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "APITeamInfoResponse": {
        "dataType": "refObject",
        "properties": {
            "team": {"ref":"GetGroupInfoResponse","required":true},
            "subteams": {"dataType":"array","array":{"dataType":"refObject","ref":"GetGroupInfoResponse"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CreateTeamResponse": {
        "dataType": "refObject",
        "properties": {
            "pk": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "APICreateTeamRequest": {
        "dataType": "refObject",
        "properties": {
            "friendlyName": {"dataType":"string","required":true},
            "teamType": {"ref":"TeamType","required":true},
            "seasonType": {"ref":"SeasonType","required":true},
            "seasonYear": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "JsonPrimitive": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"double"},{"dataType":"boolean"},{"dataType":"enum","enums":[null]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "JsonValue": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"JsonPrimitive"},{"ref":"JsonObject"},{"ref":"JsonArray"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "JsonObject": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"ref":"JsonValue"},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "JsonArray": {
        "dataType": "refAlias",
        "type": {"dataType":"array","array":{"dataType":"refAlias","ref":"JsonValue"},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserInfoAddress": {
        "dataType": "refObject",
        "properties": {
            "formatted": {"dataType":"string"},
            "street_address": {"dataType":"string"},
            "locality": {"dataType":"string"},
            "region": {"dataType":"string"},
            "postal_code": {"dataType":"string"},
            "country": {"dataType":"string"},
        },
        "additionalProperties": {"dataType":"union","subSchemas":[{"ref":"JsonValue"},{"dataType":"undefined"}]},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserInfoResponse": {
        "dataType": "refObject",
        "properties": {
            "sub": {"dataType":"string","required":true},
            "name": {"dataType":"string"},
            "given_name": {"dataType":"string"},
            "family_name": {"dataType":"string"},
            "middle_name": {"dataType":"string"},
            "nickname": {"dataType":"string"},
            "preferred_username": {"dataType":"string"},
            "profile": {"dataType":"string"},
            "picture": {"dataType":"string"},
            "website": {"dataType":"string"},
            "email": {"dataType":"string"},
            "email_verified": {"dataType":"boolean"},
            "gender": {"dataType":"string"},
            "birthdate": {"dataType":"string"},
            "zoneinfo": {"dataType":"string"},
            "locale": {"dataType":"string"},
            "phone_number": {"dataType":"string"},
            "updated_at": {"dataType":"double"},
            "address": {"ref":"UserInfoAddress"},
        },
        "additionalProperties": {"dataType":"union","subSchemas":[{"ref":"JsonValue"},{"dataType":"undefined"}]},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {"noImplicitAdditionalProperties":"throw-on-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa




export function RegisterRoutes(app: Router) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################


    
        const argsOrgController_getPeople: Record<string, TsoaRoute.ParameterSchema> = {
                options: {"in":"queries","name":"options","required":true,"ref":"GetUserListOptions"},
        };
        app.get('/api/org/people',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.getPeople)),

            async function OrgController_getPeople(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_getPeople, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'getPeople',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOrgController_getPersonInfo: Record<string, TsoaRoute.ParameterSchema> = {
                personId: {"in":"path","name":"personId","required":true,"dataType":"double"},
        };
        app.get('/api/org/people/:personId',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.getPersonInfo)),

            async function OrgController_getPersonInfo(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_getPersonInfo, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'getPersonInfo',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOrgController_getTeams: Record<string, TsoaRoute.ParameterSchema> = {
                options: {"in":"queries","name":"options","required":true,"ref":"GetTeamsListOptions"},
        };
        app.get('/api/org/teams',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.getTeams)),

            async function OrgController_getTeams(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_getTeams, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'getTeams',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOrgController_createInvite: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"body","name":"req","required":true,"ref":"APITeamInviteCreateRequest"},
        };
        app.post('/api/org/invites/new',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.createInvite)),

            async function OrgController_createInvite(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_createInvite, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'createInvite',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOrgController_getTeamInfo: Record<string, TsoaRoute.ParameterSchema> = {
                teamId: {"in":"path","name":"teamId","required":true,"dataType":"string"},
        };
        app.get('/api/org/teams/:teamId',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.getTeamInfo)),

            async function OrgController_getTeamInfo(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_getTeamInfo, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'getTeamInfo',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOrgController_addTeamMember: Record<string, TsoaRoute.ParameterSchema> = {
                teamId: {"in":"path","name":"teamId","required":true,"dataType":"string"},
                req: {"in":"body","name":"req","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"userPk":{"dataType":"double","required":true}}},
        };
        app.post('/api/org/teams/:teamId/addmember',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.addTeamMember)),

            async function OrgController_addTeamMember(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_addTeamMember, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'addTeamMember',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOrgController_createTeam: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"body","name":"req","required":true,"ref":"APICreateTeamRequest"},
        };
        app.post('/api/org/teams/create',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.createTeam)),

            async function OrgController_createTeam(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_createTeam, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'createTeam',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_getUserInfo: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.get('/api/auth/userinfo',
            authenticateMiddleware([{"oidc":[]}]),
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.getUserInfo)),

            async function AuthController_getUserInfo(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_getUserInfo, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'getUserInfo',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_handleLogin: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.get('/api/auth/login',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.handleLogin)),

            async function AuthController_handleLogin(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_handleLogin, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'handleLogin',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 302,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_handleRedirect: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.get('/api/auth/redirect',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.handleRedirect)),

            async function AuthController_handleRedirect(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_handleRedirect, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'handleRedirect',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 302,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
        return async function runAuthenticationMiddleware(request: any, response: any, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            // keep track of failed auth attempts so we can hand back the most
            // recent one.  This behavior was previously existing so preserving it
            // here
            const failedAttempts: any[] = [];
            const pushAndRethrow = (error: any) => {
                failedAttempts.push(error);
                throw error;
            };

            const secMethodOrPromises: Promise<any>[] = [];
            for (const secMethod of security) {
                if (Object.keys(secMethod).length > 1) {
                    const secMethodAndPromises: Promise<any>[] = [];

                    for (const name in secMethod) {
                        secMethodAndPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }

                    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

                    secMethodOrPromises.push(Promise.all(secMethodAndPromises)
                        .then(users => { return users[0]; }));
                } else {
                    for (const name in secMethod) {
                        secMethodOrPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }
                }
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            try {
                request['user'] = await Promise.any(secMethodOrPromises);

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }

                next();
            }
            catch(err) {
                // Show most recent error as response
                const error = failedAttempts.pop();
                error.status = error.status || 401;

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }
                next(error);
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        }
    }

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
