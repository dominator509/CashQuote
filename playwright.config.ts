import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../node_modules/ts-node/dist/bin.js --project tsconfig.json src/index.ts',
      cwd: 'server',
      url: 'http://127.0.0.1:3000/healthz',
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'e2e',
        PORT: '3000',
        DATABASE_URL: process.env.DATABASE_URL || '',
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-jwt-secret',
        APP_ORIGIN: 'http://127.0.0.1:5173',
        CORS_ORIGIN: 'http://127.0.0.1:5173',
        PILOT_ACCESS_CODE: process.env.PILOT_ACCESS_CODE || 'e2e-private-pilot-code-12345',
        PILOT_EMAIL_ALLOWLIST: process.env.PILOT_EMAIL_ALLOWLIST || '',
        ALLOW_MOCK_EMAIL: 'true',
        SMTP_URL: '',
        SMTP_FROM: '',
        TRUST_PROXY: 'false',
      },
    },
    {
      command: 'node ../node_modules/vite/bin/vite.js --host 127.0.0.1',
      cwd: 'client',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
