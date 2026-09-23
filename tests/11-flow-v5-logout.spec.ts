import { test } from '../src/fixtures';
import { dismissPopups, ensureLoggedIn, logout } from '../src/pages/auth';
import { attachResult, type Verdict } from '../src/pages/result';
import { classifyTiming, formatMs } from '../src/timing';
import { env } from '../src/config';
import { restoreV5SessionThenOpenV6 } from '../src/pages/system-switch';

/**
 * HC-V5-07 · Đăng xuất V5 — đúng thứ tự sheet (sau HC-V5-06). Sau logout, bridge khôi phục
 * phiên V5 + đứng lại trên V6 để HC-V6-01 còn đúng tiền điều kiện sheet (đã login V5, vừa
 * chuyển sang V6). Bridge không phải case báo cáo.
 */
test('HC-V5-07 · Đăng xuất V5', { tag: ['@critical', '@HC-V5'] }, async ({ sharedPage: page }, testInfo) => {
  await page.goto(env.v5BaseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await ensureLoggedIn(page, env.v5BaseUrl);
  await dismissPopups(page);

  let elapsed = 0;
  let error: unknown;
  try {
    elapsed = await logout(page);
  } catch (err) {
    error = err;
  }

  try {
    const verdict: Verdict = error ? 'FAIL' : classifyTiming(elapsed, env.passMaxMs, env.warningMaxMs);
    await attachResult(testInfo, verdict, {
      t_logout: elapsed ? formatMs(elapsed) : 'N/A',
      ...(error ? { loi: String(error instanceof Error ? error.message : error).slice(0, 200) } : {}),
    });
  } finally {
    await restoreV5SessionThenOpenV6(page);
  }
});
