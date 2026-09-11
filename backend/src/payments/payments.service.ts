import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionsService } from './transactions.service';
import { MpesaProvider } from './providers/mpesa.provider';
import { BankGatewayProvider } from './providers/bank-gateway.provider';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AppConfig } from '../config/configuration';
import { RawWebhookRequest } from './providers/provider.interface';
import { PrismaService } from '../prisma/prisma.service';

function normalizeMsisdn(phoneNumber: string): string {
  if (phoneNumber.startsWith('0')) {
    return `254${phoneNumber.slice(1)}`;
  }
  return phoneNumber;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private timeoutSweepHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly mpesaProvider: MpesaProvider,
    private readonly bankGatewayProvider: BankGatewayProvider,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  // T051
  async initiateMpesa(userId: string, userEmail: string, phoneNumber: string) {
    const subscriptionConfig = this.configService.get('subscription', { infer: true });
    const transaction = await this.transactionsService.createPending(userId, 'MPESA');
    try {
      const result = await this.mpesaProvider.initiate({
        transactionId: transaction.id,
        amount: subscriptionConfig.priceAmount,
        currency: subscriptionConfig.currency,
        userEmail,
        phoneNumber: normalizeMsisdn(phoneNumber),
      });
      if (result.providerReference) {
        await this.transactionsService.setProviderReference(transaction.id, result.providerReference);
      }
    } catch (err) {
      await this.transactionsService.markFailed(transaction.id, 'Failed to initiate M-Pesa push');
      throw err;
    }
    return { transactionId: transaction.id, status: 'PENDING' as const };
  }

  // T055
  async initiateBankGateway(userId: string, userEmail: string) {
    const subscriptionConfig = this.configService.get('subscription', { infer: true });
    const transaction = await this.transactionsService.createPending(userId, 'BANK_GATEWAY');
    try {
      const result = await this.bankGatewayProvider.initiate({
        transactionId: transaction.id,
        amount: subscriptionConfig.priceAmount,
        currency: subscriptionConfig.currency,
        userEmail,
      });
      return { transactionId: transaction.id, redirectUrl: result.redirectUrl! };
    } catch (err) {
      await this.transactionsService.markFailed(transaction.id, 'Failed to initiate bank-gateway payment');
      throw err;
    }
  }

  // T052
  async getStatus(transactionId: string) {
    const transaction = await this.transactionsService.getById(transactionId);
    return {
      transactionId: transaction.id,
      status: transaction.status,
      resolvedAt: transaction.resolvedAt ? transaction.resolvedAt.toISOString() : null,
    };
  }

  // T053: M-Pesa Daraja callback.
  async handleMpesaCallback(request: RawWebhookRequest): Promise<void> {
    if (!this.mpesaProvider.verify(request)) {
      this.logger.warn('Rejected M-Pesa callback with invalid callback token');
      return; // Always ack 200 to Daraja regardless; this is logged, not surfaced.
    }
    const outcome = this.mpesaProvider.handleWebhook(request);
    await this.applyOutcome('MPESA', outcome);
  }

  // T056: Flutterwave webhook.
  async handleBankGatewayWebhook(request: RawWebhookRequest): Promise<void> {
    if (!this.bankGatewayProvider.verify(request)) {
      this.logger.warn('Rejected bank-gateway webhook with invalid signature');
      return;
    }
    const outcome = this.bankGatewayProvider.handleWebhook(request);
    await this.applyOutcome('BANK_GATEWAY', outcome);
  }

  private async applyOutcome(
    method: 'MPESA' | 'BANK_GATEWAY',
    outcome: { providerReference: string; status: 'SUCCEEDED' | 'FAILED'; failureReason?: string; txRef?: string },
  ): Promise<void> {
    const transaction = await this.transactionsService.findForWebhook(outcome.providerReference, outcome.txRef);
    if (!transaction) {
      this.logger.warn(`${method} webhook for unknown transaction (ref=${outcome.providerReference})`);
      return;
    }

    // Idempotency (FR-010, SC-007): a repeat delivery for an already-resolved Transaction is a
    // no-op — this is the authoritative check; SubscriptionsService.activateFromTransaction adds
    // a second layer of defense against the same race.
    if (transaction.status !== 'PENDING') {
      this.logger.log(`Ignoring duplicate ${method} webhook for already-${transaction.status} transaction ${transaction.id}`);
      return;
    }

    if (!transaction.providerReference) {
      await this.transactionsService.setProviderReference(transaction.id, outcome.providerReference);
    }

    if (outcome.status === 'SUCCEEDED') {
      await this.subscriptionsService.activateFromTransaction(transaction.id);
    } else {
      await this.transactionsService.markFailed(transaction.id, outcome.failureReason ?? 'Payment failed');
    }
  }

  // T058: background sweep marking never-resolved M-Pesa STK pushes TIMED_OUT.
  startTimeoutSweep(): void {
    const timeoutSeconds = this.configService.get('mpesa', { infer: true }).stkTimeoutSeconds;
    this.timeoutSweepHandle = setInterval(async () => {
      const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
      const stale = await this.prisma.transaction.findMany({
        where: { method: 'MPESA', status: 'PENDING', initiatedAt: { lt: cutoff } },
      });
      for (const transaction of stale) {
        await this.transactionsService.markTimedOut(transaction.id);
        this.logger.log(`Marked M-Pesa transaction ${transaction.id} as TIMED_OUT`);
      }
    }, 30_000);
  }

  stopTimeoutSweep(): void {
    if (this.timeoutSweepHandle) clearInterval(this.timeoutSweepHandle);
  }
}
