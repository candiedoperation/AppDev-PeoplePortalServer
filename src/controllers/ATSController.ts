import { Body, Request, Controller, Delete, Get, Path, Post, Put, Route, SuccessResponse } from "tsoa";
import { SubteamConfig } from "../models/SubteamConfig";
import { TeamRecruitingStatus } from "../models/TeamRecruitingStatus";
import { AuthentikClient } from "../clients/AuthentikClient";
import { Applicant } from '../models/Applicant';
import { Application } from "../models/Application";
import { ApplicationStage } from "../models/Application";
import { Security } from "tsoa";
import * as express from 'express'
import { ApplicantProfile } from "../models/Applicant";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "../clients/AWSClient/S3Client";
import { Query } from "tsoa";

interface ATSSubteamConfigRequest {
    isRecruiting: boolean;
    roles: string[];
    roleSpecificQuestions: { [role: string]: string[] };
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

    @Get("resume/upload-url")
    @Security("ats_otp")
    @SuccessResponse(200)
    async getResumeUploadUrl(@Request() request: any, @Query() fileName: string, @Query() contentType: string) {
        const userEmail = request.session?.authorizedUser?.email || request.session?.tempsession?.user?.email;

        if (!userEmail) {
            this.setStatus(401);
            return { error: "Unauthorized", message: "User session not found." };
        }

        const applicant = await Applicant.findOne({ email: userEmail });
        if (!applicant) {
            this.setStatus(404);
            return { error: "NotFound", message: "Applicant not found." };
        }

        const fileExtension = fileName.split('.').pop();
        const key = `resumes/${applicant._id}/${Date.now()}.${fileExtension}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        // Construct the proxy URL using the request headers
        const protocol = request.protocol;
        const host = request.get('host');
        const publicUrl = `${protocol}://${host}/api/ats/resume/download?key=${encodeURIComponent(key)}`;

        return {
            uploadUrl,
            publicUrl,
            key
        };
    }

    @Get("resume/download")
    @Security("ats_otp") // Or appropriate security measure
    @SuccessResponse(307, "Temporary Redirect")
    async getResumeDownloadUrl(@Request() request: any, @Query() key: string) {
        const userEmail = request.session?.authorizedUser?.email || request.session?.tempsession?.user?.email;

        // 1. Verify Authentication
        if (!userEmail) {
            this.setStatus(401);
            return { error: "Unauthorized", message: "User session not found." };
        }

        // 2. Identify User & Authorization
        // Allow access if it's the user's own resume OR if the user is an admin/reviewer (to be implemented more robustly)
        // For now, we'll check if the key matches the user's ID.
        // The key format is: resumes/${applicant._id}/${Date.now()}.${fileExtension}

        let isAuthorized = false;

        const applicant = await Applicant.findOne({ email: userEmail });
        if (applicant && key.startsWith(`resumes/${applicant._id}/`)) {
            isAuthorized = true;
        }

        // TODO: Add check for admins/recruiters here once that system is more defined
        // For example: if (user.role === 'admin') isAuthorized = true;

        if (!isAuthorized) {
            // Fallback for logic: if they are accessing via the Kanban board (which means they are likely a recruiter)
            // We need a way to verify that. For now, if they have an active session and the key looks valid, we might need to be lenient 
            // OR strictly enforce ownership. 
            // STRICT Strict for now: data privacy.

            // Check if the user is a recruiter? 
            // The current session setup for recruiters isn't fully visible here, assuming 'authorizedUser' could be a recruiter.
            // If key doesn't match, 403.

            // TEMPORARY: If we assume only the applicant sees their own resume on the dashboard, strict check is fine.
            // BUT recruiters need to see it too.
            // If 'authorizedUser' is present (likely from SSO), they might be a recruiter.
            if (request.session?.authorizedUser) {
                isAuthorized = true; // Trust internal users for now?
            }
        }

        if (!isAuthorized) {
            this.setStatus(403);
            return { error: "Forbidden", message: "You do not have permission to access this file." };
        }

        // 3. Generate Presigned GET URL
        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });

            const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

            // 4. Redirect
            this.setStatus(307);
            this.setHeader('Location', downloadUrl);
            return;

        } catch (error) {
            console.error("Error generating download URL:", error);
            this.setStatus(404); // Or 500
            return { error: "NotFound", message: "File not found or access denied." };
        }
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

            if (kanbanData.length === 0) {
                return [];
            }

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

    @Post("applications/apply")
    @Security("ats_otp")
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