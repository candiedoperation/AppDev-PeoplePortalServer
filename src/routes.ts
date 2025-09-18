/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { BindleController } from './controllers/BindleController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { OrgController } from './controllers/OrgController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AuthController } from './controllers/AuthController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ATSController } from './controllers/ATSController';
import { expressAuthentication } from './auth';
// @ts-ignore - no great way to install types from subpackage
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';

const expressAuthenticationRecasted = expressAuthentication as (req: ExRequest, securityName: string, scopes?: string[], res?: ExResponse) => Promise<any>;


// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "BindlePermission": {
        "dataType": "refObject",
        "properties": {
            "friendlyName": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "BindlePermissionMap": {
        "dataType": "refObject",
        "properties": {
        },
        "additionalProperties": {"ref":"BindlePermission"},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
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
    "GetGroupInfoResponse": {
        "dataType": "refObject",
        "properties": {
            "pk": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "users": {"dataType":"array","array":{"dataType":"refObject","ref":"UserInformationBrief"},"required":true},
            "parentPk": {"dataType":"string","required":true},
            "subteamPkList": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "subteams": {"dataType":"array","array":{"dataType":"refObject","ref":"GetGroupInfoResponse"},"required":true},
            "attributes": {"ref":"TeamAttributeDefinition","required":true},
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
    "EnabledBindlePermissions": {
        "dataType": "refObject",
        "properties": {
        },
        "additionalProperties": {"dataType":"boolean"},
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
            "description": {"dataType":"string","required":true},
            "bindlePermissions": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"ref":"EnabledBindlePermissions"}},
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
    "APICreateSubTeamRequest": {
        "dataType": "refObject",
        "properties": {
            "friendlyName": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
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
            "description": {"dataType":"string","required":true},
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
    "OtpInitRequest": {
        "dataType": "refObject",
        "properties": {
            "email": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OtpVerifyRequest": {
        "dataType": "refObject",
        "properties": {
            "email": {"dataType":"string","required":true},
            "otp": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "mongoose.FlattenMaps_ISubteamConfig_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Required___id-mongoose.FlattenMaps_unknown___": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ATSSubteamConfigRequest": {
        "dataType": "refObject",
        "properties": {
            "isRecruiting": {"dataType":"boolean","required":true},
            "roles": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "roleSpecificQuestions": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"array","array":{"dataType":"string"}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "mongoose.FlattenMaps_ITeamRecruitingStatus_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"validators":{}},
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


    
        const argsBindleController_getDefinitions: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/bindles/definitions',
            ...(fetchMiddlewares<RequestHandler>(BindleController)),
            ...(fetchMiddlewares<RequestHandler>(BindleController.prototype.getDefinitions)),

            async function BindleController_getDefinitions(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsBindleController_getDefinitions, request, response });

                const controller = new BindleController();

              await templateService.apiHandler({
                methodName: 'getDefinitions',
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
        const argsOrgController_createSubTeam: Record<string, TsoaRoute.ParameterSchema> = {
                teamId: {"in":"path","name":"teamId","required":true,"dataType":"string"},
                req: {"in":"body","name":"req","required":true,"ref":"APICreateSubTeamRequest"},
        };
        app.post('/api/org/teams/:teamId/subteam',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.createSubTeam)),

            async function OrgController_createSubTeam(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_createSubTeam, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'createSubTeam',
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
        const argsOrgController_syncOrgBindles: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                teamId: {"in":"path","name":"teamId","required":true,"dataType":"string"},
        };
        app.patch('/api/org/teams/:teamId/syncbindles',
            ...(fetchMiddlewares<RequestHandler>(OrgController)),
            ...(fetchMiddlewares<RequestHandler>(OrgController.prototype.syncOrgBindles)),

            async function OrgController_syncOrgBindles(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOrgController_syncOrgBindles, request, response });

                const controller = new OrgController();

              await templateService.apiHandler({
                methodName: 'syncOrgBindles',
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
        const argsAuthController_otpInitRequest: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"OtpInitRequest"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.post('/api/auth/otpinit',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.otpInitRequest)),

            async function AuthController_otpInitRequest(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_otpInitRequest, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'otpInitRequest',
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
        const argsAuthController_otpVerifyRequest: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"OtpVerifyRequest"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.post('/api/auth/otpverify',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.otpVerifyRequest)),

            async function AuthController_otpVerifyRequest(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_otpVerifyRequest, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'otpVerifyRequest',
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
        const argsATSController_getSubTeamATSConfig: Record<string, TsoaRoute.ParameterSchema> = {
                subteamId: {"in":"path","name":"subteamId","required":true,"dataType":"string"},
        };
        app.get('/api/ats/config/:subteamId',
            ...(fetchMiddlewares<RequestHandler>(ATSController)),
            ...(fetchMiddlewares<RequestHandler>(ATSController.prototype.getSubTeamATSConfig)),

            async function ATSController_getSubTeamATSConfig(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsATSController_getSubTeamATSConfig, request, response });

                const controller = new ATSController();

              await templateService.apiHandler({
                methodName: 'getSubTeamATSConfig',
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
        const argsATSController_createOrUpdateSubteamConfig: Record<string, TsoaRoute.ParameterSchema> = {
                subteamId: {"in":"path","name":"subteamId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"ATSSubteamConfigRequest"},
        };
        app.post('/api/ats/config/:subteamId',
            ...(fetchMiddlewares<RequestHandler>(ATSController)),
            ...(fetchMiddlewares<RequestHandler>(ATSController.prototype.createOrUpdateSubteamConfig)),

            async function ATSController_createOrUpdateSubteamConfig(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsATSController_createOrUpdateSubteamConfig, request, response });

                const controller = new ATSController();

              await templateService.apiHandler({
                methodName: 'createOrUpdateSubteamConfig',
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
        const argsATSController_getAllRecruitingTeams: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/ats/openteams',
            ...(fetchMiddlewares<RequestHandler>(ATSController)),
            ...(fetchMiddlewares<RequestHandler>(ATSController.prototype.getAllRecruitingTeams)),

            async function ATSController_getAllRecruitingTeams(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsATSController_getAllRecruitingTeams, request, response });

                const controller = new ATSController();

              await templateService.apiHandler({
                methodName: 'getAllRecruitingTeams',
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
        const argsATSController_getTeamRecruitingStatus: Record<string, TsoaRoute.ParameterSchema> = {
                teamId: {"in":"path","name":"teamId","required":true,"dataType":"string"},
        };
        app.get('/api/ats/openteams/:teamId',
            ...(fetchMiddlewares<RequestHandler>(ATSController)),
            ...(fetchMiddlewares<RequestHandler>(ATSController.prototype.getTeamRecruitingStatus)),

            async function ATSController_getTeamRecruitingStatus(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsATSController_getTeamRecruitingStatus, request, response });

                const controller = new ATSController();

              await templateService.apiHandler({
                methodName: 'getTeamRecruitingStatus',
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
        const argsATSController_addSubteamToRecruiting: Record<string, TsoaRoute.ParameterSchema> = {
                teamId: {"in":"path","name":"teamId","required":true,"dataType":"string"},
                subteamId: {"in":"path","name":"subteamId","required":true,"dataType":"string"},
        };
        app.put('/api/ats/openteams/:teamId/:subteamId',
            ...(fetchMiddlewares<RequestHandler>(ATSController)),
            ...(fetchMiddlewares<RequestHandler>(ATSController.prototype.addSubteamToRecruiting)),

            async function ATSController_addSubteamToRecruiting(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsATSController_addSubteamToRecruiting, request, response });

                const controller = new ATSController();

              await templateService.apiHandler({
                methodName: 'addSubteamToRecruiting',
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
        const argsATSController_removeSubteamFromRecruiting: Record<string, TsoaRoute.ParameterSchema> = {
                teamId: {"in":"path","name":"teamId","required":true,"dataType":"string"},
                subteamId: {"in":"path","name":"subteamId","required":true,"dataType":"string"},
        };
        app.delete('/api/ats/openteams/:teamId/:subteamId',
            ...(fetchMiddlewares<RequestHandler>(ATSController)),
            ...(fetchMiddlewares<RequestHandler>(ATSController.prototype.removeSubteamFromRecruiting)),

            async function ATSController_removeSubteamFromRecruiting(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsATSController_removeSubteamFromRecruiting, request, response });

                const controller = new ATSController();

              await templateService.apiHandler({
                methodName: 'removeSubteamFromRecruiting',
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
