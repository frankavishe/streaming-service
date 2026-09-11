// T044: common shape both payment providers implement, so subscription/entitlement logic never
// touches Daraja- or Flutterwave-specific code (research.md decision 2; Constitution Principle II).

export interface InitiatePaymentInput {
  transactionId: string;
  amount: number;
  currency: string;
  userEmail: string;
  /** M-Pesa only — required by MpesaProvider, ignored by BankGatewayProvider. */
  phoneNumber?: string;
}

export interface InitiatePaymentOutput {
  /** Provider's own reference for this attempt, if known immediately (e.g. Daraja's CheckoutRequestID). */
  providerReference?: string;
  /** Present for redirect-based flows (bank gateway). */
  redirectUrl?: string;
}

export type WebhookOutcomeStatus = 'SUCCEEDED' | 'FAILED';

export interface WebhookOutcome {
  providerReference: string;
  status: WebhookOutcomeStatus;
  failureReason?: string;
  /**
   * Our own Transaction id, when the provider echoes it back (e.g. Flutterwave's `tx_ref`).
   * Lets the first webhook delivery link a not-yet-known providerReference to the right
   * Transaction row; only M-Pesa already knows its providerReference at initiate time.
   */
  txRef?: string;
}

export interface RawWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  body: unknown;
}

export interface PaymentProvider {
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentOutput>;
  /** Verifies the webhook/callback genuinely came from the provider (Constitution Principle II). */
  verify(request: RawWebhookRequest): boolean;
  /** Extracts the outcome from an already-verified webhook/callback payload. */
  handleWebhook(request: RawWebhookRequest): WebhookOutcome;
}
