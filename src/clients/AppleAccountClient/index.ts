import { SharedResourceClient } from ".."
import { BindlePermissionMap } from "../../controllers/BindleController"
import { GetGroupInfoResponse } from "../AuthentikClient/models"

export class AppleAccountClient implements SharedResourceClient {
    private static readonly TAG = "AppleAccountClient"
    private readonly supportedBindles: BindlePermissionMap = {
        "apple:platformaccess": {
            friendlyName: "App Store Connect Access",
            description: "Enabling this allows TestFlight and Publishing to the App Store",
        },
    }

    getResourceName(): string {
        return AppleAccountClient.TAG;
    }

    getSupportedBindles(): BindlePermissionMap {
        return this.supportedBindles;
    }

    handleOrgBindleSync(org: GetGroupInfoResponse, callback: (updatedResourceCount: number, status: string) => void): Promise<boolean> {
        //throw new Error("Method not implemented.")
        return Promise.resolve(true)
    }
}