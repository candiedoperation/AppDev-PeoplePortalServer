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