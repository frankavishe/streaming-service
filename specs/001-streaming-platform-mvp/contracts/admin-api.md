# Contract: Admin Content Management API

Base path: `/api/admin`. **Auth**: Bearer access token, `role = ADMIN` required on every
endpoint here (FR-019) — enforced by a RolesGuard, not just hidden in the frontend UI.

## POST /api/admin/titles

Creates a Title (movie or series shell).

**Request body**: `{ type: "MOVIE" | "SERIES", name, description, posterUrl, genres: string[] }`

**Responses**: `201` → `{ id, ...as GET /api/catalog/titles/:id, published: false }`

## PATCH /api/admin/titles/:titleId

Edits metadata and/or `published` flag (FR-015). A title cannot be published with no `READY`
playable content beneath it (movie: its FULL asset; series: at least one published episode).

## POST /api/admin/titles/:titleId/seasons

**Request body**: `{ number: integer }` — only valid when the title's `type = SERIES`.

## POST /api/admin/seasons/:seasonId/episodes

**Request body**: `{ number: integer, name, description }`

## PATCH /api/admin/episodes/:episodeId

Edits episode metadata and/or `published` flag.

## POST /api/admin/media-assets

Registers a new upload target for a Title or Episode.

**Request body**: `{ ownerType: "TITLE" | "EPISODE", ownerId: string, kind: "TRAILER" | "FULL" }`

**Responses**: `201` → `{ assetId, uploadUrl }` — a signed PUT URL to the object storage bucket;
the admin UI uploads the raw video directly to `uploadUrl`.

## POST /api/admin/media-assets/:assetId/complete-upload

Called once the direct upload finishes; enqueues the transcode job (FR-016, FR-017).

**Responses**: `202` → `{ assetId, processingStatus: "PENDING" }`

## GET /api/admin/media-assets/:assetId

Poll for processing status (FR-018, Edge Case: transcode failure surfaced to admin).

**Responses**: `200` → `{ assetId, processingStatus: "PENDING" | "READY" | "FAILED", failureReason?: string }`
