import { Body, Request, Controller, Delete, Get, Path, Post, Put, Route, SuccessResponse } from "tsoa";
import { SubteamConfig } from "../models/SubteamConfig";
import { TeamRecruitingStatus } from "../models/TeamRecruitingStatus";
import { AuthentikClient } from "../clients/AuthentikClient";
import { Applicant } from '../models/Applicant';
import { Application } from "../models/Application";
import { ApplicationStage } from "../models/Application";
import { Security } from "tsoa";

interface ATSSubteamConfigRequest {
    isRecruiting: boolean;
    roles: string[];
    roleSpecificQuestions: { [role: string]: string[] };
}

interface ApplicantProfile {
    graduationYear?: number;
    major?: string;
    phone?: string;
    resumeUrl?: string;
    linkedinUrl?: string;
    githubUrl?: string;
}

interface ATSApplicationRequest {
    subteamPk: string;
    roles: string[];
    profile: ApplicantProfile;
    responses: Record<string, string>;
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

    @Get("applications/{teamId}")
    @Security("oidc")
    @SuccessResponse(200)
    async getTeamApplications(@Path() teamId: string) {
        try {
            // Get all subteams for this team
            const teamInfo = await this.authentikClient.getGroupInfo(teamId);
            const subteamPks = teamInfo.subteamPkList;

            if (subteamPks.length === 0) {
                return []; // No subteams, return empty array
            }

            // Fetch all applications for these subteams, populating applicant data
            const applications = await Application.find({
                subteamPk: { $in: subteamPks }
            }).populate('applicantId').lean();

            // Map to Kanban-friendly format
            const kanbanData = applications.map((app: any) => ({
                id: app._id.toString(),
                name: app.applicantId?.fullName || 'Unknown Applicant',
                email: app.applicantId?.email || '',
                column: this.stageToColumn(app.stage),
                role: app.roles?.join(', ') || '',
                roles: app.roles || [],
                subteamPk: app.subteamPk,
                appliedAt: app.appliedAt,
                stage: app.stage
            }));

            return kanbanData;
        } catch (err) {
            console.error("Error fetching applications:", err);
            this.setStatus(500);
            return { error: "ServerError", message: "Failed to fetch applications" };
        }
    }

    private stageToColumn(stage: ApplicationStage): string {
        switch (stage) {
            case ApplicationStage.NEW_APPLICATIONS:
                return 'applied';
            case ApplicationStage.INTERVIEW:
                return 'interviewing';
            case ApplicationStage.HIRED:
                return 'accepted';
            case ApplicationStage.REJECTED:
            case ApplicationStage.REJECTED_AFTER_INTERVIEW:
                return 'rejected';
            default:
                return 'applied';
        }
    }

    @Post("apply")
    @SuccessResponse(201, "Application submitted")
    async applyToSubteam(
        @Body() body: ATSApplicationRequest,
        @Request() request: any
    ) {
        try {
            const { subteamPk, roles, profile, responses } = body;

            const userEmail = request.session?.authorizedUser?.email || request.session?.tempsession?.user?.email;

            if (!userEmail) {
                this.setStatus(401);
                return { error: "Unauthorized", message: "User session not found. Please verify your email." };
            }

            const applicant = await Applicant.findOneAndUpdate(
                { email: userEmail },
                {
                    $set: {
                        profile: profile,
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            if (!applicant) {
                this.setStatus(500);
                return { error: "ApplicantNotFound", message: "Applicant not found." }
            }

            const existingApp = await Application.findOne({
                applicantId: applicant._id,
                subteamPk: subteamPk
            })

            if (existingApp) {
                this.setStatus(409);
                return {
                    error: "Duplicate Application",
                    message: "You have already submitted an application for this subteam."
                };
            }

            const application = await Application.create({
                applicantId: applicant._id,
                subteamPk: subteamPk,
                roles: roles,
                stage: ApplicationStage.NEW_APPLICATIONS,
                responses: new Map(Object.entries(responses)),
                appliedAt: new Date(),
                stageHistory: [{
                    stage: ApplicationStage.NEW_APPLICATIONS,
                    changedAt: new Date()
                }]
            });

            // Add the applicationId to the applicant's applicationIds array
            await Applicant.findByIdAndUpdate(
                applicant._id,
                { $push: { applicationIds: application._id } }
            );

            return {
                message: "Application submitted successfully",
                id: application._id
            }
        } catch (err) {
            this.setStatus(500);
            return {
                error: "ServerError",
                message: "Internal Server Error"
            }
        }
    }






}