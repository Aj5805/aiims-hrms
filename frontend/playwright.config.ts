import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/e2e',
  globalSetup: './src/test/e2e/globalSetup.ts',
  webServer: [
    {
      command: 'cmd /c "cd /d ..\\backend && set APP_ENV=test && set RATE_LIMIT_AUTH=20/minute && .venv\\Scripts\\python -m uvicorn main:app --port 8000"',
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
