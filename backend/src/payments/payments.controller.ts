import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAccessPayload } from '../auth/jwt.strategy';
import { PaymentsService } from './payments.service';
import { TransactionsService } from './transactions.service';
import { MpesaInitiateDto } from './dto/mpesa-initiate.dto';
import { RawWebhookRequest } from './providers/provider.interface';

function toRawWebhookRequest(req: Request, extraHeaders: Record<string, string> = {}): RawWebhookRequest {
  return {
    headers: { ...req.headers, ...extraHeaders },
    rawBody: JSON.stringify(req.body),
    body: req.body,
  };
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  // T051
  @Post('mpesa/initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  initiateMpesa(@CurrentUser() user: JwtAccessPayload, @Body() dto: MpesaInitiateDto) {
    return this.paymentsService.initiateMpesa(user.sub, user.email, dto.phoneNumber);
  }

  // T055
  @Post('bank-gateway/initiate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  initiateBankGateway(@CurrentUser() user: JwtAccessPayload) {
    return this.paymentsService.initiateBankGateway(user.sub, user.email);
  }

  // T052
  @Get(':transactionId/status')
  @UseGuards(JwtAuthGuard)
  getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentsService.getStatus(transactionId);
  }

  // T063 (US3): billing history
  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@CurrentUser() user: JwtAccessPayload) {
    return this.transactionsService.listHistoryForUser(user.sub).then((items) => ({ items }));
  }

  // T053: no auth guard — verified via the shared callback token in the query string instead.
  @Post('mpesa/callback')
  @HttpCode(HttpStatus.OK)
  async mpesaCallback(@Req() req: Request, @Query('token') token: string) {
    await this.paymentsService.handleMpesaCallback(
      toRawWebhookRequest(req, { 'x-callback-token': token ?? '' }),
    );
    // Daraja expects this exact ack shape regardless of internal outcome.
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  // T056: no auth guard — verified via Flutterwave's `verif-hash` header.
  @Post('bank-gateway/webhook')
  @HttpCode(HttpStatus.OK)
  async bankGatewayWebhook(@Req() req: Request) {
    await this.paymentsService.handleBankGatewayWebhook(toRawWebhookRequest(req));
    return { status: 'ok' };
  }
}
