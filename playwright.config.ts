import { defineConfig, devices } from '@playwright/test';
import { BASE_PATH } from './deploy.config.mjs';

// End-to-end tests run against the production build (`npm run build` first), served by `astro preview`.
// To test the live site instead: `npm run test:prod` (sets PROD_URL; no local server is started).
const PORT = 4321;
const PROD_URL = process.env.PROD_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Over a real network, fewer parallel browsers avoid self-inflicted timeouts; one retry absorbs network blips.
  retries: process.env.CI || PROD_URL ? 1 : 0,
  workers: PROD_URL ? 3 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: PROD_URL ?? `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'small-phone', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: PROD_URL
    ? undefined
    : {
        command: `npx astro preview --port ${PORT}`,
        url: `http://localhost:${PORT}${BASE_PATH}`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
