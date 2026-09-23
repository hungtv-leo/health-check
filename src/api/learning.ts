import type { Page } from '@playwright/test';
import { env } from '../config';
import { authHeaders } from '../pages/auth';

export async function submitEmptyTimeOnTask(
  page: Page,
  opts: { type: number; lessonId: string; time?: number },
) {
  const headers = await authHeaders(page);
  const started = Date.now();
  const res = await page.request.post(`${env.apiUrl}/business-service/public/time-on-task`, {
    headers,
    data: {
      type: opts.type,
      time: opts.time ?? 5,
      lessonId: opts.lessonId,
    },
  });
  const elapsed = Date.now() - started;
  const text = await res.text();
  const body = JSON.parse(text);
  return { res, body, text, elapsed };
}

export async function generateExerciseQuestions(page: Page, exerciseId = env.exerciseId) {
  const headers = await authHeaders(page);
  const res = await page.request.get(
    `${env.apiUrl}/learning-service/exercise-lessons/generation-question/${exerciseId}`,
    { headers },
  );
  const text = await res.text();
  return { res, body: JSON.parse(text), text };
}

export async function generateExamQuestions(page: Page) {
  const headers = await authHeaders(page);
  const cookies = await page.context().cookies();
  const userId = cookies.find((c) => c.name === 'x-user-id')?.value;
  if (!userId) throw new Error('Missing x-user-id');

  const res = await page.request.post(
    `${env.apiUrl}/learning-service/select-question-matrices/generation-pursuit-matrix`,
    {
      headers,
      data: {
        categoryItemId: env.lessonId,
        curriculumFrameworkWeekId: env.weekId,
        studentId: userId,
        user_kc_id: userId,
        enumLang: '1',
      },
    },
  );
  const text = await res.text();
  return { res, body: JSON.parse(text), text };
}

export async function generatePracticeQuestions(page: Page) {
  const headers = await authHeaders(page);
  const res = await page.request.post(
    `${env.apiUrl}/learning-service/training-exam-tests-web/generation-question-exam`,
    {
      headers,
      data: {
        roundId: env.practiceRoundId,
        type: 2,
        enumLang: '1',
      },
    },
  );
  const text = await res.text();
  return { res, body: JSON.parse(text), text };
}
