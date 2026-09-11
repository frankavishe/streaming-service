import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAccessPayload } from '../../auth/jwt.strategy';

// T029: server-side entitlement check (Constitution Principle I). MUST run after JwtAuthGuard
// (so an unauthenticated request already fails with 401 before this guard ever runs) and MUST
// query the database directly — never trust a client-supplied "I'm subscribed" claim.
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtAccessPayload | undefined = request.user;
    if (!user) {
      // JwtAuthGuard should already have rejected this with 401; treat missing user as
      // "not entitled" defensively rather than throwing a confusing 403.
      throw new ForbiddenException('No active subscription');
    }

    const isEntitled = await this.hasActiveSubscription(user.sub);
    if (!isEntitled) {
      throw new ForbiddenException('No active subscription');
    }
    return true;
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });
    return activeSubscription !== null;
  }
}
