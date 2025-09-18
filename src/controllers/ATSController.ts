import { Body, Controller, Delete, Get, Path, Post, Put, Route, SuccessResponse } from "tsoa";
import { SubteamConfig } from "../models/SubteamConfig";
import { TeamRecruitingStatus } from "../models/TeamRecruitingStatus";
import { AuthentikClient } from "../clients/AuthentikClient";

interface ATSSubteamConfigRequest {
    isRecruiting: boolean;
    roles: string[];
    roleSpecificQuestions: { [role: string]: string[] };
}


@Route("/api/ats")
export class ATSController extends Controller {
    private readonly authentikClient: AuthentikClient;

    constructor() {
        super()
        this.authentikClient = new AuthentikClient()
    }

    @Get("config/{subteamId}")
    @SuccessResponse(200)
    async getSubTeamATSConfig(@Path() subteamId: string) {
        const config = await SubteamConfig.findOne({ subteamPk: subteamId }).lean().exec() as any;
        if (!config) {
            this.setStatus(404);
            return {
                error: "Not Found",
                message: `Subteam config with ID ${subteamId} not found`
            };
        }
        
        const authentikSubteamInfo = await this.authentikClient.getGroupInfo(config.subteamPk)
        const authentikParentInfo = await this.authentikClient.getGroupInfo(authentikSubteamInfo.parentPk);

        return {
            ...config,
            subteamInfo: {
                name: authentikSubteamInfo.name,
                friendlyName: authentikSubteamInfo.attributes.friendlyName,
                description: authentikSubteamInfo.attributes.description,
                seasonText: `${authentikSubteamInfo.attributes.seasonType} ${authentikSubteamInfo.attributes.seasonYear}`,
                pk: authentikSubteamInfo.pk
            },

            parentInfo: {
                name: authentikParentInfo.name,
                friendlyName: authentikParentInfo.attributes.friendlyName,
                description: authentikParentInfo.attributes.description,
                seasonText: `${authentikParentInfo.attributes.seasonType} ${authentikParentInfo.attributes.seasonYear}`,
                pk: authentikParentInfo.pk
            }
        };
    }

    @Post("config/{subteamId}")
    @SuccessResponse(200, "Created or Updated")
    async createOrUpdateSubteamConfig(@Path() subteamId: string, @Body() body: ATSSubteamConfigRequest) {
        const { isRecruiting, roles, roleSpecificQuestions } = body;

        if (roles.length === 0) {
            this.setStatus(400);
            return {
                error: "Bad Request",
                message: "Roles are required"
            };
        }

        // Use findOneAndUpdate with upsert to create or update
        const updatedConfig = await SubteamConfig.findOneAndUpdate(
            { subteamPk: subteamId }, // filter
            {
                subteamPk: subteamId,
                isRecruiting,
                roles,
                roleSpecificQuestions: new Map(Object.entries(roleSpecificQuestions || {}))
            }, // update data
            {
                upsert: true,        // Create if doesn't exist
                new: true,           // Return updated document
                setDefaultsOnInsert: true // Apply schema defaults on insert
            }
        ).lean().exec();

        /* Update Team Recruiting Status */
        const subteamInfo = await this.authentikClient.getGroupInfo(updatedConfig.subteamPk)
        if (updatedConfig.isRecruiting) {
            await this.addSubteamToRecruiting(subteamInfo.parentPk, updatedConfig.subteamPk)
        } else {
            await this.removeSubteamFromRecruiting(subteamInfo.parentPk, updatedConfig.subteamPk)
        }

        // Convert Map back to object for JSON response
        return updatedConfig;
    }

    @Get("openteams")
    @SuccessResponse(200)
    async getAllRecruitingTeams() {
        const recruitingTeams: any = await TeamRecruitingStatus.find({ isRecruiting: true }).lean().exec();

        /* Populate Team and Subteam Info */
        for (const team of recruitingTeams) {
            const recruitingSubteams = new Set(team.recruitingSubteamPks)
            const authentikTeamInfo = await this.authentikClient.getGroupInfo(team.teamPk);
            team.teamInfo = {
                name: authentikTeamInfo.name,
                friendlyName: authentikTeamInfo.attributes.friendlyName,
                description: authentikTeamInfo.attributes.description,
                seasonText: `${authentikTeamInfo.attributes.seasonType} ${authentikTeamInfo.attributes.seasonYear}`,
                pk: authentikTeamInfo.pk
            }

            team.subteamInfo = {};
            for (const sub of authentikTeamInfo.subteams) {
                if (recruitingSubteams.has(sub.pk)) {
                    team.subteamInfo[sub.pk] = {
                        name: sub.name,
                        friendlyName: sub.attributes.friendlyName,
                        description: sub.attributes.description,
                        seasonText: `${sub.attributes.seasonType} ${sub.attributes.seasonYear}`,
                        pk: sub.pk,
                        recruitmentInfo: await this.getSubTeamATSConfig(sub.pk),
                    };
                }
            }
        }

        return recruitingTeams;
    }

    @Get("openteams/{teamId}")
    @SuccessResponse(200)
    async getTeamRecruitingStatus(@Path() teamId: string) {
        const teamStatus = await TeamRecruitingStatus.findOne({ teamPk: teamId }).lean().exec();

        if (!teamStatus) {
            this.setStatus(404);
            return { error: "Not Found", message: `Team ${teamId} not found` };
        }

        return teamStatus;
    }

    @Put("openteams/{teamId}/{subteamId}")
    @SuccessResponse(200)
    async addSubteamToRecruiting(@Path() teamId: string, @Path() subteamId: string) {
        const updatedTeam = await TeamRecruitingStatus.findOneAndUpdate(
            { teamPk: teamId },
            {
                $addToSet: { recruitingSubteamPks: subteamId },
                teamPk: teamId
            },
            { upsert: true, new: true }
        ).lean().exec();

        // Set isRecruiting based on array length
        if (updatedTeam.recruitingSubteamPks.length > 0 && !updatedTeam.isRecruiting) {
            await TeamRecruitingStatus.updateOne(
                { teamPk: teamId },
                { isRecruiting: true }
            );
            updatedTeam.isRecruiting = true;
        }

        return updatedTeam;
    }

    @Delete("openteams/{teamId}/{subteamId}")
    @SuccessResponse(200)
    async removeSubteamFromRecruiting(@Path() teamId: string, @Path() subteamId: string) {
        const updatedTeam = await TeamRecruitingStatus.findOneAndUpdate(
            { teamPk: teamId },
            { $pull: { recruitingSubteamPks: subteamId } },
            { new: true }
        ).lean().exec();

        if (!updatedTeam) {
            this.setStatus(404);
            return { error: "Not Found", message: `Team ${teamId} not found` };
        }

        // Set isRecruiting to false if no subteams left
        if (updatedTeam.recruitingSubteamPks.length === 0 && updatedTeam.isRecruiting) {
            await TeamRecruitingStatus.updateOne(
                { teamPk: teamId },
                { isRecruiting: false }
            );
            updatedTeam.isRecruiting = false;
        }

        return updatedTeam;
    }
}