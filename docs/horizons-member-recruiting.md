# Horizons member recruiting API

People Portal exposes read-only recruiting details for an internal member under
`/api/horizons`. The endpoints use a service-to-service bearer key and do not
use browser cookies or OIDC sessions.

```http
Authorization: Bearer <HORIZONS_API_KEY>
```

The server operator must configure `HORIZONS_API_KEY`. It is a deployment
secret, not a value generated from an individual member account.

## Endpoints

### `GET /api/horizons/health`

Unauthenticated liveness response.

### `GET /api/horizons/members/{appDevInternalPk}/recruiting`

Returns application count, team count, stage counts, interview-event counts
and timestamps, average stars, feedback count, applicant identities, and resume
availability for the internal member PK.

### `GET /api/horizons/members/{appDevInternalPk}/applications`

Returns one record per application, including stage history, notes, ratings,
role preferences, hired role, profile fields, team/role responses, and resume
availability. The stored S3 resume key is omitted from profile fields.

### `GET /api/horizons/members/{appDevInternalPk}/resume`

Returns a 15-minute signed URL for the canonical PDF resume, when available.
Only the server-generated `resumes/{applicantId}.pdf` key is accepted; stored
arbitrary URLs are never passed to S3.
