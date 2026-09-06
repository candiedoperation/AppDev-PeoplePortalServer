/**
  People Portal Server
  Copyright (C) 2026  Atheesh Thirumalairajan

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
*/

import {
    Controller,
    Get,
    Path,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Application, ApplicationStage } from "../models/Application";
import { Applicant, IApplicant } from "../models/Applicant";
import { AuthentikClient } from "../clients/AuthentikClient";
import { BUCKET_NAME, s3Client } from "../clients/AWSClient/S3Client";
import { CustomValidationError } from "../utils/errors";

export interface APIHorizonsHealthResponse {
    status: "ok";
    serverTime: Date;
}

export interface APIHorizonsMemberApplicant {
    applicantId: string;
    name: string;
    email: string;
    resumeAvailable: boolean;
}

export interface APIHorizonsMemberRecruitingResponse {
    memberPk: number;
    applicants: APIHorizonsMemberApplicant[];
    applicationCount: number;
    teamCount: number;
    teamPks: string[];
    stageCounts: Record<ApplicationStage, number>;
    interviewedApplications: number;
    interviewEvents: number;
    firstInterviewAt: Date | null;
    lastInterviewAt: Date | null;
    averageStars: number | null;
    applicationsWithFeedback: number;
    resumeAvailable: boolean;
}

export interface APIHorizonsMemberApplication {
    applicationId: string;
    applicantId: string;
    appDevInternalPk: number;
    teamPk: string;
    applicantName: string;
    email: string;
    stage: ApplicationStage;
    rolePreferences: { role: string; subteamPk: string }[];
    appliedAt: Date;
    stars: number;
    notes: string | null;
    stageHistory: {
        stage: ApplicationStage;
        changedAt: Date;
        changedBy?: string;
    }[];
    hiredRole: string | null;
    hiredSubteamPk: string | null;
    profile: Record<string, string>;
    responses: Record<string, string>;
    resumeAvailable: boolean;
}

export interface APIHorizonsMemberApplicationsResponse {
    memberPk: number;
    applications: APIHorizonsMemberApplication[];
}

export interface APIHorizonsMemberResumeResponse {
    memberPk: number;
    applicantId: string;
    resumeAvailable: boolean;
    resumeUrl: string | null;
    expiresInSeconds: number | null;
}

type PopulatedApplication = {
    _id: unknown;
    applicantId: IApplicant;
    teamPk: string;
    rolePreferences: { role: string; subteamPk: string }[];
    stage: ApplicationStage;
    responses: unknown;
    appliedAt: Date;
    stageHistory: {
        stage: ApplicationStage;
        changedAt: Date;
        changedBy?: string;
    }[];
    hiredRole?: string;
    hiredSubteamPk?: string;
    appDevInternalPk?: number;
    stars: number;
    notes?: string;
};

/**
 * Read-only member recruiting data for AppDev Horizons.
 *
 * Every endpoint except the liveness probe uses the sessionless Horizons
 * service key. Lookups are restricted to the internal member PK stored on an
 * application; applicant ids, Mongo ids, and email addresses are not accepted
 * as lookup keys.
 */
@Route("/api/horizons")
export class HorizonsController extends Controller {
    @Get("health")
    @Tags("Horizons Recruiting")
    @SuccessResponse(200)
    public async getHealth(): Promise<APIHorizonsHealthResponse> {
        return { status: "ok", serverTime: new Date() };
    }

