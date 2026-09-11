import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { EntitlementGuard } from '../../src/common/guards/entitlement.guard';
import { PrismaService } from '../../src/prisma/prisma.service';

// T030 (Constitution Principle V — MANDATORY): covers subscribed, unsubscribed, and
// expired-subscription states for the guard that gates every full-playback request.

function makeContext(user: { sub: string } | undefined): ExecutionContext {
  const request = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('EntitlementGuard', () => {
  let prisma: { subscription: { findFirst: jest.Mock } };
  let guard: EntitlementGuard;

  beforeEach(() => {
    prisma = { subscription: { findFirst: jest.fn() } };
    guard = new EntitlementGuard(prisma as unknown as PrismaService);
  });

  it('allows a user with an ACTIVE, non-expired subscription', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

    const result = await guard.canActivate(makeContext({ sub: 'user-1' }));

    expect(result).toBe(true);
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'ACTIVE',
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });

  it('rejects a user with no subscription at all', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext({ sub: 'user-2' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a user whose subscription has expired (query excludes it)', async () => {
    // The guard's query filters expiresAt > now at the DB level, so an expired subscription
    // simply never matches — simulate that by resolving null, as Postgres would.
    prisma.subscription.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext({ sub: 'user-3' }))).rejects.toThrow(
      'No active subscription',
    );
  });

  it('rejects when there is no authenticated user on the request', async () => {
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(ForbiddenException);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });
});
