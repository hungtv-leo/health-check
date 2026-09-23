import { test, expect } from '@playwright/test';
import { assertLoggedIn, logout, loginTrigger, dismissPopups } from '../src/pages/auth';

/**
 * Chạy CUỐI suite (tên file 99-*) để không làm mất session của các case trước.
 * Session lấy từ auth.setup (storageState).
 */
test.describe('Auth · Logout (cuối suite)', { tag: ['@critical'] }, () => {
  test('Logout thành công và đo thời gian', async ({ page }, testInfo) => {
    await assertLoggedIn(page);
    await dismissPopups(page);

    const elapsed = await logout(page, testInfo);
    await expect(loginTrigger(page)).toBeVisible();
    await expect(page.getByText(/SBD:/i)).toHaveCount(0);
    expect(elapsed).toBeGreaterThan(0);
  });
});
