/**
  People Portal Server
  Copyright (C) 2026  Atheesh Thirumalairajan

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

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
