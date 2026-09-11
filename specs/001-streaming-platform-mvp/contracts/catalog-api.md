# Contract: Catalog & Playback API

Base path: `/api/catalog`. Public endpoints require no auth (FR-001, FR-002).

## GET /api/catalog/titles

List published titles. Query params: `genre?`, `type? (MOVIE|SERIES)`, `page?`, `pageSize?`.

**Responses**: `200` → `{ items: [{ id, type, name, posterUrl, genres }], page, pageSize, total }`

## GET /api/catalog/titles/:titleId

**Responses**:
- `200` (movie) → `{ id, type: "MOVIE", name, description, posterUrl, genres, trailer: { assetId, ready }, fullAvailable: boolean }`
- `200` (series) → `{ id, type: "SERIES", name, description, posterUrl, genres, seasons: [{ id, number, episodes: [{ id, number, name, trailer: { assetId, ready }, fullAvailable }] }] }`
- `404` → not found or not published.

Note: `fullAvailable` reflects whether the FULL MediaAsset is `READY` (FR-018) — it does NOT
reveal whether the requesting user is entitled to watch it; that's decided at playback-URL time.

## GET /api/catalog/episodes/:episodeId

Same shape as an episode entry above, for direct linking.

## GET /api/media/:assetId/trailer-url

**Auth**: none required (FR-002).

**Responses**:
- `200` → `{ url, expiresAt }` — a signed, time-expiring URL to the trailer's HLS manifest.
- `404` → asset not found or not `READY`.

## GET /api/media/:assetId/playback-url

**Auth**: Bearer access token required. Server-side entitlement check per Constitution
Principle I: the requesting user must have an `ACTIVE`, non-expired Subscription.

**Responses**:
- `200` → `{ url, expiresAt }` — signed, time-expiring URL to the FULL video's HLS manifest.
- `401` → not authenticated (FR-003).
- `403` → authenticated but no active subscription (FR-005).
- `404` → asset not found or not `READY`.
