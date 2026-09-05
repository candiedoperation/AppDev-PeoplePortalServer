# Horizons API

The Horizons API is a read-only analytics API exposed by People Portal Server for the AppDev Horizons insights app. It provides service-to-service access to organization data: user directory and profiles, team structure and rosters, meetings, attendance records and aggregates, and recruiting status and application funnel metrics. All endpoints are HTTP GET, return JSON, and never modify data. Dates are serialized as ISO 8601 strings.

All endpoints live under the base path `/api/horizons`.

## Authentication

Every endpoint except `GET /api/horizons/health` requires a static API key sent as a bearer token:

```
Authorization: Bearer <HORIZONS_API_KEY>
```

The token must exactly match the `HORIZONS_API_KEY` environment variable configured on the server. Server operators set this value in the server's `.env` file. No cookies, sessions, or OIDC flows are involved; the comparison is constant-time.

A request can fail authentication with `401 Unauthorized` in three ways:

| Condition | Response body `message` |
|---|---|
| The server has no `HORIZONS_API_KEY` configured | `Horizons access is not configured` |
| The `Authorization` header is missing or does not start with `Bearer ` | `Missing Bearer Token` |
| The presented token does not match the configured key | `Invalid API Key` |

`GET /api/horizons/health` is the only unauthenticated endpoint, so uptime monitors do not need the key.

## Error format

All error responses are JSON objects with a `message` string:

```json
{ "message": "Team not found" }
```

Status codes used by this API:

- `400 Bad Request`: semantic parameter errors, currently only an invalid time window (`from` must be earlier than `to` whenever both are supplied).
- `401 Unauthorized`: authentication failures (see above).
- `404 Not Found`: unknown user, team, or meeting, as noted per endpoint.
- `422 Unprocessable Entity`: parameter validation failures (wrong type, integer or range constraint violations). The body is `{ "message": "Validation Failed", "details": { ... } }` where `details` describes each failing field.
- `500 Internal Server Error`: unexpected failures, body `{ "message": ... }`.

## Endpoints

### GET /api/horizons/health

Public liveness probe. Requires no API key, touches no secrets and no database.

Parameters: none.

Response:

| Field | Type | Description |
|---|---|---|
| `status` | string | Always `"ok"` |
| `serverTime` | string (date) | Current server time |

Errors: none.

### GET /api/horizons/meta

Service metadata: server time, database connection state, and cheap estimated document counts for the analytics-relevant collections.

Parameters: none.

Response:

| Field | Type | Description |
|---|---|---|
| `service` | string | Always `"horizons"` |
| `serverTime` | string (date) | Current server time |
| `databaseConnected` | boolean | Whether the MongoDB connection is established |
| `counts.meetings` | number | Estimated meeting occurrence count |
| `counts.attendanceRecords` | number | Estimated individual attendance record count |
| `counts.subteamInvites` | number | Estimated subteam invite count |
| `counts.applications` | number | Estimated application count |
| `counts.applicants` | number | Estimated applicant count |
| `counts.recruitingTeams` | number | Estimated count of teams with a recruiting status document |

Errors: none beyond authentication.

### GET /api/horizons/users

Paginated directory of onboarded users, using Authentik-native page pagination. Profile fields only; avatar URLs are not returned.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `page` | query | integer | no | first page | Must be an integer, minimum 1 |
| `search` | query | string | no | none | Free-text search over username, name, and email |

Response:

| Field | Type | Description |
|---|---|---|
| `pagination` | object | Page pagination info (see Pagination section): `next`, `previous`, `count`, `current`, `total_pages`, `start_index`, `end_index`, all numbers |
| `users` | array | User summaries, see below |

Each entry in `users`:

| Field | Type | Description |
|---|---|---|
| `pk` | number | Authentik user PK |
| `username` | string | Login username |
| `name` | string | Display name |
| `email` | string | Email address |
| `active` | boolean | Whether the account is active |
| `memberSince` | string (date) | Account creation date |
| `alumniAccount` | boolean | Whether the account is an alumni account |
| `major` | string or null | Declared major |
| `expectedGrad` | string (date) or null | Expected graduation date |
| `roles` | object | Map of Authentik group PK to role title |

Errors: `422` for an invalid `page` value.

### GET /api/horizons/users/{userPk}

Single user detail, including group memberships with per-team role titles.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `userPk` | path | number | yes | n/a | Authentik user PK |

