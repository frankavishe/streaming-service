# Phase 0 Research: Streaming Platform MVP

Each open technical decision from the Technical Context is resolved below as
Decision / Rationale / Alternatives considered.

## 1. ORM / database access — Prisma

- **Decision**: Prisma ORM (`@prisma/client` + `prisma migrate`) as the sole data-access layer
  for PostgreSQL.
- **Rationale**: strong TypeScript type inference for the entity graph in `data-model.md`
  (User → Subscription → Transaction, Title → Season → Episode → MediaAsset), first-class
  migration tooling that fits the Docker-first workflow (`prisma migrate deploy` as a container
  init step), and a schema file that doubles as living documentation of the data model.
- **Alternatives considered**: TypeORM (NestJS's other common choice) — rejected for this
  project because its migration DX is weaker and decorator-based entities duplicate what
  `prisma/schema.prisma` already gives us in one place. Raw SQL/Knex — rejected, too much
  boilerplate for the relational graph size here.

## 2. Bank payment gateway — Flutterwave

- **Decision**: Flutterwave as the bank/card payment gateway, integrated alongside M-Pesa.
- **Rationale**: strong coverage in the same East African market as M-Pesa, supports card and
  direct bank transfer in one integration, has a standard webhook model that fits the
  Payment Integrity principle (signed webhook payloads, verifiable via a secret hash header).
- **Alternatives considered**: Paystack (equally viable, primarily strongest in Nigeria/Ghana)
  — kept as the fallback option. Because `payments/providers/` implements a common
  `PaymentProvider` interface (`initiate`, `verify`, `handleWebhook`), swapping to Paystack (or
  adding it as a second bank-payment option) later does not require touching subscription or
  entitlement logic. **Flag for user confirmation**: if Flutterwave isn't the desired gateway,
  say so before `/speckit-tasks` and only the `bank-gateway.provider.ts` implementation changes.

## 3. Mobile payment — M-Pesa Daraja API

- **Decision**: Safaricom Daraja API, STK Push (Lipa na M-Pesa Online) flow: initiate a push to
  the user's phone, receive an async callback on a registered URL, poll/display status to the
  user in the meantime.
- **Rationale**: this was specified directly by the product owner and is the standard mobile
  money API for the target market.
- **Alternatives considered**: none — provider was a given requirement, not an open choice.

## 4. Video transcoding pipeline — ffmpeg + BullMQ worker

- **Decision**: On upload, the full-video asset is stored in object storage, then a BullMQ job
  is enqueued; a separate worker process (same NestJS codebase, different Docker build target)
  picks it up and runs `ffmpeg` to produce multi-bitrate HLS renditions (segments + variant
  playlist), uploading the output back to object storage and marking the `MediaAsset` `ready`.
- **Rationale**: ffmpeg is the de facto standard for HLS packaging; a queue decouples the
  (potentially slow) transcode from the upload request and lets the worker scale/restart
  independently of the API, matching Constitution Principle III (every service is its own
  container) and satisfying FR-017/FR-018 (asset not playable until processing succeeds).
- **Alternatives considered**: a managed transcoding service (e.g. AWS MediaConvert / Mux) —
  rejected for the MVP to avoid a cloud-provider dependency conflicting with the Docker-first,
  self-hostable principle; can be revisited later behind the same `MediaAsset` abstraction if
  self-hosted transcoding doesn't scale.

## 5. Object storage — MinIO (S3-compatible)

- **Decision**: MinIO as a Docker Compose service for local/dev (and self-hostable prod),
  accessed through the AWS SDK v3 S3 client so any real S3-compatible provider is a drop-in
  swap via config.
- **Rationale**: keeps Principle III intact (`docker compose up` needs no external cloud
  account to develop against) while using an API (S3) portable to a managed provider later.
- **Alternatives considered**: local filesystem volume — rejected, doesn't mirror how
  production object storage/signed-URL behavior actually works, and complicates the
  container-to-container video serving path.

## 6. Job queue / cache — Redis + BullMQ

- **Decision**: Redis 7 as both the BullMQ queue backend for transcode jobs and general
  short-lived cache (e.g. payment-status polling reads).
- **Rationale**: BullMQ is the standard NestJS-compatible queue library on Redis; one Redis
  instance serves both needs at MVP scale, avoiding an extra service.
- **Alternatives considered**: RabbitMQ — heavier operationally for one job type at this scale;
  not chosen for the MVP.

## 7. Authentication — JWT access + refresh tokens (NestJS Passport)

- **Decision**: `@nestjs/passport` + `@nestjs/jwt`, short-lived access token (e.g. 15 min) plus
  a rotating refresh token (e.g. 30 days) stored httpOnly-cookie side on the Next.js frontend.
- **Rationale**: directly satisfies Constitution Principle IV (secure by default) without
  pulling in a third-party auth provider the product doesn't need for a single-role-model MVP.
- **Alternatives considered**: NextAuth.js on the frontend — rejected because the source of
  truth for entitlement must be the NestJS API (Principle I: server-side verification), so
  routing auth through a separate frontend-owned session system would duplicate/complicate that.

## 8. Frontend video playback — hls.js

- **Decision**: `hls.js` in the Next.js player component, falling back to native HLS support on
  Safari (which plays `.m3u8` natively via `<video>`).
- **Rationale**: standard, widely used client for HLS playback in non-Safari browsers.
- **Alternatives considered**: Video.js with an HLS plugin — more features than needed for the
  MVP's single-player use case; can revisit if richer player UI (quality selector UI, etc.)
  becomes a requirement.

## Summary of items flagged for confirmation before `/speckit-tasks`

- Bank gateway: Flutterwave assumed; confirm or swap to Paystack/other.
- Access/refresh token lifetimes above are defaults; confirm or adjust.
