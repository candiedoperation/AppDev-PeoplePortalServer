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
        const userEmail = request.session?.tempsession?.user?.email

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
    @Security("ats_otp")
    @SuccessResponse(307, "Temporary Redirect")
    async getResumeDownloadUrl(@Request() request: any, @Query() key: string) {
        const userEmail = request.session?.tempsession?.user?.email

        // 1. Verify Authentication
        if (!userEmail) {
            this.setStatus(401);
            return { error: "Unauthorized", message: "User session not found." };
        }

        const applicant = await Applicant.findOne({ email: userEmail });
        if (!applicant || !key.startsWith(`resumes/${applicant._id}/`)) {
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
                applicantId: app.applicantId?._id,
                name: app.applicantId?.fullName || 'Unknown Applicant',
                email: app.applicantId?.email || '',
                column: this.stageToColumn(app.stage),
                role: app.roles?.join(', ') || '',
                roles: app.roles || [],
                subteamPk: app.subteamPk,
                appliedAt: app.appliedAt,
                stage: app.stage,
                profile: app.applicantId?.profile,
                responses: app.responses || {}
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

    @Get("applications/applicant/{applicantId}/resume")
    @Security("oidc")
    @SuccessResponse(200)
    async getApplicantUrls(@Path() applicantId: string) {
        try {
            const applicant = await Applicant.findById(applicantId);
            if (!applicant) {
                this.setStatus(404);
                return { error: "NotFound", message: "Applicant not found" };
            }

            const profile = applicant.profile || new Map<string, string>();
            let resumeDownloadUrl: string | undefined;

            const resumeUrl = profile.get('resumeUrl');

            if (resumeUrl) {
                try {
                    // Check if it's an S3 key (simple heuristic or assume it is if stored internally)
                    // The upload endpoint stores it as `resumes/${applicant._id}/${Date.now()}.${fileExtension}`
                    // If it looks like a key, sign it.
                    // If it's already a full URL (legacy?), just return it (though our new flow uses keys).

                    // For now, we assume if it doesn't start with http, it's a key.
                    if (!resumeUrl.startsWith('http')) {
                        const command = new GetObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: resumeUrl,
                        });
                        resumeDownloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 mins
                    } else {
                        resumeDownloadUrl = resumeUrl;
                    }

                } catch (s3Error) {
                    console.error("Error signing S3 URL:", s3Error);
                    // Fallback or just ignore, maybe client can deal with the raw key or empty string?
                    // We'll leave it undefined if signing fails.
                }
            }

            return {
                resumeUrl: resumeDownloadUrl,
            };

        } catch (err) {
            console.error("Error fetching applicant URLs:", err);
            this.setStatus(500);
            return { error: "ServerError", message: "Failed to fetch applicant URLs" };
        }
    }


    @Put("applications/{applicationId}/stage")
    @Security("oidc")
    @SuccessResponse(200, "Stage updated")
    async updateApplicationStage(@Path() applicationId: string, @Body() body: { column: string }) {
        try {
            const { column } = body;
            const newStage = this.columnToStage(column);

            const application = await Application.findById(applicationId);
            if (!application) {
                this.setStatus(404);
                return { error: "NotFound", message: "Application not found" };
            }

            // Update stage and history
            application.stage = newStage;
            application.stageHistory.push({
                stage: newStage,
                changedAt: new Date(),
                changedBy: "System/Recruiter" // TODO: Add actual user info from session
            });

            await application.save();

            return {
                message: "Stage updated successfully",
                application: {
                    id: application._id,
                    stage: this.stageToColumn(application.stage),
                    // Return other needed fields if necessary
                }
            };
        } catch (err) {
            console.error("Error updating application stage:", err);
            this.setStatus(500);
            return { error: "ServerError", message: "Failed to update application stage" };
        }
    }

    @Get("applications/applicant/{applicantId}/applications")
    @Security("oidc")
    @SuccessResponse(200)
    async getApplicantApplications(@Path() applicantId: string) {
        try {
            const applications = await Application.find({ applicantId: applicantId }).lean().sort({ appliedAt: -1 });

            const results = await Promise.all(applications.map(async (app: any) => {
                let subteamName = app.subteamPk;
                let parentTeamName = undefined;

                try {
                    const groupInfo = await this.authentikClient.getGroupInfo(app.subteamPk);
                    if (groupInfo && groupInfo.attributes && groupInfo.attributes.friendlyName) {
                        subteamName = groupInfo.attributes.friendlyName;
                    } else if (groupInfo && groupInfo.name) {
                        subteamName = groupInfo.name;
                    }

                    if (groupInfo && groupInfo.parentPk) {
                        try {
                            const parentGroupInfo = await this.authentikClient.getGroupInfo(groupInfo.parentPk);
                            if (parentGroupInfo && parentGroupInfo.attributes && parentGroupInfo.attributes.friendlyName) {
                                parentTeamName = parentGroupInfo.attributes.friendlyName;
                            } else if (parentGroupInfo && parentGroupInfo.name) {
                                parentTeamName = parentGroupInfo.name;
                            }
                        } catch (e) {
                            console.error(`Failed to fetch parent group info for ${groupInfo.parentPk}`, e);
                        }
                    }

                } catch (e) {
                    console.error(`Failed to fetch group info for ${app.subteamPk}`, e);
                }

                return {
                    id: app._id,
                    subteamPk: app.subteamPk,
                    subteamName: subteamName,
                    parentTeamName: parentTeamName,
                    roles: app.roles,
                    stage: this.stageToColumn(app.stage),
                    appliedAt: app.appliedAt,
                };
            }));

            return results;

        } catch (err) {
            console.error("Error fetching applicant applications:", err);
            this.setStatus(500);
            return { error: "ServerError", message: "Failed to fetch applicant history" };
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

    private columnToStage(column: string): ApplicationStage {
        switch (column) {
            case 'applied':
                return ApplicationStage.NEW_APPLICATIONS;
            case 'interviewing':
                return ApplicationStage.INTERVIEW;
            case 'accepted':
                return ApplicationStage.HIRED;
            case 'rejected':
                return ApplicationStage.REJECTED;
            default:
                return ApplicationStage.NEW_APPLICATIONS;
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

            // 1. Basic Structure Validation
            if (!subteamPk || !roles || roles.length === 0 || !profile) {
                this.setStatus(400);
                return {
                    error: "InvalidRequest",
                    message: "You have not provided the required information."
                };
            }

            const userEmail = request.session?.tempsession?.user?.email
            if (!userEmail) {
                this.setStatus(401);
                return { error: "Unauthorized", message: "User session not found. Please verify your email." };
            }

            // 2. Fetch Subteam Configuration & Verify Recruiting Status
            const config = await SubteamConfig.findOne({ subteamPk }).exec();
            if (!config || !config.isRecruiting) {
                this.setStatus(403);
                return {
                    error: "RecruitmentClosed",
                    message: "This subteam is not currently accepting applications."
                };
            }

            // 3. Validate Roles
            const allowedRoles = new Set(config.roles);
            for (const role of roles) {
                if (!allowedRoles.has(role)) {
                    this.setStatus(400);
                    return { error: "InvalidRole", message: `The role '${role}' is not valid for this subteam.` };
                }
            }

            // 4. Validate Personal Profile (PERSONAL_INFO_FIELDS)
            const requiredProfileFields = [
                'resumeUrl', 'whyAppDev', 'instagramFollow'
            ];

            for (const field of requiredProfileFields) {
                if (!profile[field] || (typeof profile[field] === 'string' && profile[field].trim() === '')) {
                    this.setStatus(400);
                    return { error: "MissingRequiredField", message: `Please provide your ${field}.` };
                }
            }

            // Profile-specific logic (URLs are now optional, but if provided, we can still validate them if we want, or just skip)
            if (profile.linkedinUrl && profile.linkedinUrl.trim() !== "" && !profile.linkedinUrl.includes("linkedin.com")) {
                this.setStatus(400);
                return { error: "InvalidURL", message: "Please provide a valid LinkedIn URL if you choose to include one." };
            }
            if (profile.githubUrl && profile.githubUrl.trim() !== "" && !profile.githubUrl.includes("github.com")) {
                this.setStatus(400);
                return { error: "InvalidURL", message: "Please provide a valid GitHub URL if you choose to include one." };
            }

            const whyAppDevWords = profile.whyAppDev?.trim().split(/\s+/).filter(Boolean).length || 0;
            if (whyAppDevWords > 200) {
                this.setStatus(400);
                return { error: "WordCountExceeded", message: "Your 'Why App Dev' response must be 200 words or less." };
            }

            // 5. Validate Role-Specific Responses
            const authentikSubteamInfo = await this.authentikClient.getGroupInfo(subteamPk);
            const parentInfo = await this.authentikClient.getGroupInfo(authentikSubteamInfo.parentPk);
            const parentName = parentInfo.attributes.friendlyName || parentInfo.name;
            const parentQuestionKey = `Why are you interested in ${parentName}?`;

            if (!responses[parentQuestionKey] || responses[parentQuestionKey].trim() === '') {
                this.setStatus(400);
                return { error: "MissingResponse", message: `Please answer: ${parentQuestionKey}` };
            }

            for (const role of roles) {
                const questions = config.roleSpecificQuestions.get(role) || [];
                for (const question of questions) {
                    if (!responses[question] || responses[question].trim() === '') {
                        this.setStatus(400);
                        return { error: "MissingResponse", message: `Please answer the question for the ${role} role.` };
                    }
                }
            }

            // 6. Database Operations
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

            const existingApp = await Application.findOne({
                applicantId: applicant._id,
                subteamPk: subteamPk
            });

            if (existingApp) {
                this.setStatus(409);
                return {
                    error: "DuplicateApplication",
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

            await Applicant.findByIdAndUpdate(
                applicant._id,
                { $push: { applicationIds: application._id } }
            );

            return {
                message: "Application submitted successfully",
                id: application._id
            };
        } catch (err) {
            this.setStatus(500);
            console.error(err);
            return {
                error: "ServerError",
                message: "Internal Server Error"
            }
        }
    }

    @Post("profile")
    @Security("ats_otp")
    @SuccessResponse(200, "Profile Updated")
    async updateProfile(@Body() body: ApplicantProfile, @Request() request: any) {
        try {
            const userEmail = request.session?.tempsession?.user?.email
            if (!userEmail) {
                this.setStatus(401);
                return { error: "Unauthorized", message: "User session not found." };
            }

            const applicant = await Applicant.findOne({ email: userEmail });
            if (!applicant) {
                this.setStatus(404);
                return { error: "NotFound", message: "Applicant not found." };
            }

            // Merge existing profile with new updates
            const currentProfile = applicant.profile ? Object.fromEntries(applicant.profile) : {};
            const updatedProfile = { ...currentProfile, ...body };

            await Applicant.findOneAndUpdate(
                { email: userEmail },
                {
                    $set: {
                        profile: updatedProfile,
                        updatedAt: new Date()
                    }
                }
            );

            return { message: "Profile updated successfully" };

        } catch (err) {
            console.error("Error updating profile:", err);
            this.setStatus(500);
            return { error: "ServerError", message: "Failed to update profile" };
        }
    }
}