import { Body, Request, Controller, Delete, Get, Path, Post, Put, Route, SuccessResponse } from "tsoa";
import { SubteamConfig, ISubteamConfig } from "../models/SubteamConfig";
import { TeamRecruitingStatus, ITeamRecruitingStatus } from "../models/TeamRecruitingStatus";
import { AuthentikClient } from "../clients/AuthentikClient";
import { GetGroupInfoResponse, UserInformationBrief } from "../clients/AuthentikClient/models";
import { Applicant, IApplicant, ApplicantProfile } from '../models/Applicant';
import { Application, IApplication, ApplicationStage } from "../models/Application";
import { Security } from "tsoa";
import * as express from 'express'
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "../clients/AWSClient/S3Client";
import { Query } from "tsoa";
import { EmailClient } from "../clients/EmailClient";
import { OrgController } from "./OrgController";
import { AuthorizedUser } from "../clients/OpenIdClient";

// ====================
// Type Definitions
// ====================

interface ATSSubteamConfigRequest {
    isRecruiting: boolean;
    roles: string[];
    roleSpecificQuestions: { [role: string]: string[] };
}

// Team-level application request with ordered role preferences
interface ATSTeamApplicationRequest {
    teamPk: string;
    rolePreferences: { role: string, subteamPk: string }[];  // Ordered array
    profile: ApplicantProfile;
    responses: Record<string, string>;
}

// Response format for Kanban board
interface KanbanApplicationCard {
    id: string;
    applicantId: string;
    name: string;
    email: string;
    column: string;
    rolePreferences: { role: string, subteamPk: string }[];  // Ordered role preferences
    appliedAt: Date;
    stage: ApplicationStage;
    stageHistory?: {
        stage: ApplicationStage;
        changedAt: Date;
        changedBy?: string;
    }[];
    profile: Record<string, string>;
    responses: Record<string, string>;
    hiredRole: string | undefined;
}

// Constants
const ALLOWED_RESUME_EXTENSIONS = ['pdf'] as const;
const ALLOWED_CONTENT_TYPES = ['application/pdf'] as const;
const MAX_RESPONSE_LENGTH = 500;
const MAX_WHY_APPDEV_WORDS = 200;
const MIN_RESPONSE_WORDS = 10;

@Route("/api/ats")
export class ATSController extends Controller {
    private readonly authentikClient: AuthentikClient;
    private readonly emailClient: EmailClient;
    private readonly orgController: OrgController;

    constructor() {
        super()
        this.authentikClient = new AuthentikClient()
        this.emailClient = new EmailClient()
        this.orgController = new OrgController()
    }

    @Get("resume/upload-url")
    @Security("ats_otp")
    @SuccessResponse(200)
    async getResumeUploadUrl(@Request() request: any, @Query() fileName: string, @Query() contentType: string) {
        const userEmail = request.session?.tempsession?.user?.email;

        if (!userEmail) {
            this.setStatus(401);
            return { error: "Unauthorized", message: "User session not found." };
        }

        // Validate PDF only
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        if (!fileExtension || !ALLOWED_RESUME_EXTENSIONS.includes(fileExtension as any)) {
            this.setStatus(400);
            return {
                error: "InvalidFileType",
                message: `Only PDF resumes are accepted. Allowed types: ${ALLOWED_RESUME_EXTENSIONS.join(', ')}`
            };
        }

        if (!ALLOWED_CONTENT_TYPES.includes(contentType as any)) {
            this.setStatus(400);
            return { error: "InvalidContentType", message: "Invalid content type. Only PDF is accepted." };
        }

        // Prevent path traversal
        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
            this.setStatus(400);
            return { error: "InvalidFileName", message: "Invalid file name" };
        }

