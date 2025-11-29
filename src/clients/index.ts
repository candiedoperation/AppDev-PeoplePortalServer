import { BindlePermissionMap } from "../controllers/BindleController";
import { RootTeamSettingMap } from "../controllers/OrgController";
import { GetGroupInfoResponse } from "./AuthentikClient/models";

/**
 * Interface to define clients that manipulate Shared Resources like,
 * Gitea, Slack, etc.
 */
export interface SharedResourceClient {
    getResourceName(): string
    getSupportedBindles(): BindlePermissionMap

    handleOrgBindleSync(
        org: GetGroupInfoResponse, 
        callback: (updatedResourceCount: number, status: string) => void
    ): Promise<boolean>
}

/**
 * Interface to define clients that are impacted by root team setting
 * changes like, AWS accounts, etc.
 */
export interface RootTeamSettingClient {
    getResourceName(): string
    getSupportedSettings(): RootTeamSettingMap

    syncSettingUpdate(
        org: GetGroupInfoResponse,
        callback: (updatePercent: number, status: string) => void /* Provide Updates to Front End! */
    ): Promise<boolean>
}