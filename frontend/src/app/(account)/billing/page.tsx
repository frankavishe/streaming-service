'use client';

// T065: current subscription status + expiry, and a payment history table (FR-013, FR-014, SC-004).

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface SubscriptionStatus {
  status: 'ACTIVE' | 'EXPIRED' | 'NONE';
  expiresAt: string | null;
}

interface PaymentHistoryItem {
  id: string;
  method: 'MPESA' | 'BANK_GATEWAY';
  amount: string;
  status: string;
  initiatedAt: string;
  resolvedAt: string | null;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<SubscriptionStatus>('/subscriptions/me'),
      apiClient.get<{ items: PaymentHistoryItem[] }>('/payments/history'),
    ])
      .then(([sub, hist]) => {
        setSubscription(sub);
        setHistory(hist.items);
      })
      .catch(() => setError('Could not load your billing information.'));
  }, []);

  if (error) return <div className="state-message" role="alert">{error}</div>;
  if (!subscription || !history) return <div className="state-message">Loading…</div>;

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>Billing</h1>

      <section>
        <h2>Subscription status</h2>
        {subscription.status === 'ACTIVE' && (
          <p>
            Active — renews/expires on{' '}
            {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : '—'}
          </p>
        )}
        {subscription.status === 'EXPIRED' && (
          <p>
            Your subscription expired on{' '}
            {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : '—'}.{' '}
            <a href="/subscribe">Renew now</a>
          </p>
        )}
        {subscription.status === 'NONE' && (
          <p>
            You don&apos;t have a subscription yet. <a href="/subscribe">Subscribe</a>
          </p>
        )}
      </section>

      <section>
        <h2>Payment history</h2>
        {history.length === 0 ? (
          <p>No payment attempts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.initiatedAt).toLocaleString()}</td>
                  <td>{item.amount}</td>
                  <td>{item.method === 'MPESA' ? 'M-Pesa' : 'Bank/Card'}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
