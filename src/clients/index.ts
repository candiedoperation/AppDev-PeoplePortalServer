import { GetGroupInfoResponse } from "./AuthentikClient/models";

/**
 * Interface to define clients that manipulate Shared Resources like,
 * Gitea, Slack, etc.
 */
export interface SharedResourceClient {
    handleOrgBindleSync(
        org: GetGroupInfoResponse, 
        callback: (updatedResourceCount: number, status: string) => void
    ): Promise<boolean>
}