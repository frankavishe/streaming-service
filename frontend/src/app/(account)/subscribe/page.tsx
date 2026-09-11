'use client';

// T059-T062: subscribe/checkout page — choose M-Pesa or bank payment, run each flow to a
// terminal state, and unlock full playback immediately on success (FR-006, FR-007, FR-011,
// SC-006) without the user needing to do anything else afterward.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

type TransactionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';

function usePolling(transactionId: string | null) {
  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!transactionId) return;
    setStatus('PENDING');

    intervalRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get<{ status: TransactionStatus }>(
          `/payments/${transactionId}/status`,
        );
        setStatus(res.status);
        if (res.status !== 'PENDING') {
          clearInterval(intervalRef.current);
        }
      } catch {
        // transient network error — keep polling until the interval is cleared below
      }
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, [transactionId]);

  return status;
}

export default function SubscribePage() {
  const [method, setMethod] = useState<'mpesa' | 'bank' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mpesaTransactionId, setMpesaTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mpesaStatus = usePolling(mpesaTransactionId);

  const submitMpesa = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ transactionId: string; status: string }>(
        '/payments/mpesa/initiate',
        { phoneNumber },
      );
      setMpesaTransactionId(res.transactionId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('A payment is already in progress. Please wait for it to finish.');
      } else if (err instanceof ApiError && err.status === 422) {
        setError('Please enter a valid phone number.');
      } else {
        setError('Could not start the M-Pesa payment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [phoneNumber]);

  const submitBankGateway = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ redirectUrl: string }>('/payments/bank-gateway/initiate');
      window.location.href = res.redirectUrl;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('A payment is already in progress. Please wait for it to finish.');
      } else {
        setError('Could not start the bank payment. Please try again.');
      }
      setSubmitting(false);
    }
  }, []);

  // Once payment succeeds, refresh entitlement so any cached "no subscription" state clears.
  useEffect(() => {
    if (mpesaStatus === 'SUCCEEDED') {
      apiClient.get('/auth/me').catch(() => undefined);
    }
  }, [mpesaStatus]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 480 }}>
      <h1>Subscribe</h1>
      <p>One plan, full catalog access, billed for 30 days at a time.</p>

      {!method && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setMethod('mpesa')}>Pay with M-Pesa</button>
          <button onClick={() => setMethod('bank')}>Pay with card / bank</button>
        </div>
      )}

      {method === 'mpesa' && !mpesaTransactionId && (
        <div>
          <label htmlFor="phone">M-Pesa phone number</label>
          <input
            id="phone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="0712345678"
          />
          <button disabled={submitting} onClick={submitMpesa}>
            Send STK push
          </button>
        </div>
      )}

      {mpesaTransactionId && mpesaStatus === 'PENDING' && (
        <p>Check your phone and enter your M-Pesa PIN to complete payment…</p>
      )}
      {mpesaStatus === 'SUCCEEDED' && <p>Payment successful! Your subscription is now active.</p>}
      {mpesaStatus === 'FAILED' && <p role="alert">Payment failed. You can try again.</p>}
      {mpesaStatus === 'TIMED_OUT' && (
        <p role="alert">We did not receive a response in time. You can try again.</p>
      )}

      {method === 'bank' && (
        <div>
          <p>You will be redirected to complete a card or bank-transfer payment.</p>
          <button disabled={submitting} onClick={submitBankGateway}>
            Continue to payment
          </button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
