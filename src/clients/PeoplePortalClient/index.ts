import { SharedResourceClient } from ".."
import { BindlePermissionMap } from "../../controllers/BindleController"
import { GetGroupInfoResponse } from "../AuthentikClient/models"

export class PeoplePortalClient implements SharedResourceClient {
    public static readonly TAG = "PeoplePortalClient"
    private readonly supportedBindles: BindlePermissionMap = {
        "corp:hiringaccess": {
            friendlyName: "Permit Recruitment",
            description: "Enabling this allows members in this subteam to recruit new members to your team",
        },

        "corp:rootsettings": {
            friendlyName: "Allow Team Settings Management",
            description: "Enabling this allows members in this subteam to modify team settings",
        },

        "corp:subteamaccess": {
            friendlyName: "Allow Subteam Management",
            description: "Enabling this allows members in this subteam to create, modify and delete subteams",
        },

        "corp:membermgmt": {
            friendlyName: "Allow Member Management",
            description: "Enabling this allows people in this subteam to add & remove members to your team",
        },
    }

    getResourceName(): string {
        return PeoplePortalClient.TAG
    }

    getSupportedBindles(): BindlePermissionMap {
        return this.supportedBindles;
    }

    /**
     * PeoplePortalClient provides the ability to set granular permissions. Bindle Sync
     * is redundant as permission settings happen in subteam configurations and evaluations
     * happen in BindleController.ts and the Bindle Authentication Middleware.
     * 
     * @param org Team Information from Authentik
     * @param callback Notify Client of Sync Status (Not Needed)
     * @returns True (Always)
     */
    handleOrgBindleSync(org: GetGroupInfoResponse, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {
        return Promise.resolve(true);
    }
}