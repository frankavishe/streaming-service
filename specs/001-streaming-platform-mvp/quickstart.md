# Quickstart: Validating the Streaming Platform MVP

Prerequisites: Docker + Docker Compose installed. `.env` populated from `.env.example` (DB
credentials, JWT secrets, M-Pesa Daraja sandbox credentials, Flutterwave test API keys, MinIO
credentials — see `research.md` for what each service is).

## Bring up the stack

```sh
docker compose up --build
```

This starts: `postgres`, `redis`, `minio`, `backend-api`, `backend-worker`, `frontend`. On
first run, the `backend-api` container applies Prisma migrations
(`prisma migrate deploy`) and seeds a default admin user and a couple of genres.

## Scenario 1 — Browse catalog & watch a trailer (User Story 1)

1. Open the frontend (`http://localhost:3000`) with no login.
2. Confirm the catalog page lists at least the seeded titles.
3. Open a movie title's detail page → press play → confirm the trailer plays.
4. Open a series title → confirm seasons/episodes are listed and an episode trailer plays.
5. Attempt to hit a full-content playback URL directly (e.g. via the API contract in
   `contracts/catalog-api.md`, `GET /api/media/:assetId/playback-url`) with no auth token →
   confirm `401`.

**Expected outcome**: matches spec Acceptance Scenarios 1–4 under User Story 1; validates FR-001–FR-003.

## Scenario 2 — Subscribe via M-Pesa and unlock full playback (User Story 2)

1. Register a new account, log in.
2. From the account area, choose "Subscribe" → M-Pesa → enter a Daraja sandbox test phone
   number.
3. Confirm an STK push request is accepted (`202` per `contracts/subscriptions-payments-api.md`)
   and the UI shows a pending/polling state.
4. Trigger the Daraja sandbox callback (per Safaricom's sandbox simulator) with a success
   result.
5. Confirm the UI reflects success within the polling interval, and `GET /api/subscriptions/me`
   now reports `ACTIVE` with an `expiresAt` ~30 days out.
6. Play a full movie/episode that only offered a trailer before → confirm it now plays.

**Expected outcome**: matches spec Acceptance Scenarios 1, 2, 4 under User Story 2; validates
FR-006, FR-008–FR-011.

## Scenario 3 — Subscribe via bank gateway (User Story 2, alternate path)

1. As an unsubscribed logged-in user, choose "Subscribe" → Bank payment.
2. Confirm redirect to the gateway's test checkout; complete a test payment.
3. Confirm redirect back to the site shows success and full playback is unlocked, same as
   Scenario 2 step 6.
4. Repeat with a test payment that fails/cancels → confirm the site shows a clear failure state
   and no subscription was created.

**Expected outcome**: matches spec Acceptance Scenarios 3, 5 under User Story 2; validates
FR-007, FR-008–FR-011.

## Scenario 4 — Duplicate webhook does not double-activate (Edge Case / SC-007)

1. Replay the same successful M-Pesa callback payload (from Scenario 2) a second time against
   `POST /api/payments/mpesa/callback`.
2. Confirm only one Subscription row exists for that Transaction, and `expiresAt` did not move.

**Expected outcome**: validates FR-010, SC-007.

## Scenario 5 — Billing history & subscription status (User Story 3)

1. As the user from Scenario 2/3, open the billing/account page.
2. Confirm current subscription status + expiry date are shown (FR-013).
3. Confirm the payment history lists every attempt (including any failed one from Scenario 3
   step 4) with date, amount, method, and outcome (FR-014).

**Expected outcome**: matches spec Acceptance Scenarios 1–2 under User Story 3.

## Scenario 6 — Admin adds a title (User Story 4)

1. Log in as the seeded admin account.
2. Create a new movie title (metadata via `POST /api/admin/titles`), then request an upload
   target for its trailer and full video (`POST /api/admin/media-assets`), upload both files to
   the returned signed URL, and call `complete-upload` for each.
3. Poll `GET /api/admin/media-assets/:assetId` until both reach `READY` (the worker log should
   show ffmpeg processing the `FULL` asset into HLS).
4. Publish the title (`PATCH /api/admin/titles/:titleId { published: true }`).
5. As a visitor, confirm the new title now appears in the public catalog and its trailer plays.

**Expected outcome**: matches spec Acceptance Scenarios 1, 3 under User Story 4; validates
FR-015–FR-018.

## Scenario 7 — Expired subscription re-blocks access

1. Manually advance a test Subscription's `expiresAt` into the past (test-only DB fixture/seed
   script — not a product feature).
2. Attempt full playback again → confirm `403`, matching Scenario 2's blocked state before
   subscribing.

**Expected outcome**: validates FR-012, SC-003.
