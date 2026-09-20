import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure' },
  projects: [
    { name: 'webkit-desktop-navigation', testMatch: '**/{navigation,entities,portraits,reading-print,current-state,npc-directory,search-results,recap-mentions}.spec.ts', use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'webkit-phone', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node tests/browser/serve.mjs',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
  },
});
