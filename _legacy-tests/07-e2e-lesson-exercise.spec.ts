import { test, expect } from '@playwright/test';
import { assertLoggedIn, dismissPopups } from '../src/pages/auth';
import { env } from '../src/config';
import {
  openLessonPage,
  assertVideoPlaying,
  openFirstExercise,
  submitExerciseEmptyOnUi,
} from '../src/pages/learning';

test.describe('E2E · Sau login: bài giảng + bài tập', { tag: ['@critical'] }, () => {
  test('Video load được → làm bài tập → nộp trống → 0 điểm', async ({ page }, testInfo) => {
    await assertLoggedIn(page);
    await dismissPopups(page);

    await openLessonPage(page);
    await dismissPopups(page);
    const videoMeta = await assertVideoPlaying(page);
    await testInfo.attach('video-meta', {
      body: JSON.stringify(videoMeta, null, 2),
      contentType: 'application/json',
    });

    await openFirstExercise(page);
    await expect(page.locator('body')).toContainText(/Giới thiệu cộng trừ có nhớ|Câu|Nộp bài/i);

    const submit = await submitExerciseEmptyOnUi(page);
    await testInfo.attach('submit-response', {
      body: submit.bodyText,
      contentType: 'application/json',
    });

    expect(submit.status, submit.bodyText).toBeGreaterThanOrEqual(200);
    expect(submit.status, submit.bodyText).toBeLessThan(300);
    expect(submit.totalResults, `Expected totalResults=0, got ${submit.totalResults}`).toBe(0);

    await expect(page.locator('body')).toContainText(/hoàn thành|kết quả|Chúc mừng/i, {
      timeout: 15000,
    });

    if (submit.elapsed > env.warningMaxMs) {
      throw new Error(`Nộp bài tập UI quá chậm: ${(submit.elapsed / 1000).toFixed(2)}s`);
    }
    if (submit.elapsed > env.passMaxMs) {
      await testInfo.attach('timing-warning', {
        body: `Nộp bài tập (UI): ${(submit.elapsed / 1000).toFixed(2)}s → WARNING`,
        contentType: 'text/plain',
      });
    } else {
      await testInfo.attach('timing', {
        body: `Nộp bài tập (UI): ${(submit.elapsed / 1000).toFixed(2)}s → PASS`,
        contentType: 'text/plain',
      });
    }
  });
});
