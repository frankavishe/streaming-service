import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { Subscription } from '@prisma/client';

export interface SubscriptionStatusResult {
  status: 'ACTIVE' | 'EXPIRED' | 'NONE';
  expiresAt: string | null;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * T048: on a Transaction reaching SUCCEEDED, atomically mark it SUCCEEDED and create the
   * ACTIVE Subscription it pays for (FR-009). Idempotent: if this Transaction already has a
   * Subscription, that existing row is returned rather than creating a second one — this is the
   * inner safety net behind the webhook-layer idempotency check (FR-010, SC-007).
   */
  async activateFromTransaction(transactionId: string): Promise<Subscription> {
    const periodDays = this.configService.get('subscription', { infer: true }).periodDays;

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { subscription: true },
      });
      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }
      if (transaction.subscription) {
        return transaction.subscription;
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'SUCCEEDED', resolvedAt: new Date() },
      });

      const startAt = new Date();
      const expiresAt = new Date(startAt.getTime() + periodDays * 24 * 60 * 60 * 1000);

      return tx.subscription.create({
        data: {
          userId: transaction.userId,
          status: 'ACTIVE',
          startAt,
          expiresAt,
          transactionId,
        },
      });
    });
  }

  /**
   * T049: a user is entitled iff an ACTIVE Subscription exists with expiresAt in the future.
   * "EXPIRED" is computed at read time from the most recent period, rather than via a scheduled
   * sweep — acceptable at MVP scale per data-model.md ("implementation detail for tasks").
   */
  async getStatusForUser(userId: string): Promise<SubscriptionStatusResult> {
    const latest = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { expiresAt: 'desc' },
    });
    if (!latest) {
      return { status: 'NONE', expiresAt: null };
    }
    const isActive = latest.status === 'ACTIVE' && latest.expiresAt.getTime() > Date.now();
    return {
      status: isActive ? 'ACTIVE' : 'EXPIRED',
      expiresAt: latest.expiresAt.toISOString(),
    };
  }
}
