import { test } from '../src/fixtures';
import { attachResult, type Verdict } from '../src/pages/result';
import { openVnmfHomeAndInspect, openVnmfNewsAndInspect } from '../src/pages/vnmf';
import { switchVnmfToV6ViaLogin } from '../src/pages/system-switch';
import { env } from '../src/config';

/**
 * C. VNMF (vnmf.edu.vn) — HC-VNMF-01..03. Chạy SAU HC-V6-09 (đúng thứ tự sheet).
 * Trang chủ / tin tức không cần đăng nhập; HC-VNMF-03 bấm Đăng nhập → về V6 (có thể hiện
 * Keycloak sau khi vừa logout — sheet chỉ yêu cầu host + HTTP 200).
 */
// Xem giải thích ở tests/10-flow-v5.spec.ts — cố tình KHÔNG dùng mode:'serial'.

test.describe('Luồng liên tục · C. VNMF', { tag: ['@critical', '@HC-VNMF'] }, () => {
  test('HC-VNMF-01 · Trang chủ', async ({ sharedPage: page }, testInfo) => {
    const { status, menuFound, hasEnterExam, hasLogin } = await openVnmfHomeAndInspect(page);
    const verdict: Verdict = status === 200 && menuFound === 5 && hasEnterExam && hasLogin ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      http_status: status,
      so_menu: `${menuFound}/5`,
    });
  });

  test('HC-VNMF-02 · Tin tức', async ({ sharedPage: page }, testInfo) => {
    const { status, articleCount, articleContentNotEmpty } = await openVnmfNewsAndInspect(page);
    const verdict: Verdict = status === 200 && articleCount > 0 && articleContentNotEmpty ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      http_status: status,
      so_bai_viet: articleCount,
    });
  });

  test('HC-VNMF-03 · Chuyển hệ VNMF → V6', async ({ sharedPage: page }, testInfo) => {
    const { host, status } = await switchVnmfToV6ViaLogin(page);
    const verdict: Verdict = host.includes(new URL(env.baseUrl).host) && status === 200 ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, { host_dich: host, http_status: status });
  });
});
