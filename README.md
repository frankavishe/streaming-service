# Streaming Platform MVP

A subscription video streaming platform: browse a catalog and watch trailers free; register,
subscribe (M-Pesa or bank/card), and unlock full-length movies and series. See
[`specs/001-streaming-platform-mvp/`](specs/001-streaming-platform-mvp/) for the full spec, plan,
data model, API contracts, and task breakdown, and
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) for the project's governing
principles.

## Stack

- **Backend**: NestJS (TypeScript) + Prisma/PostgreSQL, BullMQ/Redis for the transcode queue,
  MinIO (S3-compatible) for media storage.
- **Frontend**: Next.js (App Router).
- **Payments**: Safaricom Daraja (M-Pesa STK Push) and Flutterwave (card/bank transfer).
- **Video**: uploaded full videos are transcoded to adaptive-bitrate HLS by a BullMQ worker
  running `ffmpeg`.

## Bring up the stack

```sh
cp .env.example .env   # then fill in real payment-provider credentials
docker compose up --build
```

This starts `postgres`, `redis`, `minio`, `backend-api`, `backend-worker`, and `frontend`.
`backend-api` runs `prisma migrate deploy` and seeds a default admin user + two genres on first
boot (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`).

- Frontend: http://localhost:3000
- API: http://localhost:3001/api
- MinIO console: http://localhost:9001

If port 5432 is already taken by a native Postgres install on your machine, set
`POSTGRES_HOST_PORT` in `.env` to an alternate host port before running `docker compose up`.

## Validating it works

Walk through [`specs/001-streaming-platform-mvp/quickstart.md`](specs/001-streaming-platform-mvp/quickstart.md)
end-to-end (catalog/trailers, both payment flows, webhook-replay idempotency, billing history,
admin content upload, and subscription expiry).

## Local development (without Docker for the app code)

```sh
# infra only
docker compose up -d postgres redis minio minio-bootstrap

cd backend && npm install && npm run prisma:migrate:dev && npm run start:dev
cd frontend && npm install && npm run dev
```

Backend tests: `cd backend && npm test`. The three areas the project constitution (Principle V)
requires tests for — the entitlement guard, the subscription lifecycle, and both payment webhook
handlers — live under `backend/test/unit/` and `backend/test/integration/`.
