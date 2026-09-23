import { test, expect } from '../src/fixtures';
import { dismissPopups, loginTrigger } from '../src/pages/auth';
import { attachResult, readHeaderUserInfo, probeCurrentPageStatus, type Verdict } from '../src/pages/result';
import { classifyTiming, formatMs } from '../src/timing';
import { env } from '../src/config';
import {
  openV6AnyLessonAndPlayVideo,
  openV6ExerciseFromLessonAndSubmit,
  openV6ExamAndSubmit,
  openV6PracticeAndSubmit,
} from '../src/pages/v6-flow';
import { playArenaVsBotAndCheckQuestion } from '../src/pages/arena';
import { switchV6ToV5ViaThiNgay, switchV6ToVnmf } from '../src/pages/system-switch';

/**
 * B. WEB V6 (tnmath.edu.vn) — HC-V6-01..08. Tiếp nối sau HC-V5-07 + bridge (cùng `sharedPage`):
 * HC-V6-01 lấy thông tin đăng nhập từ V5 qua SSO. Nếu Keycloak bắt nhập lại → FAIL đúng sheet,
 * vẫn điền form để case sau tiếp tục chạy được.
 */
// Xem giải thích ở tests/10-flow-v5.spec.ts — cố tình KHÔNG dùng mode:'serial'.

test.describe('Luồng liên tục · B. WEB V6', { tag: ['@critical', '@HC-V6'] }, () => {
  test('HC-V6-01 · Đăng nhập V6 (lấy thông tin từ V5 qua SSO)', async ({ sharedPage: page }, testInfo) => {
    await page.goto(env.baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await dismissPopups(page);
    const httpStatus = await probeCurrentPageStatus(page);

    const btn = loginTrigger(page);
    await expect(btn, 'Header phải còn hiện nút Đăng nhập trước khi bấm').toBeVisible({ timeout: 10000 });

    const started = Date.now();
    await btn.click();
    // Race: SSO im lặng (SBD hiện) HOẶC form Keycloak. Không chờ form full timeout khi SSO
    // đã xong — nếu không t_login bị phình (~20s) dù đăng nhập thành công.
    const userField = page.locator('input[name="username"]');
    const sbdMarker = page.getByText(/SBD:/i).first();
    const raced = await Promise.race([
      userField.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'form' as const),
      sbdMarker.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'sso' as const),
    ]).catch(() => 'timeout' as const);

    const formShown = raced === 'form';
    if (formShown) {
      await userField.fill(env.studentUser);
      await page.locator('input[type="password"]').fill(env.studentPass);
      await page.getByRole('button', { name: /^đăng nhập$/i }).last().click();
      await sbdMarker.waitFor({ state: 'visible', timeout: 30000 });
    } else if (raced === 'timeout') {
      await sbdMarker.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }
    const elapsed = Date.now() - started;

    const { tenUser } = await readHeaderUserInfo(page);
    const hasMyTnmath = await page
      .getByText(/My TNMath/i)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    const timingVerdict = classifyTiming(elapsed, env.passMaxMs, env.warningMaxMs);
    const contentOk = !formShown && !!tenUser && httpStatus === 200 && hasMyTnmath;
    const verdict: Verdict = contentOk ? timingVerdict : 'FAIL';
    await attachResult(testInfo, verdict, {
      t_login: formatMs(elapsed),
      phai_nhap_lai: formShown ? 'có' : 'không',
      user: tenUser || 'N/A',
      http_status: httpStatus,
      my_tnmath: hasMyTnmath ? 'có' : 'không',
    });
  });
  test('HC-V6-02 · Học Toán (video bài giảng)', async ({ sharedPage: page }, testInfo) => {
    const { currentTime, lessonTitle } = await openV6AnyLessonAndPlayVideo(page);
    const verdict: Verdict = currentTime > 0 ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      ten_bai_giang: lessonTitle || 'N/A',
      currentTime: currentTime.toFixed(1),
    });
  });

  test('HC-V6-03 · Học Toán (bài tập)', async ({ sharedPage: page }, testInfo) => {
    const { visible, submitted } = await openV6ExerciseFromLessonAndSubmit(page);
    const verdict: Verdict = visible && submitted ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      hien_de: visible ? 'có' : 'không',
      nop_bai: submitted ? 'thành công' : 'thất bại',
    });
  });

  test('HC-V6-04 · Học Toán (bài kiểm tra)', async ({ sharedPage: page }, testInfo) => {
    const { visible, submitted } = await openV6ExamAndSubmit(page);
    const verdict: Verdict = visible && submitted ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      hien_de: visible ? 'có' : 'không',
      nop_bai: submitted ? 'thành công' : 'thất bại',
    });
  });

  test('HC-V6-05 · Luyện Toán (bài luyện)', async ({ sharedPage: page }, testInfo) => {
    const { visible, submitted } = await openV6PracticeAndSubmit(page);
    const verdict: Verdict = visible && submitted ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      hien_de: visible ? 'có' : 'không',
      nop_bai: submitted ? 'thành công' : 'thất bại',
    });
  });

  test('HC-V6-06 · Đấu trường (đấu với bot)', async ({ sharedPage: page }, testInfo) => {
    const hienCauHoi = await playArenaVsBotAndCheckQuestion(page);
    const verdict: Verdict = hienCauHoi ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, { hien_cau_hoi: hienCauHoi ? 'có' : 'không' });
  });

  test('HC-V6-07 · Chuyển hệ V6 → V5 (Thi ngay)', async ({ sharedPage: page }, testInfo) => {
    const { host, path, status, sessionKept } = await switchV6ToV5ViaThiNgay(page);
    const hostOk = /thi\.trangnguyen\.edu\.vn/i.test(host) || host.includes(new URL(env.v5BaseUrl).host);
    const pathOk = /vao-thi-trang-nguyen-2023/i.test(path) || hostOk;
    const verdict: Verdict = hostOk && status === 200 && sessionKept && pathOk ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      host_dich: host,
      duong_dan: path,
      http_status: status,
      trang_thai_phien: sessionKept ? 'còn' : 'mất',
    });
  });

  test('HC-V6-08 · Chuyển hệ V6 → VNMF', async ({ sharedPage: page }, testInfo) => {
    const { host, status } = await switchV6ToVnmf(page);
    const verdict: Verdict = host.includes(new URL(env.vnmfBaseUrl).host) && status === 200 ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, { host_dich: host, http_status: status });
  });
});
