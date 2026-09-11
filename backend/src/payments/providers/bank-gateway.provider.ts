import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AppConfig } from '../../config/configuration';
import {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentProvider,
  RawWebhookRequest,
  WebhookOutcome,
} from './provider.interface';

// T046: Flutterwave Standard checkout (redirect-based card/bank-transfer). research.md decision
// 2 — kept behind PaymentProvider so swapping to Paystack later only touches this file.
@Injectable()
export class BankGatewayProvider implements PaymentProvider {
  private readonly logger = new Logger(BankGatewayProvider.name);
  private readonly baseUrl = 'https://api.flutterwave.com/v3';

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const config = this.configService.get('flutterwave', { infer: true });

    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.transactionId,
        amount: input.amount,
        currency: input.currency,
        redirect_url: config.redirectUrl,
        customer: { email: input.userEmail },
        customizations: { title: 'Subscription payment' },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Flutterwave initiate failed: ${response.status} ${errorBody}`);
      throw new Error('Failed to initiate bank-gateway payment');
    }

    const body = (await response.json()) as { data: { link: string } };
    // providerReference is not known until the webhook fires; tx_ref (our own transactionId) is
    // how we'll find this row again below.
    return { redirectUrl: body.data.link };
  }

  verify(request: RawWebhookRequest): boolean {
    const config = this.configService.get('flutterwave', { infer: true });
    const presented = request.headers['verif-hash'];
    return typeof presented === 'string' && presented === config.secretHash;
  }

  handleWebhook(request: RawWebhookRequest): WebhookOutcome {
    const body = request.body as {
      data: { id: number | string; tx_ref: string; status: string; processor_response?: string };
    };
    const { data } = body;
    const providerReference = String(data.id);
    if (data.status === 'successful') {
      return { providerReference, status: 'SUCCEEDED', txRef: data.tx_ref };
    }
    return {
      providerReference,
      status: 'FAILED',
      failureReason: data.processor_response ?? data.status,
      txRef: data.tx_ref,
    };
  }
}

// Exported for tests / documentation of the hashing scheme referenced above, in case an
// alternative (HMAC) verification is layered on later per Flutterwave's evolving docs.
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
