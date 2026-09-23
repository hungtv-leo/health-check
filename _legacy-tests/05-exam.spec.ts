import { test, expect } from '@playwright/test';
import { assertLoggedIn, dismissPopups } from '../src/pages/auth';
import { env, examAttemptUrl, lessonUrl } from '../src/config';
import { generateExamQuestions, submitEmptyTimeOnTask } from '../src/api/learning';

test.describe('Learning · Bài kiểm tra', { tag: ['@critical'] }, () => {
  test('UI mở làm bài kiểm tra + generate ma trận câu hỏi', async ({ page }) => {
    await assertLoggedIn(page);
    await dismissPopups(page);

    await page.goto(lessonUrl(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await dismissPopups(page);

    await page.evaluate(() => {
      const examRoot = [...document.querySelectorAll('div')].find(
        (d) =>
          (d.innerText || '').startsWith('Bài kiểm tra kiến thức') &&
          (d.innerText || '').includes('Làm lại') &&
          (d.innerText || '').length < 300,
      );
      const btn =
        examRoot &&
        [...examRoot.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === 'Làm lại');
      if (btn) btn.click();
    });

    await page.waitForURL(/lam-bai-kiem-tra/, { timeout: 20000 }).catch(async () => {
      await page.goto(examAttemptUrl(), { waitUntil: 'domcontentloaded' });
    });
    await page.waitForTimeout(4000);

    await expect(page.getByRole('button', { name: /nộp bài/i }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('body')).toContainText(/Cộng trừ số tự nhiên|câu|Nộp bài/i);
  });

  test('API generate + nộp trống → totalResults = 0', async ({ page }, testInfo) => {
    await assertLoggedIn(page);

    const gen = await generateExamQuestions(page);
    expect([200, 201]).toContain(gen.res.status());
    expect(gen.body.code, gen.text).toBe(200);
    expect(gen.body.data?.questions?.length).toBeGreaterThan(0);

    const { res, body, text, elapsed } = await submitEmptyTimeOnTask(page, {
      type: 2,
      lessonId: env.examId,
    });

    await testInfo.attach('exam-submit-response', { body: text, contentType: 'application/json' });
    expect(res.status(), text).toBeGreaterThanOrEqual(200);
    expect(res.status(), text).toBeLessThan(300);
    expect(body.totalResults).toBe(0);

    if (elapsed > env.warningMaxMs) {
      throw new Error(`Nộp bài kiểm tra quá chậm: ${(elapsed / 1000).toFixed(2)}s`);
    }
    if (elapsed > env.passMaxMs) {
      await testInfo.attach('timing-warning', {
        body: `Nộp bài kiểm tra: ${(elapsed / 1000).toFixed(2)}s → WARNING`,
        contentType: 'text/plain',
      });
    }
  });
});
