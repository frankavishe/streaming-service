// T031: session helpers. The access token lives in memory (module-scoped variable) plus a
// sessionStorage mirror so it survives a page refresh; the refresh token never touches
// JS-visible storage — it's an httpOnly cookie set by the API.

let inMemoryAccessToken: string | null = null;

const STORAGE_KEY = 'streaming.accessToken';

export function setAccessToken(token: string) {
  inMemoryAccessToken = token;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // sessionStorage unavailable (SSR, privacy mode) — in-memory token still works this tab.
  }
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) inMemoryAccessToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface SessionUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  subscription: { status: 'ACTIVE'; expiresAt: string } | null;
}
