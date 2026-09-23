import { test } from '../src/fixtures';
import { dismissPopups, ensureLoggedIn, logout } from '../src/pages/auth';
import { attachResult, type Verdict } from '../src/pages/result';
import { classifyTiming, formatMs } from '../src/timing';
import { env } from '../src/config';

/**
 * HC-V6-09 · Đăng xuất V6 — đúng thứ tự sheet (sau HC-V6-08, trước mục VNMF).
 * HC-V6-08 để lại trình duyệt trên vnmf.edu.vn → quay về V6 rồi mới logout.
 */
test('HC-V6-09 · Đăng xuất V6', { tag: ['@critical', '@HC-V6'] }, async ({ sharedPage: page }, testInfo) => {
  await page.goto(env.baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await ensureLoggedIn(page);
  await dismissPopups(page);

  let elapsed = 0;
  let error: unknown;
  try {
    elapsed = await logout(page);
  } catch (err) {
    error = err;
  }

  const verdict: Verdict = error ? 'FAIL' : classifyTiming(elapsed, env.passMaxMs, env.warningMaxMs);
  await attachResult(testInfo, verdict, {
    t_logout: elapsed ? formatMs(elapsed) : 'N/A',
    ...(error ? { loi: String(error instanceof Error ? error.message : error).slice(0, 200) } : {}),
  });
});
