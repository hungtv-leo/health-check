import { test, expect } from '../src/fixtures';
import { loginAsStudent } from '../src/pages/auth';
import { attachResult, readHeaderUserInfo, type Verdict } from '../src/pages/result';
import { classifyTiming, formatMs } from '../src/timing';
import { env } from '../src/config';
import {
  openV5ExamAndCheckVisible,
  confirmSubmitAndCheckToast,
  openV5PracticeAndCheckVisible,
  openV5AnyLessonAndPlayVideo,
  openV5ExerciseAfterLessonAndCheckVisible,
} from '../src/pages/v5-learning';
import { switchV5ToV6 } from '../src/pages/system-switch';

/**
 * A. WEB V5 (trangnguyen.edu.vn) — HC-V5-01..06, sheet "Webuser các V - Test case".
 * Dùng chung `sharedPage` xuyên suốt tests/10-14. HC-V5-01 login; sau HC-V5-06 sang V6;
 * HC-V5-07 (logout) nằm ở 11-flow-v5-logout.spec.ts đúng thứ tự sheet.
 */
// KHÔNG dùng mode:'serial': workers:1 + fullyParallel:false (playwright.config.ts) đã đảm bảo
// thứ tự chạy đúng theo khai báo + cùng 1 worker (nên vẫn dùng chung sharedPage). 'serial' sẽ
// tự SKIP toàn bộ case còn lại trong file ngay khi 1 case fail — không phù hợp ở đây vì 1 case
// fail (vd HC-V5-02 không hiện đề) không có nghĩa là session hỏng; các case sau đó (vẫn cần
// login) nên được thử độc lập để còn biết case nào khác cũng lỗi, case nào vẫn hoạt động.

test.describe('Luồng liên tục · A. WEB V5', { tag: ['@critical', '@HC-V5'] }, () => {
  test('HC-V5-01 · Đăng nhập V5', { tag: ['@smoke'] }, async ({ sharedPage: page }, testInfo) => {
    let elapsed = 0;
    let error: unknown;
    try {
      elapsed = await loginAsStudent(page, undefined, env.v5BaseUrl);
    } catch (err) {
      error = err;
    }
    const { tenUser, sbd } = await readHeaderUserInfo(page);
    const contentOk = !error && !!tenUser && !!sbd;
    const verdict: Verdict = !contentOk ? 'FAIL' : classifyTiming(elapsed, env.passMaxMs, env.warningMaxMs);
    await attachResult(testInfo, verdict, {
      t_login: elapsed ? formatMs(elapsed) : 'N/A',
      trang_dich: 'trang chủ V5 đã login',
      user: tenUser || 'N/A',
      SBD: sbd || 'N/A',
    });
  });

  test('HC-V5-02 · Thi hay (bài thi)', async ({ sharedPage: page }, testInfo) => {
    const { visible, roundLabel } = await openV5ExamAndCheckVisible(page);
    const submitted = visible ? await confirmSubmitAndCheckToast(page) : false;
    const verdict: Verdict = visible && submitted ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      hien_de: visible ? 'có' : 'không',
      nop_bai: submitted ? 'thành công' : 'thất bại',
      vong_thi: roundLabel || 'N/A',
    });
  });

  test('HC-V5-03 · Luyện thích (bài luyện)', async ({ sharedPage: page }, testInfo) => {
    const visible = await openV5PracticeAndCheckVisible(page);
    const submitted = visible ? await confirmSubmitAndCheckToast(page) : false;
    const verdict: Verdict = visible && submitted ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      hien_de: visible ? 'có' : 'không',
      nop_bai: submitted ? 'thành công' : 'thất bại',
    });
  });

  test('HC-V5-04 · Học giỏi (video bài giảng)', async ({ sharedPage: page }, testInfo) => {
    const { currentTime, lessonTitle } = await openV5AnyLessonAndPlayVideo(page);
    const verdict: Verdict = currentTime > 0 ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, {
      ten_bai_giang: lessonTitle || 'N/A',
      currentTime: currentTime.toFixed(2),
    });
  });

  test('HC-V5-05 · Học giỏi (bài tập sau bài giảng)', async ({ sharedPage: page }, testInfo) => {
    const visible = await openV5ExerciseAfterLessonAndCheckVisible(page);
    const verdict: Verdict = visible ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, { hien_de: visible ? 'có' : 'không' });
  });

  test('HC-V5-06 · Chuyển hệ V5 → V6', async ({ sharedPage: page }, testInfo) => {
    const { host, status } = await switchV5ToV6(page);
    const verdict: Verdict = host.includes(new URL(env.baseUrl).host) && status === 200 ? 'PASS' : 'FAIL';
    await attachResult(testInfo, verdict, { host_dich: host, http_status: status });
    expect(host, 'Điều hướng sai host đích').toContain(new URL(env.baseUrl).host);
  });
});
