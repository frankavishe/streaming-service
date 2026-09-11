'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { setAccessToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiClient.post<{ accessToken: string }>('/auth/register', { email, password }, {
        skipAuth: true,
      });
      setAccessToken(res.accessToken);
      router.push('/subscribe');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('That email is already registered.');
      } else if (err instanceof ApiError && err.status === 422) {
        setError('Please use a valid email and a password of at least 8 characters.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={submit} style={{ padding: '1.5rem', maxWidth: 360 }}>
      <h1>Create your account</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Register</button>
      {error && <p role="alert">{error}</p>}
      <p>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </form>
  );
}
