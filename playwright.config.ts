import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const VISUAL_AUTH_STATE_PATH = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./src/reporters/discord-reporter.ts'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://tnmath.edu.vn',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'vi-VN',
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    // Không set thì click()/fill() sẽ chờ tới hết TOÀN BỘ ngân sách timeout của cả test (120s)
    // khi selector sai/phần tử không bao giờ xuất hiện — vừa lãng phí thời gian vừa (quan sát
    // thực tế) khiến worker bị Playwright restart giữa chừng, làm hỏng lây các case sau đó dùng
    // sharedPage (xem src/fixtures.ts). Giới hạn riêng action timeout để fail nhanh, rõ ràng.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  // Luồng chính (10-14) KHÔNG dùng storageState — tự login trong test (xem src/fixtures.ts).
  // 08-visual dùng project setup/storageState riêng; `npm test` chỉ chạy project chromium.
  projects: [
    {
      name: 'visual-setup',
      testMatch: /08-visual\.setup\.ts/,
    },
    {
      name: 'visual',
      testMatch: /08-visual\.spec\.ts/,
      dependencies: ['visual-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: VISUAL_AUTH_STATE_PATH,
      },
    },
    {
      name: 'chromium',
      testIgnore: [/08-visual\.setup\.ts/, /08-visual\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
