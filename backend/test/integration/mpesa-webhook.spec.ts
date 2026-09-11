import { PaymentsService } from '../../src/payments/payments.service';
import { TransactionsService } from '../../src/payments/transactions.service';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { MpesaProvider } from '../../src/payments/providers/mpesa.provider';
import { BankGatewayProvider } from '../../src/payments/providers/bank-gateway.provider';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RawWebhookRequest } from '../../src/payments/providers/provider.interface';
import { AppConfig } from '../../src/config/configuration';

// T054 (Constitution Principle V — MANDATORY): signature verification, idempotency/replay, and
// success/failure outcomes for the M-Pesa Daraja callback handler (FR-008, FR-009, FR-010, SC-007).

function makeRequest(token: string, callback: unknown): RawWebhookRequest {
  return {
    headers: { 'x-callback-token': token },
    rawBody: JSON.stringify(callback),
    body: callback,
  };
}

function successCallback(checkoutRequestId: string) {
  return { Body: { stkCallback: { CheckoutRequestID: checkoutRequestId, ResultCode: 0, ResultDesc: 'Success' } } };
}

function failureCallback(checkoutRequestId: string) {
  return {
    Body: { stkCallback: { CheckoutRequestID: checkoutRequestId, ResultCode: 1032, ResultDesc: 'Request cancelled by user' } },
  };
}

describe('POST /api/payments/mpesa/callback (via PaymentsService)', () => {
  let transactionsService: jest.Mocked<Pick<TransactionsService, 'findForWebhook' | 'setProviderReference' | 'markFailed'>>;
  let subscriptionsService: jest.Mocked<Pick<SubscriptionsService, 'activateFromTransaction'>>;
  let service: PaymentsService;
  const CALLBACK_TOKEN = 'test-callback-token';

  beforeEach(() => {
    transactionsService = {
      findForWebhook: jest.fn(),
      setProviderReference: jest.fn(),
      markFailed: jest.fn(),
    } as any;
    subscriptionsService = { activateFromTransaction: jest.fn() } as any;

    const mpesaProvider = new MpesaProvider({
      get: jest.fn().mockReturnValue({ callbackToken: CALLBACK_TOKEN, env: 'sandbox' }),
    } as unknown as ConfigService<AppConfig, true>);
    const bankGatewayProvider = new BankGatewayProvider({} as unknown as ConfigService<AppConfig, true>);

    service = new PaymentsService(
      transactionsService as unknown as TransactionsService,
      subscriptionsService as unknown as SubscriptionsService,
      mpesaProvider,
      bankGatewayProvider,
      { get: jest.fn() } as unknown as ConfigService<AppConfig, true>,
      {} as unknown as PrismaService,
    );
  });

  it('rejects a callback with an invalid/missing token and does not touch any transaction', async () => {
    await service.handleMpesaCallback(makeRequest('wrong-token', successCallback('ws-1')));

    expect(transactionsService.findForWebhook).not.toHaveBeenCalled();
    expect(subscriptionsService.activateFromTransaction).not.toHaveBeenCalled();
  });

  it('activates the subscription on first successful delivery', async () => {
    transactionsService.findForWebhook.mockResolvedValue({
      id: 'txn-1',
      status: 'PENDING',
      providerReference: 'ws-1',
    } as any);

    await service.handleMpesaCallback(makeRequest(CALLBACK_TOKEN, successCallback('ws-1')));

    expect(subscriptionsService.activateFromTransaction).toHaveBeenCalledWith('txn-1');
    expect(transactionsService.markFailed).not.toHaveBeenCalled();
  });

  it('does not double-activate on a replayed duplicate delivery for an already-resolved transaction', async () => {
    transactionsService.findForWebhook.mockResolvedValue({
      id: 'txn-1',
      status: 'SUCCEEDED', // already resolved by the first delivery
      providerReference: 'ws-1',
    } as any);

    await service.handleMpesaCallback(makeRequest(CALLBACK_TOKEN, successCallback('ws-1')));

    expect(subscriptionsService.activateFromTransaction).not.toHaveBeenCalled();
  });

  it('marks the transaction FAILED on a failure outcome', async () => {
    transactionsService.findForWebhook.mockResolvedValue({
      id: 'txn-2',
      status: 'PENDING',
      providerReference: 'ws-2',
    } as any);

    await service.handleMpesaCallback(makeRequest(CALLBACK_TOKEN, failureCallback('ws-2')));

    expect(transactionsService.markFailed).toHaveBeenCalledWith('txn-2', 'Request cancelled by user');
    expect(subscriptionsService.activateFromTransaction).not.toHaveBeenCalled();
  });
});
