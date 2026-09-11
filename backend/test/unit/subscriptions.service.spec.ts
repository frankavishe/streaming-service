import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppConfig } from '../../src/config/configuration';

// T050 (Constitution Principle V — MANDATORY): activation, read-time expiry, and that a repeat
// successful payment creates a new period without corrupting the prior one.

function makeConfigService(periodDays = 30): ConfigService<AppConfig, true> {
  return {
    get: jest.fn().mockReturnValue({ periodDays }),
  } as unknown as ConfigService<AppConfig, true>;
}

describe('SubscriptionsService', () => {
  describe('activateFromTransaction', () => {
    it('creates an ACTIVE subscription and marks the transaction SUCCEEDED', async () => {
      const txClient = {
        transaction: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'txn-1',
            userId: 'user-1',
            subscription: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        subscription: {
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sub-1', ...data })),
        },
      };
      const prisma = {
        $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(txClient)),
      } as unknown as PrismaService;

      const service = new SubscriptionsService(prisma, makeConfigService(30));
      const result = await service.activateFromTransaction('txn-1');

      expect(txClient.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
        data: { status: 'SUCCEEDED', resolvedAt: expect.any(Date) },
      });
      expect(result).toMatchObject({ userId: 'user-1', status: 'ACTIVE', transactionId: 'txn-1' });
      const expiresAt = (result as any).expiresAt as Date;
      const startAt = (result as any).startAt as Date;
      expect(expiresAt.getTime() - startAt.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('is idempotent: a transaction that already has a subscription is returned unchanged', async () => {
      const existingSubscription = { id: 'sub-existing', status: 'ACTIVE' };
      const txClient = {
        transaction: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'txn-1',
            userId: 'user-1',
            subscription: existingSubscription,
          }),
          update: jest.fn(),
        },
        subscription: { create: jest.fn() },
      };
      const prisma = {
        $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(txClient)),
      } as unknown as PrismaService;

      const service = new SubscriptionsService(prisma, makeConfigService(30));
      const result = await service.activateFromTransaction('txn-1');

      expect(result).toBe(existingSubscription);
      expect(txClient.transaction.update).not.toHaveBeenCalled();
      expect(txClient.subscription.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown transaction id', async () => {
      const txClient = {
        transaction: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
        subscription: { create: jest.fn() },
      };
      const prisma = {
        $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(txClient)),
      } as unknown as PrismaService;

      const service = new SubscriptionsService(prisma, makeConfigService(30));
      await expect(service.activateFromTransaction('missing')).rejects.toThrow(NotFoundException);
    });

    it('a second successful payment creates a new period rather than corrupting the first', async () => {
      // Simulate two independent transactions for the same user, each activating its own period.
      const periods: Array<{ startAt: Date; expiresAt: Date }> = [];
      const txClientFactory = (transactionId: string) => ({
        transaction: {
          findUnique: jest.fn().mockResolvedValue({ id: transactionId, userId: 'user-1', subscription: null }),
          update: jest.fn(),
        },
        subscription: {
          create: jest.fn().mockImplementation(({ data }) => {
            periods.push({ startAt: data.startAt, expiresAt: data.expiresAt });
            return Promise.resolve({ id: `sub-${transactionId}`, ...data });
          }),
        },
      });
      const prisma = {
        $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(txClientFactory('txn-1'))),
      } as unknown as PrismaService;
      const service = new SubscriptionsService(prisma, makeConfigService(30));
      await service.activateFromTransaction('txn-1');

      (prisma.$transaction as jest.Mock).mockImplementationOnce((cb: (tx: unknown) => unknown) =>
        cb(txClientFactory('txn-2')),
      );
      await service.activateFromTransaction('txn-2');

      expect(periods).toHaveLength(2);
      expect(periods[0].startAt).not.toBe(periods[1].startAt);
    });
  });

  describe('getStatusForUser', () => {
    it('returns NONE when the user has never had a subscription', async () => {
      const prisma = {
        subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const service = new SubscriptionsService(prisma, makeConfigService());

      await expect(service.getStatusForUser('user-1')).resolves.toEqual({
        status: 'NONE',
        expiresAt: null,
      });
    });

    it('returns ACTIVE when the latest subscription has not expired', async () => {
      const future = new Date(Date.now() + 10_000);
      const prisma = {
        subscription: {
          findFirst: jest.fn().mockResolvedValue({ status: 'ACTIVE', expiresAt: future }),
        },
      } as unknown as PrismaService;
      const service = new SubscriptionsService(prisma, makeConfigService());

      const result = await service.getStatusForUser('user-1');
      expect(result.status).toBe('ACTIVE');
      expect(result.expiresAt).toBe(future.toISOString());
    });

    it('returns EXPIRED (read-time derivation) once expiresAt is in the past', async () => {
      const past = new Date(Date.now() - 10_000);
      const prisma = {
        subscription: {
          findFirst: jest.fn().mockResolvedValue({ status: 'ACTIVE', expiresAt: past }),
        },
      } as unknown as PrismaService;
      const service = new SubscriptionsService(prisma, makeConfigService());

      const result = await service.getStatusForUser('user-1');
      expect(result.status).toBe('EXPIRED');
    });
  });
});
