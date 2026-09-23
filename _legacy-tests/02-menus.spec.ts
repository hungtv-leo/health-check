import { test, expect } from '@playwright/test';
import { assertLoggedIn, dismissPopups } from '../src/pages/auth';
import { env } from '../src/config';

const MAIN_MENUS = [
  'My TNMath',
  'Về TNMath',
  'Khóa học',
  'Học Toán',
  'Luyện Toán',
  'Thi Toán',
  'Game Toán',
  'Đấu trường',
  'Thế giới Toán học',
  'Vinh danh',
  'Đổi quà',
  'Vòng quay may mắn',
  'Tin tức',
];

test.describe('UI · Menu / button TNMath', { tag: ['@smoke'] }, () => {
  test('Các menu chính hiển thị và click được', async ({ page }) => {
    await assertLoggedIn(page);
    await dismissPopups(page);

    for (const name of MAIN_MENUS) {
      const item = page
        .getByRole('link', { name: new RegExp(`^${name}$`, 'i') })
        .or(page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }))
        .or(page.getByText(name, { exact: true }))
        .first();
      await expect(item, `Menu missing: ${name}`).toBeVisible({ timeout: 10000 });
      await expect(item).toBeEnabled();
    }

    await page.getByText('Học Toán', { exact: true }).first().click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/hoc-toan|tnmath\.edu\.vn/i);
    expect(page.url()).toContain(env.baseUrl.replace(/\/$/, ''));
  });
});
