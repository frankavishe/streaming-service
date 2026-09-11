# Contract: Subscriptions & Payments API

Base path: `/api/subscriptions`, `/api/payments`. All non-webhook endpoints require a Bearer
access token.

## GET /api/subscriptions/me

**Responses**: `200` → `{ status: "ACTIVE" | "EXPIRED" | "NONE", expiresAt: string | null }`
(FR-013, SC-004)

## GET /api/payments/history

**Responses**: `200` → `{ items: [{ id, method, amount, status, initiatedAt, resolvedAt }] }`
(FR-014)

## POST /api/payments/mpesa/initiate

Starts an M-Pesa STK push (FR-006). Rejected if the user already has a `PENDING` Transaction
(Edge Case: no conflicting duplicate payment).

**Request body**: `{ phoneNumber: string }`

**Responses**:
- `202` → `{ transactionId, status: "PENDING" }` — push sent, awaiting the user's phone.
- `409` → a payment is already pending for this user.
- `422` → invalid phone number format.

## GET /api/payments/:transactionId/status

Polled by the frontend while a Transaction is `PENDING` (FR-011).

**Responses**: `200` → `{ transactionId, status, resolvedAt: string | null }`

## POST /api/payments/mpesa/callback

**Auth**: none (called by Safaricom) — verified instead via Daraja's callback authentication
mechanism (Constitution Principle II). Not exposed to the frontend/API docs for end users.

Idempotent by `providerReference`: a repeat callback for an already-resolved Transaction is a
no-op (FR-010, SC-007).

**Responses**: `200` (always, per Daraja's expected ack contract) — internal processing errors
are logged, not surfaced to the caller.

## POST /api/payments/bank-gateway/initiate

Starts a bank/card payment via the gateway (FR-007). Same pending-conflict rule as M-Pesa.

**Responses**: `201` → `{ transactionId, redirectUrl }` — frontend redirects the user to
`redirectUrl` to complete payment, then returns to the site.

## POST /api/payments/bank-gateway/webhook

**Auth**: none (called by the gateway) — verified via the gateway's webhook signature header
(Constitution Principle II). Idempotent by `providerReference`, same as the M-Pesa callback.

**Responses**: `200` (ack)

---

On either provider's confirmed success, the handler MUST, in one transaction: mark the
Transaction `SUCCEEDED` and create the corresponding `ACTIVE` Subscription (FR-009) — see
`data-model.md` Transaction/Subscription state transitions.
