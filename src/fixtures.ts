import { test as base, type BrowserContext, type Page } from '@playwright/test';

type WorkerFixtures = {
  sharedContext: BrowserContext;
  sharedPage: Page;
};

/**
 * Luồng liên tục đúng thứ tự sheet (tests/10-14): HC-V5-01..07 → HC-V6-01..09 →
 * HC-VNMF-01..03. Dùng 1 page/context DUY NHẤT trong worker. Sau HC-V5-07 có bridge
 * login lại V5 + mở V6 (không báo cáo) để HC-V6-01 còn đúng tiền điều kiện sheet.
 * `workers: 1` đảm bảo mọi file 10-14 chạy chung 1 worker.
 */
export const test = base.extend<{}, WorkerFixtures>({
  sharedContext: [
    async ({ browser }, use) => {
      const context = await browser.newContext({
        locale: 'vi-VN',
        viewport: { width: 1440, height: 900 },
        ignoreHTTPSErrors: true,
      });
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  sharedPage: [
    async ({ sharedContext }, use) => {
      const page = await sharedContext.newPage();
      await use(page);
    },
    { scope: 'worker' },
  ],
});

// Context dùng chung không được Playwright tự quản lý trace/video/screenshot như
// context mặc định -> tự chụp ảnh khi 1 case fail để vẫn có chứng cứ debug.
test.afterEach(async ({ sharedPage }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const shot = await sharedPage.screenshot({ fullPage: false }).catch(() => null);
    if (shot) {
      await testInfo.attach('screenshot-on-failure', { body: shot, contentType: 'image/png' });
    }
  }
});

export { expect } from '@playwright/test';
