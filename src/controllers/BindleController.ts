import { Controller, Get, Route, SuccessResponse } from "tsoa";
import { SharedResourceClient } from "../clients";
import { ENABLED_SHARED_RESOURCES } from "../config";

export interface EnabledBindlePermissions {
    /* Name of the Perm (ex. repo:allowcreate) */
    [key: string]: boolean
}

export interface BindlePermissionMap {
    [key: string]: BindlePermission
}

export interface BindlePermission {
    friendlyName: string,
    description: string,
}

@Route("/api/bindles")
export class BindleController extends Controller {
    private static bindleDefinition: { [key: string]: BindlePermissionMap } = (() => {
        const definitions: { [key: string]: BindlePermissionMap } = {};
        for (const sharedResource of Object.values(ENABLED_SHARED_RESOURCES)) {
            const resourceName = sharedResource.getResourceName();
            definitions[resourceName] = sharedResource.getSupportedBindles();
        }

        /* Perform Return for Static Store */
        return definitions;
    })();

    @Get("definitions")
    @SuccessResponse(200)
    async getDefinitions(): Promise<{ [key: string]: BindlePermissionMap }> {
        return BindleController.bindleDefinition;
    }

    public static sanitizeBindlePermissions = (bindlePermissions: { [key: string]: EnabledBindlePermissions }): { [key: string]: EnabledBindlePermissions } => {
        const sanitizedBindlePermissions: { [key: string]: EnabledBindlePermissions } = {};
        for (const clientName in bindlePermissions) {
            const supportedBindles = BindleController.bindleDefinition[clientName];
            if (!supportedBindles)
                continue;

            const filteredBindles: EnabledBindlePermissions = {};
            for (const bindleKey in bindlePermissions[clientName]) {
                // Check if this bindle key is supported by the client
                if (!supportedBindles[bindleKey])
                    continue;

                /* Update Filtered Bindle Setting */
                filteredBindles[bindleKey] = bindlePermissions[clientName][bindleKey] ?? false;
            }

            /* Apply the Filtered Bindles to the Final List */
            sanitizedBindlePermissions[clientName] = filteredBindles;
        }

        return sanitizedBindlePermissions;
    }
}