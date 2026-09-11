---

description: "Task list template for feature implementation"
---

# Tasks: Streaming Platform MVP

**Input**: Design documents from `/specs/001-streaming-platform-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not requested as a general TDD approach. Test tasks are included ONLY where the
project constitution (Principle V — Test Coverage for Money & Access Paths) makes them
mandatory: the entitlement guard, the subscription lifecycle service, and both payment webhook
handlers. All other areas may get tests later but are not blocking per the constitution.

**Organization**: Tasks are grouped by user story (from spec.md, in priority order) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Every task names an exact file path

## Path Conventions

Web application layout per plan.md: `backend/src/`, `backend/prisma/`, `backend/test/` and
`frontend/src/`, `frontend/test/` at the repository root, plus `docker/` and a root
`docker-compose.yml`. The transcode worker is a second Docker build target of `backend/`, not a
separate top-level project.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository scaffolding for both apps and the Docker-first workflow (Constitution
Principle III)

- [X] T001 Create project structure per implementation plan: `backend/`, `frontend/`,
      `docker/postgres/`, `docker/minio/` directories at the repository root
- [X] T002 [P] Initialize the NestJS backend project in `backend/` (NestJS 10, TypeScript 5.x,
      Node 20 LTS) with `backend/package.json`, `backend/tsconfig.json`, `backend/nest-cli.json`
- [X] T003 [P] Initialize the Next.js frontend project in `frontend/` (Next.js 14+ App Router,
      TypeScript 5.x) with `frontend/package.json`, `frontend/tsconfig.json`
- [X] T004 [P] Configure ESLint + Prettier for the backend in `backend/.eslintrc.cjs` and
      `backend/.prettierrc`
- [X] T005 [P] Configure ESLint + Prettier for the frontend in `frontend/.eslintrc.cjs` and
      `frontend/.prettierrc`
- [X] T006 [P] Configure Jest + Supertest for backend tests in `backend/jest.config.ts`
- [X] T007 [P] Configure Jest + React Testing Library for frontend tests in
      `frontend/jest.config.ts`
- [X] T008 Create a `docker-compose.yml` skeleton at the repository root defining `postgres`,
      `redis`, and `minio` services (Constitution Principle III)
- [X] T009 Create `.env.example` at the repository root documenting DB credentials, JWT
      secrets, M-Pesa Daraja sandbox credentials, Flutterwave test API keys, and MinIO
      credentials (Constitution Principle III/IV; per quickstart.md prerequisites)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data model, cross-cutting infrastructure, and auth that every user story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Define `User` (`id` UUID PK; `email` string, unique; `passwordHash` string, never
      exposed via API; `role` enum `USER`|`ADMIN`, default `USER`; `createdAt`/`updatedAt`) and
      `Genre` (`id` UUID PK; `name` string, unique) models in `backend/prisma/schema.prisma`
- [X] T011 Add `Title` (`id` UUID PK; `type` enum `MOVIE`|`SERIES`; `name` string; `description`
      string; `posterUrl` string; `published` boolean; `createdAt`/`updatedAt`), a
      `TitleGenre` join table, `Season` (`id` UUID PK; `titleId` FK→Title, must reference a
      `SERIES`-type Title; `number` integer), and `Episode` (`id` UUID PK; `seasonId` FK→Season;
      `number` integer; `name` string; `description` string; `published` boolean) models in
      `backend/prisma/schema.prisma`
- [X] T012 Add `MediaAsset` (`id` UUID PK; `ownerType` enum `TITLE`|`EPISODE`; `ownerId` UUID;
      `kind` enum `TRAILER`|`FULL`; `processingStatus` enum `PENDING`|`READY`|`FAILED`, default
      `PENDING`; `sourceObjectKey` string; `hlsManifestKey` string, nullable; `durationSeconds`
      integer, nullable; `createdAt`/`updatedAt`) model in `backend/prisma/schema.prisma`, with
      a unique constraint on `(ownerType, ownerId, kind)` enforcing data-model.md's rule of
      "exactly one `TRAILER` and at most one `FULL` MediaAsset per (ownerType, ownerId)"
- [X] T013 Add `Subscription` (`id` UUID PK; `userId` FK→User; `status` enum `ACTIVE`|`EXPIRED`;
      `startAt` timestamp; `expiresAt` timestamp; `transactionId` FK→Transaction, unique;
      `createdAt` timestamp) and `Transaction` (`id` UUID PK; `userId` FK→User; `method` enum
      `MPESA`|`BANK_GATEWAY`; `amount` decimal; `status` enum
      `PENDING`|`SUCCEEDED`|`FAILED`|`TIMED_OUT`; `providerReference` string, unique, nullable
      until the provider assigns one; `initiatedAt` timestamp; `resolvedAt` timestamp, nullable;
      `failureReason` string, nullable) models in `backend/prisma/schema.prisma`
- [X] T014 Generate and apply the initial Prisma migration (`prisma migrate dev --name init`)
      producing `backend/prisma/migrations/`
- [X] T015 [P] Create a seed script in `backend/prisma/seed.ts` that creates one default `ADMIN`
      user and two `Genre` rows, matching quickstart.md's documented first-run seed behavior
- [X] T016 [P] Implement `PrismaService`/`PrismaModule` in `backend/src/prisma/prisma.service.ts`
      and `backend/src/prisma/prisma.module.ts`
- [X] T017 [P] Implement environment configuration loading in
      `backend/src/config/config.module.ts` (validates `DATABASE_URL`, JWT secrets, Daraja
      credentials, Flutterwave keys, MinIO credentials, `REDIS_URL` from `.env`)
- [X] T018 [P] Implement a global exception filter and structured logger in
      `backend/src/common/filters/http-exception.filter.ts` and
      `backend/src/common/logger/logger.service.ts`
- [X] T019 Bootstrap the Nest application in `backend/src/main.ts`: global `ValidationPipe`,
      CORS configuration, the exception filter from T018, and the `/api` route prefix
- [X] T020 [P] Implement the object storage wrapper in
      `backend/src/common/storage/storage.service.ts` (AWS SDK v3 S3 client pointed at MinIO)
      exposing signed, time-expiring PUT (upload) and GET (playback) URL generation —
      Constitution Principle IV requires every media URL to be signed and time-expiring
- [X] T021 [P] Implement the BullMQ/Redis connection module in
      `backend/src/queue/queue.module.ts`, registering the transcode job queue
- [X] T022 Implement JWT + Passport auth scaffolding in `backend/src/auth/jwt.strategy.ts` and
      `backend/src/auth/auth.module.ts`: short-lived access tokens (15 min) returned in the
      response body, and rotating refresh tokens (30 days) issued as an httpOnly cookie
      (Constitution Principle IV)
- [X] T023 Implement `POST /api/auth/register` in `backend/src/auth/auth.controller.ts` and
      `backend/src/auth/auth.service.ts`: `201` with `{ user: {id,email,role}, accessToken,
      refreshToken }` on success; `409` if the email is already registered; `422` on an invalid
      email or a password that fails the minimum strength policy (contracts/auth-api.md)
- [X] T024 Implement `POST /api/auth/login` in `backend/src/auth/auth.controller.ts`: `200` with
      `{ user, accessToken, refreshToken }`; `401` on invalid credentials
- [X] T025 Implement `POST /api/auth/refresh` in `backend/src/auth/auth.controller.ts`: rotates
      the refresh token (Principle IV), `200` with `{ accessToken }` (new refresh token set via
      cookie); `401` if the refresh token is invalid, expired, or reused (revoked)
- [X] T026 Implement `POST /api/auth/logout` in `backend/src/auth/auth.controller.ts`: revokes
      the current refresh token, `204`
- [X] T027 Implement `GET /api/auth/me` in `backend/src/auth/auth.controller.ts`: `200` with
      `{ id, email, role, subscription: { status, expiresAt } | null }`; `401` if unauthenticated
- [X] T028 [P] Implement `RolesGuard` in `backend/src/common/guards/roles.guard.ts`, restricting
      access to `role = ADMIN` (FR-019) — used by every `/api/admin/*` endpoint
- [X] T029 [P] Implement `EntitlementGuard` in
      `backend/src/common/guards/entitlement.guard.ts`: a server-side check that an `ACTIVE`
      Subscription with `expiresAt` in the future exists for the requesting user — this MUST
      query Postgres and MUST NOT trust a client-supplied claim (Constitution Principle I)
- [X] T030 [P] Unit tests for `EntitlementGuard` covering subscribed, unsubscribed, and
      expired-subscription states in `backend/test/unit/entitlement.guard.spec.ts`
      (Constitution Principle V — MANDATORY before merge)
- [X] T031 [P] Scaffold the frontend app shell in `frontend/src/app/layout.tsx`, an API client in
      `frontend/src/lib/api-client.ts`, and auth/session helpers in `frontend/src/lib/auth.ts`
      (attaches the access token to requests, handles the httpOnly refresh-cookie flow)
- [X] T032 [P] Implement the shared video player component in
      `frontend/src/components/VideoPlayer.tsx` using `hls.js` for non-Safari browsers and
      native `<video>` HLS playback on Safari (research.md decision 8)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Browse the Catalog and Watch Trailers (Priority: P1) 🎯 MVP

**Goal**: A visitor with no account can browse published titles, open a title's detail page
(including a series' seasons/episodes), and play its trailer — while any attempt to play full
content is refused server-side.

**Independent Test**: Visit the site with no account, browse the catalog, open any title, and
play its trailer to completion; separately, confirm a direct call to the full-playback endpoint
is refused. Matches quickstart.md Scenario 1.

### Implementation for User Story 1

- [X] T033 [P] [US1] Implement `CatalogService` in `backend/src/catalog/catalog.service.ts`:
      list published titles with `genre`/`type`/`page`/`pageSize` filters; get a title by id
      with its seasons/episodes if `SERIES`; get an episode by id — only `published: true`
      titles/episodes are ever returned, and each entry's `trailer.ready` is derived from its
      TRAILER MediaAsset's `processingStatus = READY` (FR-001, FR-002, FR-018)
- [X] T034 [US1] Implement `GET /api/catalog/titles` in
      `backend/src/catalog/catalog.controller.ts` returning
      `{ items: [{id,type,name,posterUrl,genres}], page, pageSize, total }` (depends on T033)
- [X] T035 [US1] Implement `GET /api/catalog/titles/:titleId` in
      `backend/src/catalog/catalog.controller.ts` returning the movie or series shape from
      contracts/catalog-api.md, including `fullAvailable` derived from the `FULL` MediaAsset's
      `processingStatus = READY` and each `trailer.ready` from T033; `404` if not found or not
      published (depends on T033)
- [X] T036 [US1] Implement `GET /api/catalog/episodes/:episodeId` in
      `backend/src/catalog/catalog.controller.ts`, same episode shape as above (depends on T033)
- [X] T037 [P] [US1] Implement `MediaService.getTrailerUrl` in
      `backend/src/media/media.service.ts` using the storage wrapper (T020) to issue a signed
      GET URL; `404` if the asset is not found or not `READY`
- [X] T038 [US1] Implement `GET /api/media/:assetId/trailer-url` in
      `backend/src/media/media.controller.ts` — no auth required (FR-002); `200` with
      `{ url, expiresAt }`; `404` if not found/not ready (depends on T037)
- [X] T039 [US1] Implement `GET /api/media/:assetId/playback-url` in
      `backend/src/media/media.controller.ts`, protected by JWT auth and `EntitlementGuard`
      (T029): `401` if unauthenticated, `403` if authenticated but not entitled, `200` with a
      signed URL if entitled, `404` if the asset is not found/not ready (FR-003, FR-005)
- [X] T040 [P] [US1] Build the catalog browse page in `frontend/src/app/(public)/page.tsx`
      listing published titles with poster art and basic info
- [X] T041 [P] [US1] Build the title detail page in
      `frontend/src/app/(public)/titles/[titleId]/page.tsx` showing metadata, seasons/episodes
      for a series, and a trailer play button wired to `VideoPlayer` (T032) via
      `GET /api/media/:assetId/trailer-url`
- [X] T042 [US1] Wire the "play full" action on the title/episode detail pages to call
      `GET /api/media/:assetId/playback-url`, and surface a login/subscribe prompt on `401`/`403`
      instead of playing (acceptance scenario: direct full-playback attempt is refused)
- [X] T043 [US1] Add loading, error, and empty states to the catalog listing and trailer
      playback flows built above

**Checkpoint**: User Story 1 is fully functional and independently testable
(quickstart.md Scenario 1).

---

## Phase 4: User Story 2 - Subscribe and Unlock Full Playback (Priority: P1)

**Goal**: A logged-in user without an active subscription pays via M-Pesa STK push or the bank
gateway; on confirmed payment, their subscription activates immediately and full playback
unlocks without further action.

**Independent Test**: Register, initiate a subscription payment through either method, confirm
it, then successfully play a full movie/episode that was previously trailer-only. Matches
quickstart.md Scenarios 2, 3, 4, 7.

### Implementation for User Story 2

- [X] T044 [US2] Define the `PaymentProvider` interface (`initiate`, `verify`, `handleWebhook`)
      in `backend/src/payments/providers/provider.interface.ts`
- [X] T045 [P] [US2] Implement `MpesaProvider` in
      `backend/src/payments/providers/mpesa.provider.ts` wrapping the Safaricom Daraja STK Push
      API: initiate a push to a phone number, and verify Daraja's callback authentication
      mechanism (Constitution Principle II) (depends on T044)
- [X] T046 [P] [US2] Implement `BankGatewayProvider` in
      `backend/src/payments/providers/bank-gateway.provider.ts` wrapping Flutterwave's
      redirect-based card/bank-transfer checkout and verifying its webhook signature header
      (Constitution Principle II; research.md decision 2 — swappable behind T044's interface)
      (depends on T044)
- [X] T047 [US2] Implement `TransactionsService` in
      `backend/src/payments/transactions.service.ts`: enforce exactly one `PENDING` Transaction
      per user at a time (`409` on a conflicting new attempt, per data-model.md validation) and
      record every attempt including failed/timed-out ones (FR-020)
- [X] T048 [US2] Implement `SubscriptionsService.activateFromTransaction` in
      `backend/src/subscriptions/subscriptions.service.ts`: when a Transaction reaches
      `SUCCEEDED`, atomically (single DB transaction) mark it `SUCCEEDED` and create an `ACTIVE`
      Subscription with `startAt = now`, `expiresAt = now + 30 days`, linked via the unique
      `transactionId` FK (FR-009; data-model.md Subscription state transitions)
- [X] T049 [US2] Implement subscription-status derivation in
      `backend/src/subscriptions/subscriptions.service.ts`: a user is entitled iff an `ACTIVE`
      Subscription exists with `expiresAt` in the future; compute the effective `EXPIRED` state
      at read time (no scheduled sweep required for MVP scale) (FR-012)
- [X] T050 [P] [US2] Unit tests for `SubscriptionsService` covering activation, read-time
      expiry, and that a repeat successful payment creates a new period without corrupting the
      prior one, in `backend/test/unit/subscriptions.service.spec.ts` (Constitution Principle V
      — MANDATORY before merge)
- [X] T051 [US2] Implement `POST /api/payments/mpesa/initiate` in
      `backend/src/payments/payments.controller.ts`: `422` on an invalid phone number format,
      `409` if a `PENDING` Transaction already exists for the user, else create a `PENDING`
      Transaction and call `MpesaProvider.initiate`; `202` with `{ transactionId,
      status: "PENDING" }` (depends on T045, T047)
- [X] T052 [US2] Implement `GET /api/payments/:transactionId/status` in
      `backend/src/payments/payments.controller.ts` returning
      `{ transactionId, status, resolvedAt }` for frontend polling (FR-011)
- [X] T053 [US2] Implement `POST /api/payments/mpesa/callback` in
      `backend/src/payments/payments.controller.ts`: unauthenticated route, verified via
      Daraja's callback authentication mechanism; idempotent by `providerReference` (a repeat
      callback for an already-resolved Transaction is a no-op); always returns `200`; on
      success, calls `SubscriptionsService.activateFromTransaction` (FR-008, FR-009, FR-010)
      (depends on T045, T048)
- [X] T054 [P] [US2] Integration tests for the M-Pesa webhook handler covering signature
      verification failure, first-delivery success (activates the subscription), a replayed
      duplicate delivery (no-op, no double-activation), and failure/timeout outcomes, in
      `backend/test/integration/mpesa-webhook.spec.ts` (Constitution Principle V — MANDATORY;
      validates SC-007)
- [X] T055 [US2] Implement `POST /api/payments/bank-gateway/initiate` in
      `backend/src/payments/payments.controller.ts`: same pending-conflict rule as M-Pesa;
      create a `PENDING` Transaction and call `BankGatewayProvider.initiate`; `201` with
      `{ transactionId, redirectUrl }` (depends on T046, T047)
- [X] T056 [US2] Implement `POST /api/payments/bank-gateway/webhook` in
      `backend/src/payments/payments.controller.ts`: verified via the gateway's webhook
      signature header, idempotent by `providerReference`, `200` ack; on success calls
      `SubscriptionsService.activateFromTransaction` (depends on T046, T048)
- [X] T057 [P] [US2] Integration tests for the bank-gateway webhook handler covering signature
      verification failure, first-delivery success, a replayed duplicate delivery, and failure
      outcomes, in `backend/test/integration/bank-gateway-webhook.spec.ts` (Constitution
      Principle V — MANDATORY; validates SC-007)
- [X] T058 [US2] Implement a background timeout sweep for M-Pesa STK pushes that never resolve:
      mark `PENDING` Transactions `TIMED_OUT` after the provider's expected response window, in
      `backend/src/payments/payments.service.ts` (Edge Case: STK push the user never responds to
      must not be left pending forever, and must be retryable)
- [X] T059 [P] [US2] Build the subscribe/checkout page in
      `frontend/src/app/(account)/subscribe/page.tsx` letting the user choose M-Pesa or bank
      payment
- [X] T060 [US2] Build the M-Pesa flow UI in `frontend/src/app/(account)/subscribe/page.tsx`:
      phone-number form, `POST` to `mpesa/initiate`, then poll
      `GET /api/payments/:transactionId/status` until a terminal state, reflecting
      success/failure/timeout without indefinite manual refresh (FR-011, SC-006) (depends on
      T059)
- [X] T061 [US2] Build the bank-gateway flow UI in
      `frontend/src/app/(account)/subscribe/page.tsx` and a return page in
      `frontend/src/app/(account)/subscribe/return/page.tsx`: redirect to `redirectUrl`, then
      show the outcome on return (depends on T059)
- [X] T062 [US2] After a successful subscribe, refresh entitlement state (re-fetch
      `GET /api/auth/me` or `/api/subscriptions/me`) so the full-playback action built in T042
      unlocks immediately with no further user action (FR-009 acceptance scenario 4)

**Checkpoint**: User Stories 1 AND 2 both work independently
(quickstart.md Scenarios 2, 3, 4, 7).

---

## Phase 5: User Story 3 - View Subscription Status and Billing History (Priority: P2)

**Goal**: A logged-in subscriber can see whether their subscription is active, its
expiry/renewal date, and their past payment attempts.

**Independent Test**: Log in as a user with at least one past payment and confirm the account
page shows accurate current status and a list of past transactions with date, amount, method,
and outcome. Matches quickstart.md Scenario 5.

### Implementation for User Story 3

- [X] T063 [US3] Implement `GET /api/subscriptions/me` in
      `backend/src/subscriptions/subscriptions.controller.ts` returning
      `{ status: "ACTIVE" | "EXPIRED" | "NONE", expiresAt: string | null }` (FR-013)
- [X] T064 [US3] Implement `GET /api/payments/history` in
      `backend/src/payments/payments.controller.ts` returning
      `{ items: [{id,method,amount,status,initiatedAt,resolvedAt}] }`, most recent first
      (FR-014, FR-020)
- [X] T065 [P] [US3] Build the account/billing page in
      `frontend/src/app/(account)/billing/page.tsx` showing current subscription status and
      expiry/renewal date (SC-004: visible within 3 seconds of opening the page) plus a payment
      history table with date, amount, method, and outcome

**Checkpoint**: User Stories 1, 2, AND 3 all work independently (quickstart.md Scenario 5).

---

## Phase 6: User Story 4 - Manage Content Catalog (Priority: P2)

**Goal**: An admin creates a title (movie or series with seasons/episodes), uploads a trailer
and full video for each watchable unit, and publishes it so it appears in the public catalog.

**Independent Test**: Log in as an admin, create a new movie title with a trailer and full
video upload and metadata, and confirm it becomes visible to visitors in the public catalog
once published. Matches quickstart.md Scenario 6.

### Implementation for User Story 4

- [X] T066 [P] [US4] Implement `AdminTitlesService` in
      `backend/src/catalog/admin/admin-titles.service.ts`: create a title (`type`
      `MOVIE`|`SERIES`), edit metadata/`published` flag — enforce that a title cannot be
      published with no `READY` playable content beneath it (a movie: its `FULL` asset ready; a
      series: at least one published episode whose `FULL` asset is ready)
- [X] T067 [US4] Implement `POST /api/admin/titles` and `PATCH /api/admin/titles/:titleId` in
      `backend/src/catalog/admin/admin.controller.ts`, guarded by `RolesGuard` (T028) requiring
      `role = ADMIN` (FR-015, FR-019) (depends on T066)
- [X] T068 [US4] Implement `POST /api/admin/titles/:titleId/seasons` (`422` unless the title's
      `type = SERIES`) and `POST /api/admin/seasons/:seasonId/episodes` in
      `backend/src/catalog/admin/admin.controller.ts`
- [X] T069 [US4] Implement `PATCH /api/admin/episodes/:episodeId` in
      `backend/src/catalog/admin/admin.controller.ts` for metadata and/or `published` flag edits
- [X] T070 [US4] Implement `POST /api/admin/media-assets` in
      `backend/src/media/admin/admin-media.controller.ts`, guarded by `RolesGuard` (T028)
      requiring `role = ADMIN` (FR-019): registers a `MediaAsset` (`ownerType`, `ownerId`,
      `kind`) after validating that `ownerId` references an existing row of the stated
      `ownerType` (Title or Episode — `ownerId` is a polymorphic reference with no DB-level FK,
      per data-model.md), then returns a signed PUT `uploadUrl` via the storage wrapper (T020);
      the unique `(ownerType, ownerId, kind)` constraint from T012 enforces at most one
      `TRAILER` and one `FULL` asset per owner
- [X] T071 [US4] Implement `POST /api/admin/media-assets/:assetId/complete-upload` in
      `backend/src/media/admin/admin-media.controller.ts`, guarded by `RolesGuard` (T028):
      enqueues a transcode BullMQ job (T021) for `kind = FULL` assets and sets
      `processingStatus = PENDING`; `202` with `{ assetId, processingStatus: "PENDING" }`
      (FR-016, FR-017, FR-019)
- [X] T072 [US4] Implement `GET /api/admin/media-assets/:assetId` in
      `backend/src/media/admin/admin-media.controller.ts`, guarded by `RolesGuard` (T028),
      returning `{ assetId, processingStatus, failureReason? }` for polling (FR-018, FR-019;
      Edge Case: transcode failure surfaced to the admin)
- [X] T073 [US4] Implement the transcode processor in
      `backend/src/worker/transcode.processor.ts`: downloads the source object, runs `ffmpeg`
      (via `fluent-ffmpeg`) to produce multi-bitrate HLS renditions, uploads the output back to
      object storage, and sets `hlsManifestKey` + `processingStatus = READY` on success or
      `processingStatus = FAILED` with `failureReason` on error (FR-017, FR-018)
- [X] T074 [US4] Implement the worker entrypoint in `backend/src/worker/main.worker.ts`,
      bootstrapping a separate process from the API that connects to the transcode queue (T021)
      and runs the processor from T073
- [X] T075 [P] Add the worker Docker build target to `backend/Dockerfile`: multi-stage build
      producing an `api` target (no ffmpeg) and a `worker` target with the `ffmpeg` binary
      installed, per plan.md's Structure Decision
- [X] T076 [P] [US4] Build the admin title/season/episode CRUD UI in
      `frontend/src/app/(admin)/titles/page.tsx` and
      `frontend/src/app/(admin)/titles/[titleId]/page.tsx`
- [X] T077 [US4] Build the admin video upload UI in
      `frontend/src/app/(admin)/titles/[titleId]/upload/page.tsx`: requests an upload target,
      PUTs the raw file directly to the signed `uploadUrl`, calls `complete-upload`, then polls
      processing status until `READY`/`FAILED`
- [X] T078 [US4] Wire the "publish" toggle in the admin title UI to
      `PATCH /api/admin/titles/:titleId`, disabling it with an explanation when no `READY`
      playable content exists yet (matches the guard implemented in T066)

**Checkpoint**: All four user stories are independently functional (quickstart.md Scenario 6).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Bring-up wiring, security hardening, and end-to-end validation across all stories

- [X] T079 [P] Add a MinIO bucket bootstrap script in `docker/minio/` creating the buckets used
      by `storage.service.ts` (T020) on first `docker compose up`
- [X] T080 Finalize `docker-compose.yml` wiring all six services (`postgres`, `redis`, `minio`,
      `backend-api`, `backend-worker`, `frontend`), with `backend-api` running
      `prisma migrate deploy` then the seed script (T015) on startup, per quickstart.md
- [X] T081 [P] Add rate limiting to the auth and payment-initiation endpoints in
      `backend/src/main.ts` / the relevant controllers (Constitution Principle IV)
- [X] T082 [P] Enforce secure, HTTPS-only cookie flags for the refresh-token cookie when
      `NODE_ENV=production` (Constitution Principle IV)
- [X] T083 [P] Write the root `README.md` documenting `docker compose up --build` bring-up and
      pointing to `specs/001-streaming-platform-mvp/quickstart.md`
- [ ] T084 Execute quickstart.md Scenarios 1–7 end-to-end against the running Docker Compose
      stack and fix any gaps found
      **Partially done**: `docker compose up --build` brings up all 6 services cleanly (fixed
      two real bugs found this way: a Next.js route-group collision between the admin and
      public `/titles/[titleId]` pages, and Prisma's engine needing `openssl` on Alpine).
      Verified live: catalog loads empty-state correctly, register works, and an unauthenticated
      `playback-url` call returns 401 (Scenario 1's core assertion). Scenarios 2–4 and 6 still
      need a human with real Daraja/Flutterwave sandbox credentials and a sample video file to
      run end-to-end — no such credentials exist in this environment.
- [X] T085 [P] Add Playwright end-to-end coverage for the four user-story flows in
      `frontend/e2e/` (RECOMMENDED per plan.md, not blocking)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends only on Foundational
- **User Story 2 (Phase 4)**: Depends only on Foundational; reuses the `playback-url` endpoint
  built in US1 (T039) and the frontend hook point from T042, but is independently testable via
  its own payment-initiate/status/webhook endpoints
- **User Story 3 (Phase 5)**: Depends only on Foundational; reads Subscription/Transaction data
  that US2 creates, but its own endpoints work correctly even against zero-payment data (an
  empty/`"NONE"` state)
- **User Story 4 (Phase 6)**: Depends only on Foundational (uses the Title/Season/Episode/
  MediaAsset schema and the queue/storage infrastructure from Phase 2); independent of US1–US3
- **Polish (Phase 7)**: Depends on all four user stories being complete

### Within Each User Story

- Services before controllers/endpoints that use them
- Backend endpoints before the frontend pages that call them
- Mandatory Principle V tests (T030, T050, T054, T057) can be written alongside their
  implementation task, but must pass before that story is considered done

### Parallel Opportunities

- All Setup tasks marked `[P]` (T002–T007) can run in parallel
- Within Foundational, T015–T021 and T028–T032 (marked `[P]`) can run in parallel once the
  Prisma schema (T010–T014) is committed
- Once Foundational is complete, **US1, US2, US3, and US4 can be staffed and built in parallel**
  by different developers — none of them blocks another at the Foundational boundary
- Within US2, the two provider implementations (T045, T046) and the two webhook integration
  test suites (T054, T057) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# After T010-T014 (Prisma schema + migration) land, run these together:
Task: "Create seed script in backend/prisma/seed.ts"
Task: "Implement PrismaService/PrismaModule in backend/src/prisma/"
Task: "Implement environment configuration module in backend/src/config/config.module.ts"
Task: "Implement global exception filter and structured logger in backend/src/common/"
Task: "Implement object storage wrapper in backend/src/common/storage/storage.service.ts"
Task: "Implement BullMQ/Redis connection module in backend/src/queue/queue.module.ts"
```

## Parallel Example: User Story 2

```bash
# Once TransactionsService (T047) exists, run the two providers together:
Task: "Implement MpesaProvider in backend/src/payments/providers/mpesa.provider.ts"
Task: "Implement BankGatewayProvider in backend/src/payments/providers/bank-gateway.provider.ts"

# And their mandatory webhook tests together:
Task: "Integration tests for the M-Pesa webhook handler in backend/test/integration/mpesa-webhook.spec.ts"
Task: "Integration tests for the bank-gateway webhook handler in backend/test/integration/bank-gateway-webhook.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 independently
5. Demo the catalog-and-trailers experience

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate → demo (catalog/trailers MVP)
3. Add User Story 2 → validate → demo (the platform's revenue path — the true product MVP)
4. Add User Story 3 → validate → demo (self-serve billing visibility)
5. Add User Story 4 → validate → demo (admins can grow the catalog without engineering help)
6. Phase 7 polish, then a full quickstart.md run before considering the MVP done

### Parallel Team Strategy

With multiple developers, after Foundational is done:
- Developer A: User Story 1 (catalog/trailers)
- Developer B: User Story 2 (payments/subscriptions) — highest complexity, start it earliest
  if the team is small
- Developer C: User Story 3 (billing UI) + User Story 4 (admin CMS) in sequence, since both are
  P2 and lower-complexity than US2
