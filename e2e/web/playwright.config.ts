import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  outputDir: '../../.codex/artifacts/e2e',
  reporter: 'list',
  use: {
    baseURL: process.env.KINETIX_FRONTEND_URL ?? 'http://127.0.0.1:18017',
    browserName: 'chromium',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
