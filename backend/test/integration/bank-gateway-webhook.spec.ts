import { PaymentsService } from '../../src/payments/payments.service';
import { TransactionsService } from '../../src/payments/transactions.service';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { MpesaProvider } from '../../src/payments/providers/mpesa.provider';
import { BankGatewayProvider } from '../../src/payments/providers/bank-gateway.provider';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RawWebhookRequest } from '../../src/payments/providers/provider.interface';
import { AppConfig } from '../../src/config/configuration';

// T057 (Constitution Principle V — MANDATORY): signature verification, idempotency/replay, and
// success/failure outcomes for the Flutterwave webhook handler (FR-008, FR-009, FR-010, SC-007).

const SECRET_HASH = 'test-secret-hash';

function makeRequest(hash: string, payload: unknown): RawWebhookRequest {
  return {
    headers: { 'verif-hash': hash },
    rawBody: JSON.stringify(payload),
    body: payload,
  };
}

function successPayload(id: string, txRef: string) {
  return { data: { id, tx_ref: txRef, status: 'successful' } };
}

function failurePayload(id: string, txRef: string) {
  return { data: { id, tx_ref: txRef, status: 'failed', processor_response: 'Card declined' } };
}

describe('POST /api/payments/bank-gateway/webhook (via PaymentsService)', () => {
  let transactionsService: jest.Mocked<Pick<TransactionsService, 'findForWebhook' | 'setProviderReference' | 'markFailed'>>;
  let subscriptionsService: jest.Mocked<Pick<SubscriptionsService, 'activateFromTransaction'>>;
  let service: PaymentsService;

  beforeEach(() => {
    transactionsService = {
      findForWebhook: jest.fn(),
      setProviderReference: jest.fn(),
      markFailed: jest.fn(),
    } as any;
    subscriptionsService = { activateFromTransaction: jest.fn() } as any;

    const mpesaProvider = new MpesaProvider({ get: jest.fn().mockReturnValue({}) } as unknown as ConfigService<AppConfig, true>);
    const bankGatewayProvider = new BankGatewayProvider({
      get: jest.fn().mockReturnValue({ secretHash: SECRET_HASH }),
    } as unknown as ConfigService<AppConfig, true>);

    service = new PaymentsService(
      transactionsService as unknown as TransactionsService,
      subscriptionsService as unknown as SubscriptionsService,
      mpesaProvider,
      bankGatewayProvider,
      { get: jest.fn() } as unknown as ConfigService<AppConfig, true>,
      {} as unknown as PrismaService,
    );
  });

  it('rejects a webhook with an invalid verif-hash and does not touch any transaction', async () => {
    await service.handleBankGatewayWebhook(makeRequest('wrong-hash', successPayload('flw-1', 'txn-1')));

    expect(transactionsService.findForWebhook).not.toHaveBeenCalled();
  });

  it('activates the subscription on first successful delivery, linking by tx_ref', async () => {
    transactionsService.findForWebhook.mockResolvedValue({
      id: 'txn-1',
      status: 'PENDING',
      providerReference: null,
    } as any);

    await service.handleBankGatewayWebhook(makeRequest(SECRET_HASH, successPayload('flw-1', 'txn-1')));

    expect(transactionsService.findForWebhook).toHaveBeenCalledWith('flw-1', 'txn-1');
    expect(transactionsService.setProviderReference).toHaveBeenCalledWith('txn-1', 'flw-1');
    expect(subscriptionsService.activateFromTransaction).toHaveBeenCalledWith('txn-1');
  });

  it('does not double-activate on a replayed duplicate delivery', async () => {
    transactionsService.findForWebhook.mockResolvedValue({
      id: 'txn-1',
      status: 'SUCCEEDED',
      providerReference: 'flw-1',
    } as any);

    await service.handleBankGatewayWebhook(makeRequest(SECRET_HASH, successPayload('flw-1', 'txn-1')));

    expect(subscriptionsService.activateFromTransaction).not.toHaveBeenCalled();
  });

  it('marks the transaction FAILED on a failure outcome', async () => {
    transactionsService.findForWebhook.mockResolvedValue({
      id: 'txn-2',
      status: 'PENDING',
      providerReference: null,
    } as any);

    await service.handleBankGatewayWebhook(makeRequest(SECRET_HASH, failurePayload('flw-2', 'txn-2')));

    expect(transactionsService.markFailed).toHaveBeenCalledWith('txn-2', 'Card declined');
    expect(subscriptionsService.activateFromTransaction).not.toHaveBeenCalled();
  });
});
