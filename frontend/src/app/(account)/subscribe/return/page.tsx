'use client';

// T061: landing page after the bank-gateway redirect flow. Flutterwave appends `tx_ref` (our own
// transactionId) and `status` as query params; we still ask our own API for the authoritative
// status rather than trusting the redirect query string, since the webhook is what actually
// resolves the transaction (Constitution Principle II — only a verified webhook activates access).

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

// Reads a query string set by the payment gateway's redirect — never statically prerenderable.
export const dynamic = 'force-dynamic';

type TransactionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';

function SubscribeReturnContent() {
  const searchParams = useSearchParams();
  const txRef = searchParams.get('tx_ref');
  const [status, setStatus] = useState<TransactionStatus | null>(null);

  useEffect(() => {
    if (!txRef) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await apiClient.get<{ status: TransactionStatus }>(`/payments/${txRef}/status`);
        if (cancelled) return;
        setStatus(res.status);
        if (res.status === 'PENDING') {
          setTimeout(poll, 3000);
        } else if (res.status === 'SUCCEEDED') {
          apiClient.get('/auth/me').catch(() => undefined);
        }
      } catch {
        if (!cancelled) setTimeout(poll, 3000);
      }
    };
    poll();

    return () => {
      cancelled = true;
    };
  }, [txRef]);

  if (!txRef) {
    return <div className="state-message">Missing payment reference.</div>;
  }

  return (
    <div className="state-message">
      {status === null && <p>Confirming your payment…</p>}
      {status === 'PENDING' && <p>Confirming your payment…</p>}
      {status === 'SUCCEEDED' && <p>Payment successful! Your subscription is now active.</p>}
      {status === 'FAILED' && <p role="alert">Payment failed or was canceled. You can try again.</p>}
      {status === 'TIMED_OUT' && <p role="alert">We did not receive a confirmation in time. You can try again.</p>}
    </div>
  );
}

export default function SubscribeReturnPage() {
  return (
    <Suspense fallback={<div className="state-message">Loading…</div>}>
      <SubscribeReturnContent />
    </Suspense>
  );
}
