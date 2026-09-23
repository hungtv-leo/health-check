import { test, expect } from '@playwright/test';
import { assertLoggedIn } from '../src/pages/auth';
import { env } from '../src/config';
import { generateExerciseQuestions, submitEmptyTimeOnTask } from '../src/api/learning';

test.describe('Learning · Bài tập', { tag: ['@critical', '@smoke'] }, () => {
  test('Generate câu hỏi + nộp trống → totalResults = 0', async ({ page }, testInfo) => {
    await assertLoggedIn(page);

    const gen = await generateExerciseQuestions(page);
    expect(gen.res.status(), gen.text).toBe(200);
    expect(gen.body.data?.questions?.length).toBeGreaterThan(0);

    const { res, body, text, elapsed } = await submitEmptyTimeOnTask(page, {
      type: 1,
      lessonId: env.exerciseId,
    });

    await testInfo.attach('submit-response', { body: text, contentType: 'application/json' });
    expect(res.status(), text).toBeGreaterThanOrEqual(200);
    expect(res.status(), text).toBeLessThan(300);
    expect(body.totalResults, `Expected totalResults=0, got ${body.totalResults}`).toBe(0);

    if (elapsed > env.warningMaxMs) {
      throw new Error(`Nộp bài tập quá chậm: ${(elapsed / 1000).toFixed(2)}s`);
    }
    if (elapsed > env.passMaxMs) {
      await testInfo.attach('timing-warning', {
        body: `Nộp bài tập: ${(elapsed / 1000).toFixed(2)}s → WARNING`,
        contentType: 'text/plain',
      });
    }
  });
});