Response: all fields of a user summary (see `GET /api/horizons/users`), plus:

| Field | Type | Description |
|---|---|---|
| `lastLogin` | string (date) or null | Last login time |
| `isSuperuser` | boolean | Whether the user is an Authentik superuser |
| `groups` | array | Group memberships, see below |

Each entry in `groups`:

| Field | Type | Description |
|---|---|---|
| `pk` | string | Authentik group PK |
| `name` | string | Group name |
| `friendlyName` | string or null | Human-friendly team name |
| `teamType` | string or null | Team type attribute |
| `roleTitle` | string or null | The user's role title within this group |

Errors: `404` with `User not found` when no user has the given PK.

### GET /api/horizons/users/{userPk}/attendance/summary

Per-team attendance aggregates for one user over an optional time window. See the Caveats section for how `invited` is counted.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `userPk` | path | number | yes | n/a | Authentik user PK |
| `from` | query | string (datetime) | no | unbounded | Include meetings starting at or after this instant |
| `to` | query | string (datetime) | no | unbounded | Include meetings starting before this instant (exclusive) |

Response:

| Field | Type | Description |
|---|---|---|
| `userPk` | number | Echoed user PK |
| `from` | string (date) or null | Echoed window start, null when omitted |
| `to` | string (date) or null | Echoed window end, null when omitted |
| `teams` | array | Per-team stats, see below |

Each entry in `teams`:

| Field | Type | Description |
|---|---|---|
| `teamPk` | string | Authentik group PK of the team |
| `teamName` | string or null | Team name, null when the team can no longer be resolved (for example, it was deleted) |
| `invited` | number | Attendance rows for this user in this team's meetings within the window |
| `present` | number | How many of those rows are marked present |
| `attendanceRate` | number | `present / invited`, 0 when `invited` is 0 |

Errors: `400` when both `from` and `to` are supplied and `from` is not earlier than `to`. An unknown `userPk` is not a 404; it returns an empty `teams` array.

### GET /api/horizons/teams

Cursor-paginated team list. The cursor is opaque; pass `nextCursor` back verbatim to fetch the next slice.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `scope` | query | string | no | `root` | `root` for top-level teams, `subteams` for subteams only |
| `search` | query | string | no | none | Free-text search over team names |
| `limit` | query | integer | no | 20 | Must be an integer, minimum 1 |
| `cursor` | query | string | no | none | Opaque cursor from a previous response |

Response:

| Field | Type | Description |
|---|---|---|
| `teams` | array | Team entries, see below |
| `nextCursor` | string (optional) | Opaque base64 cursor for the next page; absent when there are no more results |

Each entry in `teams` carries the team identity plus its attribute set:

| Field | Type | Description |
|---|---|---|
| `pk` | string | Authentik group PK |
| `name` | string | Group name |
| `parent` | string or null | Parent group PK, null for root teams |
| `friendlyName` | string | Human-friendly team name |
| `teamType` | string | Team type |
| `seasonType` | string | Season type |
| `seasonYear` | number | Season year |
| `teamStartDate` | string (optional) | Team start date |
| `teamEndDate` | string (optional) | Team end date |
| `peoplePortalCreation` | boolean (optional) | Whether the team was created through People Portal |
| `flaggedForDeletion` | boolean (optional) | Whether the team is flagged for deletion |
| `description` | string | Team description |
| `rootTeamSettings` | object | Map of setting name to its enablement state |
| `bindlePermissions` | object | Map of client name to its enabled permission set |

Errors: `422` for an invalid `limit`. A malformed or stale `cursor` does not error; pagination silently restarts from the beginning.

### GET /api/horizons/teams/{teamId}

Team detail: attributes, parent, and one level of subteams. Member lists (and subteam member counts) are included unless `includeMembers=false`.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `teamId` | path | string | yes | n/a | Authentik group PK (UUID) of the team |
| `includeMembers` | query | boolean | no | `true` | Include per-team and per-subteam member lists |

Response:

| Field | Type | Description |
|---|---|---|
| `pk` | string | Authentik group PK |
| `name` | string | Group name |
| `parentPk` | string or null | Parent group PK |
| `attributes` | object | Team attribute set (same fields as described under `GET /api/horizons/teams`, from `friendlyName` through `bindlePermissions`) |
| `members` | array or null | Direct (non-subteam) members as roster members (see below); null when `includeMembers=false` |
| `subteams` | array | One level of subteams, see below |