        const applicant = await Applicant.findOne({ email: userEmail }).exec();
        if (!applicant) {
            // Create applicant if doesn't exist yet
            const newApplicant = await Applicant.create({
                email: userEmail,
                fullName: userEmail.split('@')[0],
                profile: new Map()
            });
            const key = `resumes/${newApplicant._id}/${Date.now()}.${fileExtension}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                ContentType: contentType,
            });

            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

            const protocol = request.protocol;
            const host = request.get('host');
            const publicUrl = `${protocol}://${host}/api/ats/resume/download?key=${encodeURIComponent(key)}`;

            return { uploadUrl, publicUrl, key };
        }

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
        const recruitingTeams: any[] = await TeamRecruitingStatus.find({ isRecruiting: true }).lean().exec();

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

    @Get("stages")
    @SuccessResponse(200)
    async getApplicationStages() {
        // Return the ApplicationStage enum as an array of {id, name} objects
        const stages = Object.entries(ApplicationStage).map(([key, value]) => ({
            id: value,
            name: value
        }));

        return stages;
    }

    @Get("teams/{teamId}")
    @SuccessResponse(200)
    async getTeamDetails(@Path() teamId: string) {
        try {
            // Get team info from Authentik
            const teamInfo = await this.authentikClient.getGroupInfo(teamId);

            // Get team recruiting status
            const teamStatus = await TeamRecruitingStatus.findOne({ teamPk: teamId }).exec();

            if (!teamStatus || !teamStatus.isRecruiting) {
                this.setStatus(403);
                return {
                    error: "NotRecruiting",
                    message: "This team is not currently recruiting"
                };
            }

            // Fetch configs for all recruiting subteams
            const recruitingSubteams = await Promise.all(
                teamStatus.recruitingSubteamPks.map(async (subteamPk) => {
                    const config = await SubteamConfig.findOne({ subteamPk }).exec();
                    const subteamInfo = await this.authentikClient.getGroupInfo(subteamPk);

                    return {
                        subteamPk: subteamPk,
                        friendlyName: subteamInfo.attributes.friendlyName || subteamInfo.name,
                        description: subteamInfo.attributes.description,
                        roles: config?.roles || [],
                        roleSpecificQuestions: config?.roleSpecificQuestions ?
                            Object.fromEntries(config.roleSpecificQuestions.entries()) : {}
                    };
                })
            );

            return {
                teamPk: teamId,
                teamInfo: {
                    name: teamInfo.name,
                    friendlyName: teamInfo.attributes.friendlyName,
                    description: teamInfo.attributes.description,
                    seasonText: `${teamInfo.attributes.seasonType} ${teamInfo.attributes.seasonYear}`,
                    pk: teamInfo.pk
                },
                recruitingSubteams: recruitingSubteams
            };

        } catch (err) {
            console.error("Error fetching team details:", err);
            this.setStatus(500);
            return {
                error: "ServerError",
                message: "Failed to fetch team details"
            };
        }
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
    async getTeamApplications(@Path() teamId: string): Promise<KanbanApplicationCard[]> {
        try {
            // Fetch all applications for this team directly - ONE per applicant!
            const applications = await Application.find({
                teamPk: teamId
            })
                .populate<{ applicantId: IApplicant }>('applicantId')
                .lean()
                .exec();

            // Map to Kanban-friendly format
            const kanbanData: KanbanApplicationCard[] = applications.map((app) => ({
                id: app._id.toString(),
                applicantId: app.applicantId._id.toString(),
                name: app.applicantId.fullName || 'Unknown Applicant',
                email: app.applicantId.email || '',
                column: app.stage,  // Use the enum value directly
                rolePreferences: app.rolePreferences,
                appliedAt: app.appliedAt,
                stage: app.stage,
                stageHistory: app.stageHistory,
                appDevInternalPk: app.appDevInternalPk,
                profile: app.applicantId.profile as any,
                responses: app.responses as any,
                hiredRole: app.hiredRole || undefined
            }));

            return kanbanData;
        } catch (err) {
            console.error("Error fetching applications:", err);
            this.setStatus(500);
            throw new Error("Failed to fetch applications");
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
    async updateApplicationStage(
        @Request() req: express.Request,
        @Path() applicationId: string,
        @Body() body: { stage: ApplicationStage, interviewLink?: string, interviewGuidelines?: string, hiredRole?: string, hiredSubteamPk?: string }
    ) {
        try {
            const { stage, interviewLink, interviewGuidelines, hiredRole, hiredSubteamPk } = body;

            const application = await Application.findById(applicationId);
            if (!application) {
                this.setStatus(404);
                return { error: "NotFound", message: "Application not found" };
            }

            const applicant = await Applicant.findById(application.applicantId);
            if (!applicant) {
                this.setStatus(404);
                return { error: "NotFound", message: "Applicant not found" };
            }

            const currentStage = application.stage;

            // Idempotency check
            if (currentStage === stage) {
                return { message: "Stage already set", application: { id: application._id, stage: application.stage } };
            }

            // Transition Validation
            const VALID_TRANSITIONS: Record<string, ApplicationStage[]> = {
                [ApplicationStage.APPLIED]: [ApplicationStage.INTERVIEW, ApplicationStage.REJECTED],
                [ApplicationStage.INTERVIEW]: [ApplicationStage.POTENTIAL_HIRE, ApplicationStage.HIRED, ApplicationStage.REJECTED],
                [ApplicationStage.POTENTIAL_HIRE]: [ApplicationStage.HIRED, ApplicationStage.REJECTED],
                [ApplicationStage.HIRED]: [],
                [ApplicationStage.REJECTED]: []
            };

            const allowed = VALID_TRANSITIONS[currentStage] || [];
            if (!allowed.includes(stage)) {
                this.setStatus(400);
                return { error: "BadRequest", message: `Invalid transition from ${currentStage} to ${stage}` };
            }

            // Mandatory Field Checks
            if (stage === ApplicationStage.INTERVIEW) {
                if (!interviewLink) {
                    this.setStatus(400);
                    return { error: "BadRequest", message: "Interview Link is required for Interview stage" };
                }

                if (!interviewGuidelines || interviewGuidelines.length < 50 || interviewGuidelines.length > 500) {
                    this.setStatus(400);
                    return { error: "BadRequest", message: "Interview Guidelines are required (50-500 characters)" };
                }
            }

            if (stage === ApplicationStage.HIRED) {
                if (!hiredRole || !hiredSubteamPk) {
                    this.setStatus(400);
                    return { error: "BadRequest", message: "Hired Role and Subteam are required for Hired stage" };
                }

                /* Add Hired Role and Hired Subteam PK to the Application */
                application.hiredRole = hiredRole;
                application.hiredSubteamPk = hiredSubteamPk;
            }

            // Update stage and history
            application.stage = stage;
            application.stageHistory.push({
                stage: stage,
                changedAt: new Date(),
                changedBy: `${req.session.authorizedUser?.name} (${req.session.authorizedUser?.username})`
            });

            /* Save the Application and Send Emails */
            await application.save();

            /* Get Parent Team Information and Handle Stage Specific Logic */
            const teamInfo = await this.authentikClient.getGroupInfo(application.teamPk);
            if (stage === ApplicationStage.INTERVIEW) {
                await this.emailClient.send({
                    to: applicant.email,
                    cc: [req.session.authorizedUser!.email],
                    replyTo: [req.session.authorizedUser!.email],
                    subject: `Next Steps: ${teamInfo.attributes.friendlyName} Interview`,
                    templateName: "RecruitInterviewRequest",
                    templateVars: {
                        applicantName: applicant.fullName,
                        interviewerName: req.session.authorizedUser!.name,
                        teamName: teamInfo.attributes.friendlyName,
                        interviewLink: interviewLink,
                        interviewGuidelines: interviewGuidelines
                    }
                })
            } else if (stage === ApplicationStage.POTENTIAL_HIRE) {
                await this.emailClient.send({
                    to: applicant.email,
                    cc: [req.session.authorizedUser!.email],
                    replyTo: [req.session.authorizedUser!.email],
                    subject: `Waitlisted for ${teamInfo.attributes.friendlyName}`,
                    templateName: "RecruitPotentialHireInfo",
                    templateVars: {
                        applicantName: applicant.fullName,
                        teamName: teamInfo.attributes.friendlyName,
                        contactName: req.session.authorizedUser!.name
                    }
                })
            } else if (stage === ApplicationStage.HIRED) {
                this.processHiredStageTransition(
                    req.session.authorizedUser!, teamInfo,
                    application, applicant
                );
            } else if (stage === ApplicationStage.REJECTED) {
                await this.emailClient.send({
                    to: applicant.email,
                    cc: [req.session.authorizedUser!.email],
                    replyTo: [req.session.authorizedUser!.email],
                    subject: `Update on ${teamInfo.attributes.friendlyName}`,
                    templateName: "RecruitApplicationDeclined",
                    templateVars: {
                        applicantName: applicant.fullName,
                        teamName: teamInfo.attributes.friendlyName,
                    }
                })
            }

            return {
                message: "Stage updated successfully",
                application: {
                    id: application._id,
                    stage: application.stage,
                    hiredRole: application.hiredRole
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
            const applications = await Application.find({ applicantId: applicantId })
                .lean()
                .sort({ appliedAt: -1 })
                .exec();

            const results = await Promise.all(applications.map(async (app: any) => {
                let teamName = app.teamPk;

                try {
                    const teamInfo = await this.authentikClient.getGroupInfo(app.teamPk);
                    if (teamInfo && teamInfo.attributes && teamInfo.attributes.friendlyName) {
                        teamName = teamInfo.attributes.friendlyName;
                    } else if (teamInfo && teamInfo.name) {
                        teamName = teamInfo.name;
                    }
                } catch (e) {
                    console.error(`Failed to fetch team info for ${app.teamPk}`, e);
                }

                // Enrich role preferences with subteam names
                const rolePreferencesWithNames = await Promise.all((app.rolePreferences || []).map(async (pref: any) => {
                    let subteamName = pref.subteamPk;
                    try {
                        const subteamInfo = await this.authentikClient.getGroupInfo(pref.subteamPk);
                        subteamName = subteamInfo.attributes?.friendlyName || subteamInfo.name;
                    } catch (e) {
                        console.error(`Failed to fetch subteam info for ${pref.subteamPk}`, e);
                    }
                    return { ...pref, subteamName };
                }));

                return {
                    id: app._id,
                    teamPk: app.teamPk,
                    teamName: teamName,
                    rolePreferences: rolePreferencesWithNames,
                    stage: app.stage,
                    appliedAt: app.appliedAt,
                    hiredRole: app.hiredRole
                };
            }));

            return results;

        } catch (err) {
            console.error("Error fetching applicant applications:", err);
            this.setStatus(500);
            return { error: "ServerError", message: "Failed to fetch applicant history" };
        }
    }


    @Post("applications/apply")
    @Security("ats_otp")
    @SuccessResponse(201, "Application submitted")
    async applyToTeam(
        @Body() body: ATSTeamApplicationRequest,
        @Request() request: any
    ) {
        try {
            const { teamPk, rolePreferences, profile, responses } = body;

            // 1. Basic Validation
            if (!teamPk || !rolePreferences || rolePreferences.length === 0 || !profile) {
                this.setStatus(400);
                return {
                    error: "InvalidRequest",
                    message: "TeamPk, role preferences, and profile are required."
                };
            }

            const userEmail = request.session?.tempsession?.user?.email;
            if (!userEmail) {
                this.setStatus(401);
                return { error: "Unauthorized", message: "User session not found. Please verify your email." };
            }

            // 2. Verify team exists and is recruiting
            const teamInfo: GetGroupInfoResponse = await this.authentikClient.getGroupInfo(teamPk);
            const teamStatus = await TeamRecruitingStatus.findOne({ teamPk }).exec();

            if (!teamStatus || !teamStatus.isRecruiting) {
                this.setStatus(403);
                return {
                    error: "RecruitmentClosed",
                    message: "This team is not currently accepting applications."
                };
            }

            // 3. Collect all available roles from recruiting subteams
            const allAvailableRoles = new Set<string>();
            const allQuestions = new Set<string>();

            for (const subteamPk of teamStatus.recruitingSubteamPks) {
                const config = await SubteamConfig.findOne({ subteamPk }).exec();
                if (config && config.isRecruiting) {
                    config.roles.forEach(role => allAvailableRoles.add(role));
                }
            }

            // 4. Validate all selected roles are available
            for (const pref of rolePreferences) {
                // Check if the subteam actually offers this role
                const subteamConfig = await SubteamConfig.findOne({ subteamPk: pref.subteamPk }).exec();
                if (!subteamConfig || !subteamConfig.isRecruiting || !subteamConfig.roles.includes(pref.role)) {
                    this.setStatus(400);
                    return {
                        error: "InvalidRole",
                        message: `Role '${pref.role}' is not available in the specified subteam`
                    };
                }
            }

            // 5. Collect role-specific questions for selected roles
            for (const subteamPk of teamStatus.recruitingSubteamPks) {
                const config = await SubteamConfig.findOne({ subteamPk }).exec();
                if (config && config.isRecruiting) {
                    if (config && config.isRecruiting) {
                        for (const pref of rolePreferences) {
                            if (pref.subteamPk === subteamPk) { // Only check if this preference belongs to this subteam
                                if (config.roles.includes(pref.role)) {
                                    const roleQuestions = config.roleSpecificQuestions.get(pref.role) || [];
                                    roleQuestions.forEach(q => allQuestions.add(q));
                                }
                            }
                        }
                    }
                }
            }

            // 6. Validate personal profile
            if (!profile.resumeUrl || profile.resumeUrl.trim() === '') {
                this.setStatus(400);
                return { error: "MissingRequiredField", message: "Resume URL is required" };
            }

            if (!profile.resumeUrl.toLowerCase().endsWith('.pdf')) {
                this.setStatus(400);
                return { error: "InvalidFileType", message: "Only PDF resumes are accepted" };
            }

            if (!profile.whyAppDev || profile.whyAppDev.trim() === '') {
                this.setStatus(400);
                return { error: "MissingRequiredField", message: "Please provide 'Why App Dev'" };
            }

            if (!profile.instagramFollow || profile.instagramFollow.trim() === '') {
                this.setStatus(400);
                return { error: "MissingRequiredField", message: "Please confirm Instagram follow" };
            }

            if (profile.linkedinUrl && profile.linkedinUrl.trim() !== "") {
                try { new URL(profile.linkedinUrl) } catch {
                    this.setStatus(400);
                    return { error: "InvalidURL", message: "Please provide a valid LinkedIn URL" };
                }
            }

            if (profile.githubUrl && profile.githubUrl.trim() !== "") {
                try { new URL(profile.githubUrl) } catch {
                    this.setStatus(400);
                    return { error: "InvalidURL", message: "Please provide a valid GitHub URL" };
                }
            }

            const whyAppDevWords = profile.whyAppDev.trim().split(/\s+/).filter(Boolean).length;
            if (whyAppDevWords > MAX_WHY_APPDEV_WORDS) {
                this.setStatus(400);
                return {
                    error: "WordCountExceeded",
                    message: `'Why App Dev' must be ${MAX_WHY_APPDEV_WORDS} words or less`
                };
            }

            // 7. Validate responses - Team question
            const teamName = teamInfo.attributes.friendlyName || teamInfo.name;
            const teamQuestionKey = `Why are you interested in ${teamName}?`;
            allQuestions.add(teamQuestionKey);

            for (const question of Array.from(allQuestions)) {
                if (!responses[question] || responses[question].trim() === '') {
                    this.setStatus(400);
                    return {
                        error: "MissingResponse",
                        message: `Please answer: ${question}`
                    };
                }

                if (responses[question].length > MAX_RESPONSE_LENGTH) {
                    this.setStatus(400);
                    return {
                        error: "ResponseTooLong",
                        message: `Response too long for: ${question}. Maximum ${MAX_RESPONSE_LENGTH} characters.`
                    };
                }

                const wordCount = responses[question].trim().split(/\s+/).filter(Boolean).length;
                if (wordCount < MIN_RESPONSE_WORDS) {
                    this.setStatus(400);
                    return {
                        error: "ResponseTooShort",
                        message: `Response too short for: ${question}. Please provide at least ${MIN_RESPONSE_WORDS} words.`
                    };
                }
            }

            // 8. Check for duplicate application
            const applicant = await Applicant.findOne({ email: userEmail }).exec();

            if (applicant) {
                const existingApp = await Application.findOne({
                    applicantId: applicant._id,
                    teamPk: teamPk
                }).exec();

                if (existingApp) {
                    this.setStatus(409);
                    return {
                        error: "DuplicateApplication",
                        message: "You have already applied to this team."
                    };
                }
            }

            // 9. Create/update applicant
            const updatedApplicant = await Applicant.findOneAndUpdate(
                { email: userEmail },
                {
                    $set: {
                        email: userEmail,
                        fullName: request.session.tempsession?.user?.name || userEmail.split('@')[0],
                        profile: new Map(Object.entries(profile)),
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).exec();

            // 9.5 Check Previous App Dev History, if exists!
            let appDevInternalPk = null;
            try {
                const internalUser = await this.authentikClient.getUserInfoFromEmail(userEmail)
                appDevInternalPk = internalUser.pk
            } catch (_e) {
                /* Not previously in App Dev */
            }

            // 10. Create application with ordered role preferences
            const application = await Application.create({
                applicantId: updatedApplicant._id,
                teamPk: teamPk,
                rolePreferences: rolePreferences,  // Ordered array of roles
                stage: ApplicationStage.APPLIED,
                responses: new Map(Object.entries(responses)),
                appliedAt: new Date(),
                appDevInternalPk,
                stageHistory: [{
                    stage: ApplicationStage.APPLIED,
                    changedAt: new Date()
                }]
            });

            await Applicant.findByIdAndUpdate(
                updatedApplicant._id,
                { $push: { applicationIds: application._id } }
            ).exec();

            return {
                message: "Application submitted successfully",
                id: application._id
            };

        } catch (err) {
            console.error("Application submission error:", err);
            this.setStatus(500);
            return {
                error: "ServerError",
                message: "Failed to submit application"
            };
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

    /* ==== APPLICATION STAGE CHANGE EMAIL HELPERS ==== */
    async processHiredStageTransition(authorizedUser: AuthorizedUser, teamInfo: GetGroupInfoResponse, application: IApplication, applicant: IApplicant) {
        /* If Applicant is an internal member, we do not send onboard invites! */
        const applicantEmail = applicant.email;
        this.authentikClient.getUserInfoFromEmail(applicantEmail).then(async (user: UserInformationBrief) => {
            /* We didn't fail so, Add the Member to the Team & Send Email */
            await this.orgController.addTeamMember(application.hiredSubteamPk!, { userPk: +user.pk });
            await this.emailClient.send({
                to: applicantEmail,
                cc: [authorizedUser.email],
                replyTo: [authorizedUser.email],
                subject: `Congrats! You're accepted to ${teamInfo.attributes.friendlyName}`,
                templateName: "RecruitExistingMemberAcceptance",
                templateVars: {
                    inviteeName: applicant.fullName,
                    invitorName: authorizedUser.name,
                    teamName: teamInfo.attributes.friendlyName,
                    roleTitle: application.hiredRole!,
                }
            })
        }).catch(async () => {
            /* Onboard the User */
            await this.orgController.createInvite(
                { session: { authorizedUser } },
                {
                    inviteeName: applicant.fullName,
                    inviteeEmail: applicantEmail,
                    roleTitle: application.hiredRole!,
                    teamPk: application.teamPk,
                    subteamPk: application.hiredSubteamPk!
                }
            )
        })
    }
}