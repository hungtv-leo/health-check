import { test, expect, type Locator } from '@playwright/test';
import { openLoginModal, dismissPopups, assertLoggedIn } from '../src/pages/auth';
import { openLessonPage } from '../src/pages/learning';
import { practiceListUrl } from '../src/config';

/**
 * Visual Regression (Playwright toHaveScreenshot).
 * Chi chup cac trang ON DINH (khong co cau hoi random) de baseline khong bi flaky:
 *   - Form dang nhap (logged out)
 *   - Trang bai hoc (mask video + header SBD)
 *   - Danh sach luyen toan (mask header SBD)
 *
 * Baseline: `npm run test:update-snapshots` (chup lai .png trong 08-visual.spec.ts-snapshots/).
 * KHONG chup trang lam bai kiem tra / lam luyen (cau hoi sinh ngau nhien -> se false-fail).
 */

// Tuy chon chung: bo qua animation, che con tro, dung tolerance vi chay prod.
const shot = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.05,
};

test.describe('Visual · trang cong khai (logged out)', { tag: '@visual' }, () => {
  // Ghi de storageState -> phien dang xuat de chup form dang nhap.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Form dang nhap', async ({ page }) => {
    await test.step('Mo form dang nhap', async () => {
      await openLoginModal(page);
      await page.waitForTimeout(800);
    });

    await test.step('So khop anh form dang nhap', async () => {
      const form: Locator = page
        .locator('form')
        .filter({ has: page.locator('input[name="username"]') })
        .first();
      await expect(form).toBeVisible();
      await expect(form).toHaveScreenshot('login-form.png', shot);
    });
  });
});

test.describe('Visual · trang sau dang nhap', { tag: '@visual' }, () => {
  test('Trang bai hoc', async ({ page }) => {
    await test.step('Mo trang bai hoc', async () => {
      await assertLoggedIn(page);
      await dismissPopups(page);
      await openLessonPage(page);
      await dismissPopups(page);
      await page.waitForTimeout(1500);
    });

    await test.step('So khop anh trang bai hoc', async () => {
      await expect(page).toHaveScreenshot('lesson-page.png', {
        ...shot,
        fullPage: false,
        mask: [page.locator('video'), page.getByText(/SBD:/i)],
      });
    });
  });

  test('Danh sach luyen toan', async ({ page }) => {
    await test.step('Mo danh sach luyen toan', async () => {
      await assertLoggedIn(page);
      await dismissPopups(page);
      await page.goto(practiceListUrl(), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await dismissPopups(page);
      await expect(page.getByText(/Ôn luyện vòng/i).first()).toBeVisible({ timeout: 15000 });
    });

    await test.step('So khop anh danh sach luyen toan', async () => {
      await expect(page).toHaveScreenshot('practice-list.png', {
        ...shot,
        fullPage: false,
        mask: [page.getByText(/SBD:/i)],
      });
    });
  });
});