Each entry in `subteams`:

| Field | Type | Description |
|---|---|---|
| `pk` | string | Subteam group PK |
| `name` | string | Subteam name |
| `friendlyName` | string or null | Human-friendly subteam name |
| `flaggedForDeletion` | boolean | Whether the subteam is flagged for deletion |
| `memberCount` | number or null | Member count; null when `includeMembers=false` |
| `members` | array or null | Subteam members as roster members; null when `includeMembers=false` |

Roster member shape (used here and by the roster endpoint):

| Field | Type | Description |
|---|---|---|
| `pk` | number | Authentik user PK |
| `username` | string | Login username |
| `name` | string | Display name |
| `email` | string | Email address |
| `roleTitle` | string or null | Role title, resolved team-first then subteam |
| `subteams` | array | `{ pk, name }` entries for the member's subteams within this team |

Errors: `404` with `Team not found` when `teamId` is not a valid UUID or no such group exists.

### GET /api/horizons/teams/{teamId}/roster

Flattened, de-duplicated membership for one team: the team's direct users plus everyone in its subteams (skipping subteams flagged for deletion), each with a role title and their subteam assignments. Sorted by display name.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `teamId` | path | string | yes | n/a | Authentik group PK (UUID) of the team |

Response:

| Field | Type | Description |
|---|---|---|
| `teamPk` | string | Authentik group PK |
| `teamName` | string | Team name |
| `memberCount` | number | Number of distinct members |
| `members` | array | Roster members (shape described under `GET /api/horizons/teams/{teamId}`) |

Errors: `404` with `Team not found` when `teamId` is not a valid UUID or no such group exists.

### GET /api/horizons/teams/{teamId}/recruiting

Recruiting status for one team. A team with no recruiting status record simply is not recruiting; that is a normal state, not a 404.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `teamId` | path | string | yes | n/a | Authentik group PK of the team |

Response:

| Field | Type | Description |
|---|---|---|
| `teamPk` | string | Echoed team PK |
| `isRecruiting` | boolean | Whether the team is recruiting; `false` when the team has no recruiting record |
| `recruitingSubteams` | array | Subteams open for recruiting, see below |

Each entry in `recruitingSubteams`:

| Field | Type | Description |
|---|---|---|
| `subteamPk` | string | Subteam group PK |
| `isRecruiting` | boolean | Whether this subteam is recruiting |
| `roles` | array of string | Role names the subteam is recruiting for (application question text is not included) |

Errors: none beyond authentication. The team's existence is not verified; an unknown `teamId` returns `isRecruiting: false` with an empty list.

### GET /api/horizons/meetings

Meetings across teams, filterable by team and start-time window. The window is inclusive of `from` and exclusive of `to`: a meeting starting exactly at `to` is excluded. Includes derived recurrence info per occurrence. Results are sorted by start time ascending with a stable tiebreaker.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `teamPk` | query | string | no | all teams | Authentik group PK to filter by |
| `from` | query | string (datetime) | no | unbounded | Include meetings starting at or after this instant |
| `to` | query | string (datetime) | no | unbounded | Include meetings starting before this instant (exclusive) |
| `limit` | query | integer | no | 100 | Must be an integer, minimum 1, maximum 500 |
| `offset` | query | integer | no | 0 | Must be an integer, minimum 0 |

Response:

| Field | Type | Description |
|---|---|---|
| `total` | number | Total matching meetings across all pages |
| `limit` | number | Echoed page size |
| `offset` | number | Echoed offset |
| `meetings` | array | Meeting occurrences, see below |

Each entry in `meetings`:

| Field | Type | Description |
|---|---|---|
| `id` | string | Meeting occurrence id (MongoDB ObjectId string) |
| `teamPk` | string | Owning team's group PK |
| `seriesId` | string | Identifier shared by all occurrences of a recurring series |
| `name` | string | Meeting name |
| `description` | string | Meeting description |
| `start` | string (date) | Start time |
| `end` | string (date) | End time |
| `createdBy` | number | User PK of the creator |
| `visibleToAll` | boolean | Whether the meeting is visible to all members |
| `isRecurring` | boolean | Derived: `true` when more than one occurrence shares the `seriesId` |
| `occurrenceCount` | number | Total occurrences sharing this `seriesId` |
| `createdAt` | string (date) | Record creation time |
| `updatedAt` | string (date) | Record update time |

