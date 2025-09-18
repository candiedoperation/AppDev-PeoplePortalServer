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
    private bindleDefinition: { [key: string]: BindlePermissionMap } = {}
    
    constructor() {
        super()
        for (const sharedResource of ENABLED_SHARED_RESOURCES) {
            const resourceName = sharedResource.getResourceName()
            this.bindleDefinition[resourceName] = sharedResource.getSupportedBindles()
        }
    }

    @Get("definitions")
    @SuccessResponse(200)
    async getDefinitions(): Promise<{ [key: string]: BindlePermissionMap }> {
        return this.bindleDefinition
    }

    private normalizeBindlePermissions = (bindlePermissions: { [key: string]: BindlePermission[] }) => {
        
    }
}