import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TransactionsService } from './transactions.service';
import { MpesaProvider } from './providers/mpesa.provider';
import { BankGatewayProvider } from './providers/bank-gateway.provider';

@Module({
  imports: [SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, TransactionsService, MpesaProvider, BankGatewayProvider],
  exports: [TransactionsService],
})
export class PaymentsModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly paymentsService: PaymentsService) {}

  onModuleInit() {
    this.paymentsService.startTimeoutSweep();
  }

  onModuleDestroy() {
    this.paymentsService.stopTimeoutSweep();
  }
}
