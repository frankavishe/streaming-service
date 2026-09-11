<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added sections: Core Principles (I–V), Technology & Architecture Constraints,
  Development Workflow & Quality Gates, Governance
- Removed sections: none
- Templates requiring updates: .specify/templates/plan-template.md (✅ no changes needed —
  reads constitution at runtime), .specify/templates/spec-template.md (✅), .specify/templates/tasks-template.md (✅)
- Follow-up TODOs: none
-->

# Streaming Service Constitution

## Core Principles

### I. Subscription-Gated Access
Full-length content (movies and episodes) MUST be served only to users with a currently
active subscription. Unauthenticated or unsubscribed users MAY access only trailer/preview
assets for a title. Entitlement (does this user have an active subscription right now?) MUST
be verified server-side on every playback request — a client-side flag or cached claim is
never sufficient authorization. Signed, time-expiring URLs MUST be used for full-content
manifests/segments so a leaked link cannot grant indefinite access.
Rationale: the business only earns revenue if paid access is actually enforced; this is the
product's core invariant and the one principle every other decision is subordinate to.

### II. Payment Integrity
Payment provider callbacks (M-Pesa Daraja STK push callbacks, bank gateway webhooks) MUST be
verified as genuinely originating from the provider (signature/source IP/shared-secret
verification per provider) before being trusted. Every webhook handler MUST be idempotent —
replays or duplicate deliveries MUST NOT double-activate or double-charge a subscription. A
subscription MUST only transition to active after its corresponding transaction is persisted
with a definitive success status; partial/pending/failed transactions MUST NOT grant access.
Rationale: money and access-granting logic is the highest-blast-radius code in the system;
correctness here is non-negotiable and errors are either lost revenue or given-away content.

### III. Docker-First Development
Every service the platform depends on to run — API (NestJS), web (Next.js), PostgreSQL,
cache/queue (e.g. Redis), object storage (e.g. MinIO/S3-compatible), and the video transcoding
worker — MUST be runnable via Docker Compose. `docker compose up` MUST bring up a fully working
local environment from a clean checkout, with no undocumented host-machine dependency (no
"also install ffmpeg locally", no "also run a local Postgres"). Environment configuration MUST
flow through `.env` files documented in an `.env.example`, never hardcoded.
Rationale: a multi-service media platform (transcoding, queues, object storage, DB) is
unreasonable to onboard or deploy reliably without one reproducible command to start it.

### IV. Secure by Default
Secrets and API keys (M-Pesa Daraja credentials, bank gateway keys, JWT signing secrets,
database credentials) MUST NOT be committed to the repository. Authentication MUST use
short-lived JWT access tokens with refresh-token rotation. All media playback URLs (trailers
and full content alike) MUST be signed and time-expiring rather than permanent public links.
All payment and auth endpoints MUST be served over HTTPS in any non-local environment.
Rationale: a subscription service handles both payment data and licensed media; both are
attractive abuse targets, so security is a default posture, not an add-on.

### V. Test Coverage for Money & Access Paths
Automated tests are REQUIRED, before merge, for: subscription entitlement checks (subscribed
vs. unsubscribed vs. expired), the subscription lifecycle (activation, expiry, renewal), and
payment webhook handling (signature verification, idempotency/replay behavior, success and
failure paths) for every integrated payment provider. Other areas SHOULD have tests but are
not blocked on this gate; these three areas MUST.
Rationale: these are the paths where a bug directly costs money or gives away the product for
free — they get the strictest bar in the codebase.

## Technology & Architecture Constraints

- Backend: NestJS (TypeScript). Frontend: Next.js (TypeScript). Database: PostgreSQL.
- Video content model supports both standalone movies and TV series composed of
  seasons/episodes; every watchable unit (movie or episode) has its own trailer asset and
  full-video asset.
- Full-video assets are delivered as adaptive-bitrate HLS, produced by a transcoding pipeline
  (upload → queued transcode job → HLS renditions in object storage). Trailer assets may use a
  simpler delivery path but MUST still be access-controlled per Principle I.
- Payments integrate M-Pesa (mobile money, e.g. Daraja STK push) and a bank payment gateway
  (card/bank transfer) behind a common payment-provider interface, so a provider can be added
  or swapped without changing subscription/entitlement business logic.
- The subscription model is a single plan (one price, full catalog access) unless a future
  amendment to this constitution and the spec explicitly introduces multiple tiers.

## Development Workflow & Quality Gates

- Work proceeds through the Spec Kit flow: `/speckit-constitution` → `/speckit-specify` →
  (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` → (`/speckit-analyze`) →
  `/speckit-implement`. Implementation should not begin on a feature ahead of its spec/plan.
- Every plan and task list MUST be checked against this constitution; a plan that conflicts
  with a Core Principle MUST either be revised or the conflict explicitly justified and
  recorded before implementation proceeds.
- Pull requests touching entitlement, subscription lifecycle, or payment webhook code MUST
  include or update the tests required by Principle V before merge.

## Governance

This constitution supersedes other informal practices for this project. Amendments are made
by editing this file: propose the change, update the affected principle/section, bump the
version per the policy below, and update `LAST_AMENDED_DATE`.

Versioning policy (semantic versioning applied to governance):
- MAJOR: backward-incompatible principle removal or redefinition.
- MINOR: a new principle or materially expanded section is added.
- PATCH: wording clarifications or non-semantic fixes.

Every `/speckit-plan` run MUST verify its approach against this constitution's Core
Principles and Technology & Architecture Constraints before proceeding to tasks.

**Version**: 1.0.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11
