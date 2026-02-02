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

import { Route, Controller, Get, SuccessResponse, Post, Body, Tags } from "tsoa";
import { BindlePermissionMap } from "./BindleController";
import { GiteaHookRepositoryTrigger } from "../clients/GiteaClient/models";
import { GiteaClient } from "../clients/GiteaClient";
import { AuthentikClient } from "../clients/AuthentikClient";

@Route("/api/webhook")
export class HooksController extends Controller {
  private readonly giteaClient: GiteaClient
  private readonly authentikClient: AuthentikClient

  constructor() {
    super()
    this.giteaClient = new GiteaClient()
    this.authentikClient = new AuthentikClient()
  }

  @Post("git/repoevent")
  @Tags("Git Web Hooks")
  @SuccessResponse(200)
  async processGitRepoEventHook(@Body() repoEvent: GiteaHookRepositoryTrigger) {
    switch (repoEvent.action) {
      case "created":
        return this.handleRepoCreation(repoEvent)

      default:
        return "OK"
    }
  }

  private async handleRepoCreation(repoEvent: GiteaHookRepositoryTrigger) {
    try {
      /* Get Repo Team Information */
      const teamPk = await this.authentikClient.getGroupPkFromName(repoEvent.organization.username)
      const teamInfo = await this.authentikClient.getGroupInfo(teamPk)

      /* Apply Branch Protection Rules */
      await this.giteaClient.handleBranchProtectionSync(teamInfo, [repoEvent.repository])
    } catch (e: any) {
      return `OK (Actions Failed: ${e.message})`;
    }
  }
}