Errors: `400` for an invalid window (`from` not earlier than `to`); `422` for invalid `limit` or `offset`.

### GET /api/horizons/meetings/{meetingId}/attendance

One meeting's attendance: individual records plus subteam invites, which are stored by reference. Subteam invitees only gain an individual record once materialized by a first check-in or manager mark (see Caveats).

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `meetingId` | path | string | yes | n/a | MongoDB ObjectId of the meeting occurrence |

Response:

| Field | Type | Description |
|---|---|---|
| `meetingId` | string | Echoed meeting id |
| `teamPk` | string | Owning team's group PK |
| `start` | string (date) | Meeting start time |
| `records` | array | Individual attendance records (shape described under `GET /api/horizons/attendance`) |
| `subteamInvites` | array | Subteam-level invites, see below |

Each entry in `subteamInvites`:

| Field | Type | Description |
|---|---|---|
| `meetingId` | string | Meeting occurrence id |
| `teamPk` | string | Owning team's group PK |
| `subteamPk` | string | Invited subteam's group PK |
| `role` | string | `required` or `optional` |

Errors: `404` with `Meeting not found` when `meetingId` is not a valid ObjectId or no such meeting exists.

### GET /api/horizons/attendance

Raw individual attendance records, filterable by team, user, and the start-time window of the referenced meetings. Sorted by `markedAt` descending with a stable tiebreaker.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `teamPk` | query | string | no | all teams | Authentik group PK to filter by |
| `userPk` | query | integer | no | all users | Authentik user PK to filter by; must be an integer |
| `from` | query | string (datetime) | no | unbounded | Include records of meetings starting at or after this instant |
| `to` | query | string (datetime) | no | unbounded | Include records of meetings starting before this instant (exclusive) |
| `limit` | query | integer | no | 200 | Must be an integer, minimum 1, maximum 1000 |
| `offset` | query | integer | no | 0 | Must be an integer, minimum 0 |

Response:

| Field | Type | Description |
|---|---|---|
| `total` | number | Total matching records across all pages |
| `limit` | number | Echoed page size |
| `offset` | number | Echoed offset |
| `records` | array | Attendance records, see below |

Each entry in `records`:

| Field | Type | Description |
|---|---|---|
| `meetingId` | string | Meeting occurrence id |
| `teamPk` | string | Owning team's group PK |
| `seriesId` | string | Meeting series identifier |
| `userPk` | number | Attendee's user PK |
| `role` | string | `required` or `optional` |
| `present` | boolean | Whether the user was marked present |
| `markedBy` | number or null | User PK of whoever marked the record, null when unmarked |
| `markedAt` | string (date) or null | When the record was marked, null when unmarked |

Errors: `400` for an invalid window; `422` for invalid `userPk`, `limit`, or `offset`.

### GET /api/horizons/teams/{teamId}/attendance/summary

Per-user attendance aggregates for one team over an optional time window. See the Caveats section for how `invited` is counted.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `teamId` | path | string | yes | n/a | Authentik group PK of the team |
| `from` | query | string (datetime) | no | unbounded | Include meetings starting at or after this instant |
| `to` | query | string (datetime) | no | unbounded | Include meetings starting before this instant (exclusive) |

Response:

| Field | Type | Description |
|---|---|---|
| `teamPk` | string | Echoed team PK |
| `from` | string (date) or null | Echoed window start, null when omitted |
| `to` | string (date) or null | Echoed window end, null when omitted |
| `totalMeetings` | number | Meetings for this team within the window |
| `subteamInviteCount` | number | Subteam invites across those meetings; lets consumers detect unmaterialized invitees (see Caveats) |
| `users` | array | Per-user stats, see below |

Each entry in `users`:

| Field | Type | Description |
|---|---|---|
| `userPk` | number | Attendee's user PK |
| `invited` | number | Materialized attendance rows for this user within the window |
| `present` | number | How many of those rows are marked present |
| `requiredInvited` | number | Rows with role `required` |
| `requiredPresent` | number | Rows with role `required` that are marked present |
| `attendanceRate` | number | `present / invited`, 0 when `invited` is 0 |

Errors: `400` for an invalid window. The team's existence is not verified; an unknown `teamId` returns zeroed aggregates with an empty `users` array.

