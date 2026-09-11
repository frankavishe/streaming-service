import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentProvider,
  RawWebhookRequest,
  WebhookOutcome,
} from './provider.interface';

// T045: Safaricom Daraja STK Push (Lipa na M-Pesa Online). research.md decision 3.
//
// Daraja has no payload-signing scheme for its callback the way most webhook providers do, so
// authenticity here is enforced by only accepting callbacks that carry a pre-shared token baked
// into the registered callback URL (MPESA_CALLBACK_URL=.../mpesa/callback/<token>) — the
// controller lifts that route param into a synthetic `x-callback-token` header before calling
// `verify()`, so this class's contract still matches every other provider's `verify()` shape.
@Injectable()
export class MpesaProvider implements PaymentProvider {
  private readonly logger = new Logger(MpesaProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const mpesaConfig = this.configService.get('mpesa', { infer: true });
    this.baseUrl =
      mpesaConfig.env === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const mpesaConfig = this.configService.get('mpesa', { infer: true });
    if (!input.phoneNumber) {
      throw new Error('phoneNumber is required for an M-Pesa payment');
    }

    const accessToken = await this.getAccessToken();
    const timestamp = this.formatTimestamp(new Date());
    const password = Buffer.from(
      `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`,
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: mpesaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(input.amount),
        PartyA: input.phoneNumber,
        PartyB: mpesaConfig.shortcode,
        PhoneNumber: input.phoneNumber,
        CallBackURL: mpesaConfig.callbackUrl,
        AccountReference: input.transactionId,
        TransactionDesc: 'Subscription payment',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Daraja STK push failed: ${response.status} ${errorBody}`);
      throw new Error('Failed to initiate M-Pesa payment');
    }

    const body = (await response.json()) as { CheckoutRequestID: string };
    return { providerReference: body.CheckoutRequestID };
  }

  verify(request: RawWebhookRequest): boolean {
    const mpesaConfig = this.configService.get('mpesa', { infer: true });
    const presented = request.headers['x-callback-token'];
    return typeof presented === 'string' && presented === mpesaConfig.callbackToken;
  }

  handleWebhook(request: RawWebhookRequest): WebhookOutcome {
    const body = request.body as {
      Body: {
        stkCallback: {
          CheckoutRequestID: string;
          ResultCode: number;
          ResultDesc: string;
        };
      };
    };
    const callback = body.Body.stkCallback;
    if (callback.ResultCode === 0) {
      return { providerReference: callback.CheckoutRequestID, status: 'SUCCEEDED' };
    }
    return {
      providerReference: callback.CheckoutRequestID,
      status: 'FAILED',
      failureReason: callback.ResultDesc,
    };
  }

  private async getAccessToken(): Promise<string> {
    const mpesaConfig = this.configService.get('mpesa', { infer: true });
    const credentials = Buffer.from(
      `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`,
    ).toString('base64');

    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );
    if (!response.ok) {
      throw new Error('Failed to obtain Daraja access token');
    }
    const body = (await response.json()) as { access_token: string };
    return body.access_token;
  }

  private formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  }
}
