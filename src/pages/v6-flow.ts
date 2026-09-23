import { expect, type Page } from '@playwright/test';
import { env, practiceListUrl } from '../config';
import { dismissPopups, ensureLoggedIn } from './auth';
import { clickFirstAnswer, confirmSubmitAndCheckToast, isQuestionVisible } from './v5-learning';

/**
 * HC-V6-02 · Học Toán (video): menu "Học Toán" -> khối "Tất Cả Dạng Bài" -> "Vào học" trên 1 thẻ
 * dạng bài bất kỳ -> trang bài giảng -> click 1 thẻ "Bài giảng" bất kỳ trong "Danh sách bài giảng"
 * -> Play. Trả về currentTime sau ~3s.
 */
export async function openV6AnyLessonAndPlayVideo(page: Page): Promise<{ currentTime: number; lessonTitle: string }> {
  await page.goto(`${env.baseUrl}/hoc-toan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await dismissPopups(page);
  await ensureLoggedIn(page);

  await page.getByRole('button', { name: /^vào học$/i }).first().click();
  await page.waitForURL(/hoc-toan\/.+\/.+/, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await dismissPopups(page);

  const lessonCard = page.getByText(/bài giảng/i).locator('..').getByRole('button').first();
  const fallbackCard = page.locator('button, a').filter({ hasText: /tuần|bài/i }).first();
  const card = (await lessonCard.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) ? lessonCard : fallbackCard;
  const lessonTitle = (await card.innerText().catch(() => '')).trim();
  await card.click().catch(() => {});
  await page.waitForTimeout(2000);

  const video = page.locator('video').first();
  await expect(video, 'Video player không hiển thị').toBeVisible({ timeout: 20000 });

  const playBtn = page.getByRole('button', { name: /play|phát/i }).first();
  if (await playBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await playBtn.click().catch(() => {});
  }
  await video.evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play().catch(() => {});
  });

  await page.waitForTimeout(3000);
  const currentTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
  return { currentTime, lessonTitle };
}

/** HC-V6-03 · Bài tập: click "Làm bài" hoặc "Làm lại" (đã làm trước đó), kiểm tra đề + nộp. */
export async function openV6ExerciseFromLessonAndSubmit(page: Page): Promise<{ visible: boolean; submitted: boolean }> {
  await dismissPopups(page);
  const startBtn = page
    .getByRole('button', { name: /^làm bài$/i })
    .or(page.getByRole('button', { name: /^làm lại$/i }))
    .first();
  // Thẻ bài giảng đã làm có thể chỉ còn "Làm lại"/"Xem kết quả" — ưu tiên nút trong sidebar
  // gần tiêu đề bài đang mở.
  const sidebarRedo = page.locator('aside, [class*="sidebar"], [class*="lesson"]').getByRole('button', { name: /^làm lại$/i }).first();
  if (await sidebarRedo.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)) {
    await sidebarRedo.click();
  } else {
    await startBtn.click();
  }
  await page.waitForTimeout(2000);
  await dismissPopups(page);

  const visible = await isQuestionVisible(page);
  if (!visible) return { visible: false, submitted: false };

  await clickFirstAnswer(page);
  const submitted = await confirmSubmitAndCheckToast(page);
  return { visible, submitted };
}

/**
 * HC-V6-04 · Bài kiểm tra: trong "Danh sách bài giảng" kéo tới thẻ "Bài kiểm tra kiến thức" ->
 * click "Kiểm tra kiến thức", kiểm tra đề hiển thị + nộp thành công.
 */
export async function openV6ExamAndSubmit(page: Page): Promise<{ visible: boolean; submitted: boolean }> {
  await dismissPopups(page);
  const continueBtn = page.getByRole('button', { name: /^tiếp tục$/i }).first();
  if (await continueBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await continueBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
    await dismissPopups(page);
  }
  if (!/\/hoc-toan\/.+\/.+/.test(page.url())) {
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissPopups(page);
  }
  // Nếu vẫn không ở trang bài giảng (case trước fail giữa chừng) → mở lại 1 bài bất kỳ.
  let examHeading = page.getByText(/^bài kiểm tra kiến thức$/i).first();
  if (!(await examHeading.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false))) {
    await openV6AnyLessonAndPlayVideo(page);
    await dismissPopups(page);
    examHeading = page.getByText(/^bài kiểm tra kiến thức$/i).first();
  }
  await examHeading.scrollIntoViewIfNeeded().catch(() => {});
  const examHeadingBox = await examHeading.boundingBox().catch(() => null);
  const candidates = page.getByRole('button', { name: /^kiểm tra kiến thức$|^làm lại$/i });
  const candidateCount = await candidates.count().catch(() => 0);
  let actionBtn = candidates.first();
  if (examHeadingBox) {
    for (let i = 0; i < candidateCount; i += 1) {
      const box = await candidates.nth(i).boundingBox().catch(() => null);
      if (box && box.y >= examHeadingBox.y - 5) {
        actionBtn = candidates.nth(i);
        break;
      }
    }
  }
  const clicked = await actionBtn.click({ timeout: 8000 }).then(() => true).catch(async () => {
    return page
      .getByRole('button', { name: /kiểm tra kiến thức/i })
      .first()
      .click()
      .then(() => true)
      .catch(() => false);
  });
  if (!clicked) return { visible: false, submitted: false };
  await page.waitForTimeout(2000);
  await dismissPopups(page);

  const visible = await isQuestionVisible(page);
  if (!visible) return { visible: false, submitted: false };

  await clickFirstAnswer(page);
  const submitted = await confirmSubmitAndCheckToast(page);
  return { visible, submitted };
}

/**
 * HC-V6-05 · Luyện Toán: menu "Luyện Toán" -> 1 kỳ luyện bất kỳ -> bảng "Vòng luyện" -> button
 * "Luyện ngay"/"Luyện lại" của vòng "Đang diễn ra". Kiểm tra đề luyện hiển thị + nộp thành công.
 */
export async function openV6PracticeAndSubmit(page: Page): Promise<{ visible: boolean; submitted: boolean }> {
  // Đi thẳng vào 1 kỳ luyện ĐÃ BIẾT có vòng đang diễn ra (PRACTICE_ID trong .env) thay vì bấm "1
  // kỳ bất kỳ" trên danh sách — quan sát thực tế: kỳ đầu tiên trong danh sách ("Ôn luyện Tốt
  // nghiệp THPT (miễn phí)") có thể KHÔNG có vòng nào ("Không có dữ liệu hiển thị"), làm rớt case
  // dù chức năng không hề lỗi.
  await page.goto(practiceListUrl(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await dismissPopups(page);
  await ensureLoggedIn(page);

  // Nút "Luyện ngay"/"Luyện lại" trong bảng thực chất là <a> (role=link), không phải <button>.
  const row = page.locator('tr, .round-row').filter({ hasText: /đang diễn ra/i }).first();
  const roundBtn = (await row.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false))
    ? row.getByRole('link', { name: /luyện ngay|luyện lại/i }).first()
    : page.getByRole('link', { name: /luyện ngay|luyện lại/i }).first();
  await roundBtn.click();
  await page.waitForTimeout(2000);
  await dismissPopups(page);

  const visible = await isQuestionVisible(page);
  if (!visible) return { visible: false, submitted: false };

  await clickFirstAnswer(page);
  const submitted = await confirmSubmitAndCheckToast(page);
  return { visible, submitted };
}
