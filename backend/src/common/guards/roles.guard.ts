import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtAccessPayload } from '../../auth/jwt.strategy';

// T028: restricts an endpoint to specific roles (FR-019: admin-only content management).
// MUST run after JwtAuthGuard so `request.user` is populated.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtAccessPayload | undefined = request.user;
    if (!user || !requiredRoles.includes(user.role as Role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
