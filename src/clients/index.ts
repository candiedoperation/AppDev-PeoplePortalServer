import { BindlePermissionMap } from "../controllers/BindleController";
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