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

export interface GiteaAPITeamDefinition {
    id: number,
    name: string,
    description: string,
    organization: string | null,
    includes_all_repositories: boolean,
    permission: "none",
    can_create_org_repo: boolean,
    units: string[],
    units_map: object,
}

export interface GiteaAPIUserDefinition {
    active: boolean;
    avatar_url: string;
    created: string; // ISO date string
    description: string;
    email: string;
    followers_count: number;
    following_count: number;
    full_name: string;
    html_url: string;
    id: number;
    is_admin: boolean;
    language: string;
    last_login: string; // ISO date string
    location: string;
    login: string;
    login_name: string;
    prohibit_login: boolean;
    restricted: boolean;
    source_id: number;
    starred_repos_count: number;
    visibility: string;
    website: string;
}