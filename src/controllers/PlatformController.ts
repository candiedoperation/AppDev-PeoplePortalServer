import { Controller, Get, Route, Tags, SuccessResponse, Security } from "tsoa";
import fs from 'fs';
import path from 'path';

interface PlatformLicenseResponse {
    licenseText: string;
    dependencies: { name: string; version: string }[];
}

@Route("/api/platform")
export class PlatformController extends Controller {

    /**
     * Retrieves the platform license text and list of backend dependencies.
     */
    @Get("license")
    @Tags("Platform Info")
    @SuccessResponse(200)
    @Security("oidc")
    public async getPlatformLicense(): Promise<PlatformLicenseResponse> {
        // Read LICENSE file
        const licensePath = path.join(process.cwd(), 'LICENSE');
        let licenseText = "License file not found.";
        try {
            if (fs.existsSync(licensePath)) {
                licenseText = fs.readFileSync(licensePath, 'utf-8');
            }
        } catch (e) {
            console.error("Failed to read LICENSE file", e);
        }

        // Read package.json for dependencies
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        let dependencies: { name: string; version: string }[] = [];
        try {
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (packageJson.dependencies) {
                    dependencies = Object.keys(packageJson.dependencies).map(key => ({
                        name: key,
                        version: packageJson.dependencies[key]
                    }));
                }
            }
        } catch (e) {
            console.error("Failed to read package.json", e);
        }

        return {
            licenseText,
            dependencies
        };
    }
}
