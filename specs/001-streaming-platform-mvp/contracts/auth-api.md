# Contract: Auth API

Base path: `/api/auth`

## POST /api/auth/register

Registers a new User (role always `USER`; there is no self-service admin signup).

**Request body**: `{ email: string, password: string }`

**Responses**:
- `201` → `{ user: { id, email, role }, accessToken, refreshToken }` — issued and logged in
  immediately.
- `409` → email already registered.
- `422` → validation failure (invalid email, weak password).

## POST /api/auth/login

**Request body**: `{ email: string, password: string }`

**Responses**:
- `200` → `{ user: { id, email, role }, accessToken, refreshToken }`
- `401` → invalid credentials.

## POST /api/auth/refresh

Exchanges a valid refresh token (sent as an httpOnly cookie by the frontend) for a new access
token, rotating the refresh token per Constitution Principle IV.

**Responses**:
- `200` → `{ accessToken }` (new refresh token set via cookie)
- `401` → refresh token invalid/expired/reused (revoked).

## POST /api/auth/logout

Revokes the current refresh token.

**Responses**: `204`

## GET /api/auth/me

**Auth**: Bearer access token required.

**Responses**:
- `200` → `{ id, email, role, subscription: { status, expiresAt } | null }`
- `401` → not authenticated.
