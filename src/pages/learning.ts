import { expect, type Page } from '@playwright/test';
import { courseUrl, lessonUrl } from '../config';

export async function openLessonPage(page: Page): Promise<void> {
  await page.goto(lessonUrl(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  let video = page.locator('video').first();
  if (!(await video.isVisible().catch(() => false))) {
    await page.goto(courseUrl(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /vào học/i }).first().click();
    await page.waitForURL(/hoc-toan\/.+\/.+/, { timeout: 20000 });
    await page.waitForTimeout(3000);
  }
}

export async function assertVideoPlaying(page: Page): Promise<{
  currentTime: number;
  readyState: number;
}> {
  const video = page.locator('video').first();
  await expect(video, 'Video player không hiển thị').toBeVisible({ timeout: 30000 });

  await video.evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play().catch(() => {});
  });

  const paused = await video.evaluate((el: HTMLVideoElement) => el.paused);
  if (paused) {
    await video.click({ force: true }).catch(() => {});
    await video.evaluate(async (el: HTMLVideoElement) => {
      el.muted = true;
      await el.play().catch(() => {});
    });
  }

  await page.waitForTimeout(3500);

  const meta = await video.evaluate((el: HTMLVideoElement) => ({
    currentTime: el.currentTime,
    readyState: el.readyState,
    error: el.error?.code ?? null,
    src: el.currentSrc || el.src,
  }));

  expect(meta.error, `Video error code=${meta.error}`).toBeNull();
  expect(meta.readyState, `readyState quá thấp: ${meta.readyState}`).toBeGreaterThanOrEqual(2);
  expect(meta.currentTime, `currentTime không tăng: ${JSON.stringify(meta)}`).toBeGreaterThan(0);
  return meta;
}

/** Mở bài tập đầu tiên trên sidebar (Giới thiệu cộng trừ có nhớ → Làm lại / Làm bài). */
export async function openFirstExercise(page: Page): Promise<void> {
  const opened = await page.evaluate(() => {
    const firstItem = [...document.querySelectorAll('button')].find((b) =>
      (b.innerText || '').includes('Giới thiệu cộng trừ có nhớ'),
    );
    if (!firstItem) return false;
    const btn = [...firstItem.querySelectorAll('button')].find((x) =>
      /^(Làm lại|Làm bài)$/.test((x.innerText || '').trim()),
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  expect(opened, 'Không tìm thấy nút Làm lại/Làm bài của bài tập').toBeTruthy();
  await page.waitForURL(/lam-bai-tap/, { timeout: 20000 });
  await page.waitForTimeout(3000);
  await expect(page.getByRole('button', { name: /nộp bài/i }).first()).toBeVisible({ timeout: 20000 });
}

/** Nộp bài trên UI (không chọn đáp án) và bắt response time-on-task. */
export async function submitExerciseEmptyOnUi(page: Page): Promise<{
  status: number;
  totalResults: number | undefined;
  elapsed: number;
  bodyText: string;
}> {
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes('/business-service/public/time-on-task') &&
      res.request().method() === 'POST' &&
      (res.request().postData() || '').includes('"type":1'),
    { timeout: 30000 },
  );

  const started = Date.now();
  await page.getByRole('button', { name: /^nộp bài$/i }).first().click();
  await page.waitForTimeout(800);

  const confirm = page
    .locator('.dialog_attempt_wrap.show button, .dialog_attempt_wrap button')
    .filter({ hasText: /^Nộp bài$|^Đồng ý$|Xác nhận/i })
    .last();
  if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirm.click({ force: true });
  } else {
    await page.getByRole('button', { name: /^nộp bài$|^đồng ý$/i }).last().click({ force: true });
  }

  const res = await responsePromise;
  const elapsed = Date.now() - started;
  const bodyText = await res.text();
  const body = JSON.parse(bodyText);
  return {
    status: res.status(),
    totalResults: body.totalResults,
    elapsed,
    bodyText,
  };
}
