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

import { GiteaClient } from "./clients/GiteaClient";
import { SlackClient } from "./clients/SlackClient";
import { RootTeamSettingClient, SharedResourceClient } from "./clients";
import { AWSClient } from "./clients/AWSClient";
import { AppleAccountClient } from "./clients/AppleAccountClient";
import { PeoplePortalClient } from "./clients/PeoplePortalClient";
import { EnabledBindlePermissions } from "./controllers/BindleController";
import { TeamType } from "./clients/AuthentikClient/models";

/**
 * This interface helps define the default configuration that needs to be applied
 * when a team of a specific type is created. This configuration involves the list
 * of default subteams and the default bindle permissions to apply to each subteam.
 */
export interface TeamTypeConfig {
  defaultSubteams: {
    friendlyName: string;
    description: string;
    bindles?: { [key: string]: EnabledBindlePermissions }; /* Optional Bindle Permissions */
  }[];
}

/**
 * This interface helps define the configuration for service teams.
 * Service teams are teams that are unique to the organization and are created
 * automatically by People Portal if they don't exist.
 * 
 * Some service teams enable hardcoded internal functionality. For example, the
 * ExecutiveBoard team integrates with the Executive Authorization Layer to override
 * all bindles just as how superusers would do.
 * 
 * Adding to and removing members from these service teams have predefined rulesets
 * that are defined in the code.
 */
export interface ServiceTeamConfig {
  friendlyName: string;
  description: string;
  subteams: {
    uniqueName: string;
    friendlyName: string;
    description: string;
    bindles?: { [key: string]: EnabledBindlePermissions };
  }[];
}

/* Define Enabled Shared Resources Here */
export const ENABLED_SHARED_RESOURCES: { [key: string]: SharedResourceClient } = {
  //appleAccountClient: new AppleAccountClient(),
  //giteaClient: new GiteaClient(),
  peoplePortalClient: new PeoplePortalClient(),
  slackClient: new SlackClient(),
}

/* Define Enabled Root Team Setting Resources Here */
export const ENABLED_TEAMSETTING_RESOURCES: { [key: string]: RootTeamSettingClient } = {
  awsClient: new AWSClient()
}

/* Define Enabled Service Teams Here */
export const ENABLED_SERVICE_TEAMS: Record<string, ServiceTeamConfig> = {
  ExecutiveBoard: {
    friendlyName: "Executive Board",
    description: "The President and Other Club Executives",
    subteams: [
      {
        uniqueName: "ExecutiveBoardMembers",
        friendlyName: "Current Executives",
        description: "The Current President and Club Executives"
      },
      {
        uniqueName: "ExecutiveBoardAlumni",
        friendlyName: "Previous Executives",
        description: "The Previous Presidents and Club Executives"
      },
    ]
  }
}

/* Define Team Type Templates Here */
export const TEAM_TYPE_CONFIGS: Partial<Record<TeamType, TeamTypeConfig>> = {
  [TeamType.PROJECT]: {
    defaultSubteams: [
      {
        friendlyName: "Leadership",
        description: "Project and Tech Leads",
        bindles: {
          "GiteaClient": { "repo:allowcreate": true },
          "PeoplePortalClient": {
            "corp:awsaccess": true,
            "corp:hiringaccess": true
          },
        }
      },
      {
        friendlyName: "Engineering",
        description: "UI/UX, PMs, SWEs, etc.",
        /* No special bindles for Engineering */
      }
    ]
  },

  [TeamType.BOOTCAMP]: {
    defaultSubteams: [
      {
        friendlyName: "Learners",
        description: "Bootcamp Students"
      },
      {
        friendlyName: "Educators",
        description: "Bootcamp Teachers",
        bindles: {
          "PeoplePortalClient": {
            "corp:hiringaccess": true,
            "corp:bindlesync": true,
            "corp:subteamaccess": true,
            "corp:membermgmt": true
          }
        }
      },
      {
        friendlyName: "Interviewers",
        description: "Interviewers for Bootcamp",
        bindles: {
          "PeoplePortalClient": {
            "corp:hiringaccess": true
          }
        }
      }
    ]
  }
}