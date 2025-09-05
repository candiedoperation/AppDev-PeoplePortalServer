/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { OrgController } from './controllers/OrgController';
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';



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

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