    @Get("members/{appDevInternalPk}/recruiting")
    @Tags("Horizons Recruiting")
    @SuccessResponse(200)
    @Security("horizons")
    public async getMemberRecruiting(
        @Path() appDevInternalPk: number,
    ): Promise<APIHorizonsMemberRecruitingResponse> {
        const applications = await this.getMemberApplications(appDevInternalPk);
        if (applications.length === 0)
            throw new CustomValidationError(404, "Member recruiting history not found");

        const stageCounts = HorizonsController.emptyStageCounts();
        const teamPks = new Set<string>();
        const applicantById = new Map<string, APIHorizonsMemberApplicant>();
        const interviewDates: Date[] = [];
        let interviewedApplications = 0;
        let interviewEvents = 0;
        let applicationsWithFeedback = 0;
        let starsTotal = 0;

        for (const application of applications) {
            const applicant = this.requireApplicant(application);
            const applicantId = String(applicant._id);
            const resumeAvailable = HorizonsController.hasResume(applicant);

            if (application.stage in stageCounts)
                stageCounts[application.stage] += 1;
            teamPks.add(application.teamPk);
            starsTotal += application.stars ?? 0;
            if (application.notes?.trim()) applicationsWithFeedback += 1;

            const applicationInterviews = (application.stageHistory ?? [])
                .filter((entry) => entry.stage === ApplicationStage.INTERVIEW);
            if (applicationInterviews.length > 0) interviewedApplications += 1;
            interviewEvents += applicationInterviews.length;
            interviewDates.push(...applicationInterviews.map((entry) => new Date(entry.changedAt)));

            applicantById.set(applicantId, {
                applicantId,
                name: applicant.fullName || "Unknown Applicant",
                email: applicant.email || "",
                resumeAvailable,
            });
        }

        interviewDates.sort((a, b) => a.getTime() - b.getTime());
        return {
            memberPk: appDevInternalPk,
            applicants: [...applicantById.values()],
            applicationCount: applications.length,
            teamCount: teamPks.size,
            teamPks: [...teamPks],
            stageCounts,
            interviewedApplications,
            interviewEvents,
            firstInterviewAt: interviewDates[0] ?? null,
            lastInterviewAt: interviewDates[interviewDates.length - 1] ?? null,
            averageStars: applications.length > 0
                ? Math.round((starsTotal / applications.length) * 100) / 100
                : null,
            applicationsWithFeedback,
            resumeAvailable: [...applicantById.values()].some((applicant) => applicant.resumeAvailable),
        };
    }

    @Get("members/{appDevInternalPk}/applications")
    @Tags("Horizons Recruiting")
    @SuccessResponse(200)
    @Security("horizons")
    public async getMemberApplicationsDetails(
        @Path() appDevInternalPk: number,
    ): Promise<APIHorizonsMemberApplicationsResponse> {
        const applications = await this.getMemberApplications(appDevInternalPk);
        if (applications.length === 0)
            throw new CustomValidationError(404, "Member recruiting history not found");

        return {
            memberPk: appDevInternalPk,
            applications: applications.map((application) => this.toMemberApplication(application)),
        };
    }

