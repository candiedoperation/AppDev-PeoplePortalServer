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

@Route("/api/webhook")
export class HooksController extends Controller {
  private readonly giteaClient: GiteaClient

  constructor() {
    super()
    this.giteaClient = new GiteaClient()
  }

  @Post("git/repoevent")
  @Tags("Git Web Hooks")
  @SuccessResponse(200)
  async processGitRepoEventHook(@Body() repoEvent: GiteaHookRepositoryTrigger) {
    console.log(repoEvent.action);
    console.log(repoEvent.repository.full_name);

    if (repoEvent.action == "created") {
      console.log("DELETEING THE REPO")
      await this.giteaClient.deleteRepository(repoEvent.repository.owner.username, repoEvent.repository.name)
    }

    return "OK"
  }
}