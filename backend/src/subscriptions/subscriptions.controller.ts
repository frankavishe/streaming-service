import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAccessPayload } from '../auth/jwt.strategy';
import { SubscriptionsService } from './subscriptions.service';

// T063 (US3)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyStatus(@CurrentUser() user: JwtAccessPayload) {
    return this.subscriptionsService.getStatusForUser(user.sub);
  }
}
