import { defineConfig } from '@playwright/test';

// T085 (RECOMMENDED, not blocking): end-to-end coverage of the user-story flows against a
// running stack (`docker compose up`, or `npm run dev` + the backend dev server).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
  },
  reporter: [['list']],
});
