import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { PaymentMethod, Transaction } from '@prisma/client';

// T047: every payment attempt is recorded here, including failed/timed-out ones (FR-020), and
// only one PENDING Transaction per user is allowed at a time (data-model.md validation).
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async createPending(userId: string, method: PaymentMethod): Promise<Transaction> {
    const existingPending = await this.prisma.transaction.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException('A payment is already pending for this user');
    }

    const subscriptionConfig = this.configService.get('subscription', { infer: true });
    return this.prisma.transaction.create({
      data: {
        userId,
        method,
        amount: subscriptionConfig.priceAmount,
        status: 'PENDING',
      },
    });
  }

  async setProviderReference(transactionId: string, providerReference: string): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { providerReference },
    });
  }

  async getById(transactionId: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  /**
   * Finds the Transaction a webhook outcome refers to: first by providerReference (repeat
   * deliveries, and M-Pesa which knows its reference from initiate), falling back to txRef
   * (our own Transaction id) for a provider's first-ever delivery, e.g. Flutterwave.
   */
  async findForWebhook(providerReference: string, txRef?: string): Promise<Transaction | null> {
    const byReference = await this.prisma.transaction.findUnique({ where: { providerReference } });
    if (byReference) return byReference;
    if (txRef) {
      return this.prisma.transaction.findUnique({ where: { id: txRef } });
    }
    return null;
  }

  async markFailed(transactionId: string, reason: string): Promise<Transaction> {
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'FAILED', resolvedAt: new Date(), failureReason: reason },
    });
  }

  async markTimedOut(transactionId: string): Promise<Transaction> {
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'TIMED_OUT', resolvedAt: new Date(), failureReason: 'No response within the expected window' },
    });
  }

  async listHistoryForUser(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { initiatedAt: 'desc' },
    });
    return transactions.map((t) => ({
      id: t.id,
      method: t.method,
      amount: t.amount.toString(),
      status: t.status,
      initiatedAt: t.initiatedAt.toISOString(),
      resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    }));
  }
}