### GET /api/horizons/recruiting/status

Recruiting status for all teams that have a recruiting record, each joined with its subteams' recruiting role lists.

Parameters: none.

Response:

| Field | Type | Description |
|---|---|---|
| `teams` | array | One entry per team with a recruiting record; each entry has the same shape as the `GET /api/horizons/teams/{teamId}/recruiting` response (`teamPk`, `isRecruiting`, `recruitingSubteams`) |

Errors: none beyond authentication.

### GET /api/horizons/recruiting/funnel

Application funnel aggregates: counts by stage per team, plus totals and average star ratings. Contains no applicant personal data: no names, emails, responses, or notes.

| Parameter | In | Type | Required | Default | Constraints |
|---|---|---|---|---|---|
| `teamPk` | query | string | no | all teams | Authentik group PK to filter by |

Response:

| Field | Type | Description |
|---|---|---|
| `teams` | array | One entry per team that has applications, see below |

Each entry in `teams`:

| Field | Type | Description |
|---|---|---|
| `teamPk` | string | Team's group PK |
| `stages` | object | Complete map of application stage to count. Every stage key is always present, 0 when empty. Stages: `Applied`, `Interview`, `Rejected`, `Potential Hire`, `Hired` |
| `total` | number | Total applications for the team |
| `avgStars` | number or null | Average star rating across the team's applications, weighted by stage counts and rounded to 2 decimal places; null when the team has no applications |

Errors: none beyond authentication. An unknown `teamPk` returns an empty `teams` array.

## Pagination

The API uses three pagination schemes, matching the backing data stores:

1. **Page pagination (users).** `GET /api/horizons/users` proxies Authentik's native page pagination. Request a page with `page` (1-based) and read the `pagination` object in the response: `next` and `previous` (adjacent page numbers), `count` (total items), `current` (current page), `total_pages`, `start_index`, and `end_index`.

2. **Opaque cursor (teams).** `GET /api/horizons/teams` returns an optional `nextCursor` string (base64). Treat it as opaque: pass it back verbatim as the `cursor` query parameter to fetch the next slice. When `nextCursor` is absent, there are no more results. Cursors are tied to the current `search` value; a cursor that does not match (or cannot be decoded) silently restarts pagination from the beginning rather than erroring.

3. **Limit/offset with totals (meetings and attendance).** `GET /api/horizons/meetings` and `GET /api/horizons/attendance` accept `limit` and `offset` and echo them back alongside a `total` count of all matching documents, so consumers can compute page counts. Both endpoints sort with a stable tiebreaker so equal-key documents keep a consistent order across offset pages.

## Caveats

- **Subteam invite counting.** Subteam invitees have no individual attendance record until their first check-in or a manager marks them. As a result, `invited` in the attendance summaries counts materialized records only; a subteam member who never interacted with a meeting is invisible in the per-user aggregates. The meeting attendance endpoint exposes `subteamInvites` and the team summary exposes `subteamInviteCount` so consumers can detect this and, when they need full denominators, expand subteam membership themselves via the team detail and roster endpoints.

- **Time windows are half-open.** Everywhere a `from`/`to` window is accepted, `from` is inclusive and `to` is exclusive: a meeting starting exactly at `to` is excluded. Supplying both with `from` not earlier than `to` is a 400.

- **Existence checks vary.** The team detail and roster endpoints return 404 for an unknown or non-UUID team, and the meeting attendance endpoint returns 404 for an unknown meeting. The recruiting, attendance summary, and funnel endpoints do not verify that the referenced team or user exists; unknown identifiers yield empty results instead.

- **Recurrence is derived.** A meeting's `isRecurring` and `occurrenceCount` are computed from how many occurrences share its `seriesId` across the whole collection, not just the occurrences matching the current filter.

- **Roster role resolution.** A roster member's `roleTitle` is resolved by checking the user's role map team-first, then per subteam; the first match wins. Subteams flagged for deletion are skipped by the roster endpoint but still listed (with `flaggedForDeletion: true`) by the team detail endpoint.

- **Recruiting role lists only.** Recruiting endpoints return subteam role names but never application question text, and the funnel endpoint never returns applicant names, emails, responses, or notes.

- **Team names are best-effort.** In the user attendance summary, `teamName` is null when the team can no longer be resolved (for example, it was deleted after the meetings took place).