    @Get("members/{appDevInternalPk}/resume")
    @Tags("Horizons Recruiting")
    @SuccessResponse(200)
    @Security("horizons")
    public async getMemberResume(
        @Path() appDevInternalPk: number,
    ): Promise<APIHorizonsMemberResumeResponse> {
        const applications = await this.getMemberApplications(appDevInternalPk);
        if (applications.length === 0)
            throw new CustomValidationError(404, "Member recruiting history not found");

        const applicantIds = [...new Set(applications.map((application) => {
            return String(this.requireApplicant(application)._id);
        }))];
        if (applicantIds.length !== 1)
            throw new CustomValidationError(409, "Member maps to multiple applicant profiles");

        const applicant = this.requireApplicant(applications[0]!);
        const applicantId = String(applicant._id);
        const resumeKey = HorizonsController.getCanonicalResumeKey(applicant);
        if (!resumeKey) {
            return {
                memberPk: appDevInternalPk,
                applicantId,
                resumeAvailable: false,
                resumeUrl: null,
                expiresInSeconds: null,
            };
        }

        try {
            const resumeUrl = await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: BUCKET_NAME, Key: resumeKey }),
                { expiresIn: 900 },
            );
            return { memberPk: appDevInternalPk, applicantId, resumeAvailable: true, resumeUrl, expiresInSeconds: 900 };
        } catch (error) {
            console.error("HorizonsController: member resume signing failed:", error);
            return {
                memberPk: appDevInternalPk,
                applicantId,
                resumeAvailable: false,
                resumeUrl: null,
                expiresInSeconds: null,
            };
        }
    }

    private async getMemberApplications(appDevInternalPk: number): Promise<PopulatedApplication[]> {
        const linkedApplications = await this.findApplications({ appDevInternalPk });
        if (linkedApplications.length > 0)
            return linkedApplications;

        /* Historical applications may predate the applicant's App Dev account,
           so appDevInternalPk was null at submission time. Resolve only an
           active current member, then use the canonical email to recover that
           member's older applicant record without changing database state. */
        try {
            const member = await new AuthentikClient().getUserInfo(appDevInternalPk);
            if (!member.active || !member.email)
                return [];

            const applicant = await Applicant.findOne({ email: member.email.toLowerCase() })
                .select("_id")
                .lean()
                .exec();
            if (!applicant)
                return [];

            return this.findApplications({ applicantId: applicant._id });
        } catch (error) {
            /* Do not expose directory-service errors through a PII endpoint. */
            console.error("Horizons member lookup failed:", error instanceof Error ? error.message : "unknown error");
            return [];
        }
    }

    private findApplications(filter: Record<string, unknown>): Promise<PopulatedApplication[]> {
        return Application.find(filter)
            .populate<{ applicantId: IApplicant }>("applicantId")
            .sort({ appliedAt: 1, _id: 1 })
            .lean()
            .exec() as unknown as Promise<PopulatedApplication[]>;
    }

    private requireApplicant(application: PopulatedApplication): IApplicant {
        if (!application.applicantId)
            throw new CustomValidationError(500, "Application is missing its applicant profile");
        return application.applicantId;
    }

    private toMemberApplication(application: PopulatedApplication): APIHorizonsMemberApplication {
        const applicant = this.requireApplicant(application);
        return {
            applicationId: String(application._id),
            applicantId: String(applicant._id),
            appDevInternalPk: application.appDevInternalPk!,
            teamPk: application.teamPk,
            applicantName: applicant.fullName || "Unknown Applicant",
            email: applicant.email || "",
            stage: application.stage,
            rolePreferences: application.rolePreferences ?? [],
            appliedAt: application.appliedAt,
            stars: application.stars ?? 0,
            notes: application.notes ?? null,
            stageHistory: application.stageHistory ?? [],
            hiredRole: application.hiredRole ?? null,
            hiredSubteamPk: application.hiredSubteamPk ?? null,
            profile: HorizonsController.toStringRecord(applicant.profile, ["resumeUrl"]),
            responses: HorizonsController.toStringRecord(application.responses),
            resumeAvailable: HorizonsController.hasResume(applicant),
        };
    }

    private static emptyStageCounts(): Record<ApplicationStage, number> {
        const counts = {} as Record<ApplicationStage, number>;
        for (const stage of Object.values(ApplicationStage)) counts[stage] = 0;
        return counts;
    }

    private static toStringRecord(value: unknown, omitKeys: string[] = []): Record<string, string> {
        const entries = value instanceof Map
            ? [...value.entries()]
            : Object.entries((value ?? {}) as Record<string, unknown>);
        const omitted = new Set(omitKeys);
        return Object.fromEntries(entries.filter(([key, entryValue]) => {
            return !omitted.has(key) && typeof entryValue === "string";
        })) as Record<string, string>;
    }

    private static hasResume(applicant: IApplicant): boolean {
        return HorizonsController.getCanonicalResumeKey(applicant) !== null;
    }

    private static getCanonicalResumeKey(applicant: IApplicant): string | null {
        const profile = applicant.profile as unknown;
        const storedResumeKey = profile instanceof Map
            ? profile.get("resumeUrl")
            : (profile as Record<string, unknown> | undefined)?.resumeUrl;
        const expectedKey = `resumes/${String(applicant._id)}.pdf`;
        return storedResumeKey === expectedKey ? expectedKey : null;
    }
}
