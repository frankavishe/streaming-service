# Implementation Plan: Streaming Platform MVP

**Branch**: `001-streaming-platform-mvp` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-streaming-platform-mvp/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A subscription-gated video streaming platform. Visitors browse a catalog of movies and series
(with seasons/episodes) and can always watch trailers; full playback requires an account with an
active single-tier subscription, paid via M-Pesa mobile money (STK push) or a bank payment
gateway (card/bank transfer). Technical approach: a NestJS API backend and Next.js frontend
sharing a PostgreSQL database (via Prisma), with uploaded video processed into adaptive-bitrate
HLS by an ffmpeg-based worker queued through Redis/BullMQ, assets held in S3-compatible object
storage (MinIO locally), and the whole stack run via Docker Compose per Constitution Principle
III. See `research.md` for the choices behind each dependency.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS, for both the NestJS backend and the
Next.js frontend.

**Primary Dependencies**: NestJS 10 (API framework), Next.js 14+ (App Router, frontend),
Prisma ORM (Postgres access + migrations), Passport + `@nestjs/jwt` (authentication),
BullMQ + ioredis (transcode job queue), `fluent-ffmpeg` wrapping the `ffmpeg` binary (HLS
transcoding), AWS SDK v3 S3 client (talks to MinIO locally, any S3-compatible store in prod),
`hls.js` (frontend adaptive playback), Safaricom Daraja REST API (M-Pesa STK push + callback),
Flutterwave Node SDK/REST API (bank/card payment + webhook). See `research.md` for rationale
and alternatives considered for each.

**Storage**: PostgreSQL 16 (users, titles/seasons/episodes, subscriptions, transactions, media
asset records); Redis 7 (BullMQ transcode queue, short-lived cache); MinIO (S3-compatible
object storage for source uploads, HLS renditions, poster/trailer images).

**Testing**: Jest (NestJS unit + integration tests) + Supertest (API/e2e tests against a test
Postgres) — REQUIRED for entitlement checks, subscription lifecycle, and both payment webhook
handlers per Constitution Principle V. Jest + React Testing Library for frontend unit tests.
Playwright end-to-end coverage of the four user-story flows is RECOMMENDED but not blocking.

**Target Platform**: Linux containers orchestrated by Docker Compose (local dev and prod-like
environments alike); the frontend targets modern desktop and mobile web browsers.

**Project Type**: Web application — separate frontend and backend, in one repository.

**Performance Goals**: Subscribe-to-playback under 5 minutes end-to-end including payment
confirmation (spec SC-002); payment outcome (success/failure/timeout) reflected on-site within
60 seconds of the user completing/abandoning it on their phone (spec SC-006); non-video API
endpoints respond within ~300ms p95 under expected MVP load.

**Constraints**: Full-content playback URLs MUST be signed and time-expiring (Constitution
Principle I/IV — not permanent public links); all payment webhook handlers MUST verify the
provider's authenticity and be idempotent (Principle II); the entire stack MUST come up via
`docker compose up` with no undocumented host dependency (Principle III).

**Scale/Scope**: MVP scale — catalog on the order of hundreds of titles/episodes, concurrent
viewers in the low hundreds. Not designing for CDN/global-edge scale on day one; a CDN can be
layered in front of object storage later without changing the data model or API contracts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan satisfies it | Status |
|---|---|---|
| I. Subscription-Gated Access | Every full-media endpoint is protected by a server-side entitlement guard (checks subscription status from Postgres, not a client-supplied claim); trailer endpoints are the only unauthenticated media routes; full-media URLs are short-lived signed URLs. | PASS |
| II. Payment Integrity | M-Pesa Daraja callback and Flutterwave webhook are each verified (provider signature/shared-secret + expected source) before use; each transaction is persisted with a unique provider reference used as an idempotency key so replayed callbacks are no-ops; subscription activation only happens after a transaction record reaches a definitive "succeeded" status. | PASS |
| III. Docker-First Development | `docker-compose.yml` defines postgres, redis, minio, backend (api), backend (worker), and frontend services; `.env.example` documents all required config; no step requires a host-installed database, ffmpeg, or Node version beyond the container images. | PASS |
| IV. Secure by Default | JWT access tokens (short TTL) + refresh-token rotation via NestJS/Passport; secrets read from `.env`, never committed (`.gitignore` already covers this); all media playback (trailer and full alike) served via signed, expiring URLs. | PASS |
| V. Test Coverage for Money & Access Paths | Jest/Supertest suites required, before merge, for: the entitlement guard (subscribed/unsubscribed/expired), the subscription lifecycle service (activation/expiry/renewal), and both payment webhook handlers (signature verification, idempotency/replay, success/failure paths). | PASS |

No violations — Complexity Tracking is not needed.

**Post-Design Re-Check** (after Phase 1 `data-model.md`/`contracts/`/`quickstart.md`): the
entitlement guard maps directly onto `GET /api/media/:assetId/playback-url` (Principle I); both
payment webhook contracts specify provider verification + `providerReference` idempotency
(Principle II); the data model and contracts introduce no service that falls outside the
Docker Compose topology in Project Structure (Principle III); all media contracts return
short-lived signed URLs, never bucket paths (Principle IV); Quickstart Scenario 4 explicitly
exercises webhook-replay idempotency and Scenario 7 exercises expiry revocation, giving the
Principle V test requirements concrete scenarios to automate. Still PASS, no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-streaming-platform-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/             # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/                          # NestJS API (also builds the transcode worker target)
├── src/
│   ├── auth/                     # registration, login, JWT + refresh-token rotation
│   ├── users/                    # user profile, role (user/admin)
│   ├── catalog/                  # titles, seasons, episodes, genres; public + admin endpoints
│   ├── subscriptions/            # subscription lifecycle (activate/expire), entitlement guard
│   ├── payments/
│   │   ├── providers/            # provider.interface.ts, mpesa.provider.ts, bank-gateway.provider.ts
│   │   └── payments.controller.ts (initiate payment, provider webhooks)
│   ├── media/                    # upload intake, signed URL issuing for trailer/full playback
│   ├── worker/                   # BullMQ processor entrypoint: transcode.processor.ts, main.worker.ts
│   ├── prisma/                   # PrismaService/module
│   └── common/                   # guards (EntitlementGuard, RolesGuard), interceptors, filters
├── prisma/
│   └── schema.prisma
├── test/                         # Jest unit + Supertest integration tests
├── Dockerfile                    # multi-stage: shared build → `api` target and `worker` target
└── package.json

frontend/                         # Next.js (App Router)
├── src/
│   ├── app/
│   │   ├── (public)/             # catalog browse, title/episode detail + trailer playback
│   │   ├── (auth)/               # register, login
│   │   ├── (account)/            # subscribe/checkout, billing history, subscription status
│   │   └── (admin)/              # title/season/episode CRUD, video upload
│   ├── components/
│   ├── lib/                      # API client, session/auth helpers, hls.js player wrapper
│   └── styles/
├── test/                         # Jest + React Testing Library
├── Dockerfile
└── package.json

docker/
├── postgres/                     # init scripts (if any)
└── minio/                        # bucket bootstrap script

docker-compose.yml                 # postgres, redis, minio, backend-api, backend-worker, frontend
.env.example
```

**Structure Decision**: Web application layout (frontend + backend) as suggested by the
template's Option 2, with one addition: the transcode worker is not a separate top-level
project — it is a second Docker build target of `backend/` (same NestJS source, sharing Prisma
models/config) so trailer/media DTOs and entities aren't duplicated across two codebases. The
worker container installs `ffmpeg`; the api container does not need it.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
