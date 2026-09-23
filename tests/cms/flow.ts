import type { BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { env } from '../../src/config';
import {
  checkMainMenus,
  loginCms,
  loginVerdict,
  logoutCms,
  type CmsAccount,
} from '../../src/pages/cms-admin';
import { attachResult, type Verdict } from '../../src/pages/result';
import { classifyTiming, formatMs } from '../../src/timing';

/**
 * Một hệ CMS = 1 context mới (ẩn danh), 3 case nối tiếp.
 * Không dùng sharedPage của luồng học sinh.
 */
export function cmsFlow(id: string, system: string, account: () => CmsAccount, ready: () => boolean) {
  let context: BrowserContext;
  let page: Page;

  test.describe(`${id} · ${system}`, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({
        locale: 'vi-VN',
        viewport: { width: 1440, height: 900 },
        ignoreHTTPSErrors: true,
      });
      page = await context.newPage();
    });

    test.afterAll(async () => {
      if (page && !page.isClosed() && !page.url().includes('/login')) {
        await logoutCms(page).catch(() => undefined);
      }
      await context?.close();
    });

    test.afterEach(async ({}, testInfo) => {
      if (testInfo.status === testInfo.expectedStatus || !page) return;
      const shot = await page.screenshot({ fullPage: false }).catch(() => null);
      if (shot) {
        await testInfo.attach('screenshot-on-failure', { body: shot, contentType: 'image/png' });
      }
    });

    test(`${id}-01 · Đăng nhập`, async ({}, testInfo) => {
      test.skip(!ready(), 'Thiếu tài khoản trong .env');
      const result = await loginCms(page, account());
      const verdict = loginVerdict(result.reached, result.elapsed, result.reloaded);
      await attachResult(testInfo, verdict, {
        t_login: formatMs(result.elapsed),
        man_hinh_dich: result.reached ? 'màn hình chính' : 'không vào được',
        ...(result.reloaded ? { tai_lai: 'có' } : {}),
      });
    });

    test(`${id}-02 · Kiểm tra TẤT CẢ menu chính`, async ({}, testInfo) => {
      test.skip(!ready(), 'Thiếu tài khoản trong .env');
      test.setTimeout(180_000);
      const checks = await checkMainMenus(page, account().baseUrl);
      const passed = checks.filter((item) => item.ok).length;
      const failed = checks
        .filter((item) => !item.ok)
        .map((item) => `${item.name} (${item.note || 'HTTP ' + item.status})`);
      const verdict: Verdict = checks.length > 0 && failed.length === 0 ? 'PASS' : 'FAIL';
      await attachResult(testInfo, verdict, {
        tong_so_menu: checks.length,
        so_menu_pass: `${passed}/${checks.length} pass`,
        danh_sach_menu_loi: failed.length ? failed.join('; ') : 'không có',
      });
    });

    test(`${id}-03 · Đăng xuất`, async ({}, testInfo) => {
      test.skip(!ready(), 'Thiếu tài khoản trong .env');
      let elapsed = 0;
      let error = '';
      try {
        elapsed = await logoutCms(page);
      } catch (err) {
        error = err instanceof Error ? err.message.split('\n')[0].slice(0, 180) : String(err);
      }
      const verdict: Verdict = error ? 'FAIL' : classifyTiming(elapsed, env.passMaxMs, env.warningMaxMs);
      await attachResult(testInfo, verdict, {
        t_logout: elapsed ? formatMs(elapsed) : 'N/A',
        ...(error ? { loi: error } : {}),
      });
    });
  });
}
