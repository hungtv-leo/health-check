import { expect, type Locator, type Page } from '@playwright/test';
import { env } from '../config';
import { dismissPopups, ensureLoggedIn } from './auth';

/** Trình phát video bài giảng có thể nằm ở top-level HOẶC trong 1 iframe riêng — dò cả 2. */
export async function locateVideo(page: Page): Promise<Locator> {
  const top = page.locator('video').first();
  if ((await top.count().catch(() => 0)) > 0) return top;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const inFrame = frame.locator('video').first();
    if ((await inFrame.count().catch(() => 0)) > 0) return inFrame;
  }
  return top;
}

/**
 * Đề thi/luyện/bài tập trên V5 & V6 dùng UI trắc nghiệm tuỳ biến (không phải input/label chuẩn):
 * "Câu hỏi N"/"Câu N:" + lựa chọn dạng "A." "B." "C." "D." (trắc nghiệm) — nhưng bài tập V6 có
 * dạng khác (điền số vào chỗ trống, không có A/B/C/D) — nên fallback thêm theo nút "Nộp bài"
 * (dấu hiệu chung: đang ở màn làm bài thật, bất kể định dạng câu hỏi).
 */
export async function isQuestionVisible(page: Page): Promise<boolean> {
  const byLabel = page.getByText(/^Câu (hỏi )?\d+/i).first();
  if (await byLabel.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)) return true;
  const byOption = page.getByText(/^A\.$/).first();
  if (await byOption.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)) return true;
  const submitBtn = page.getByRole('button', { name: /^nộp bài$/i }).first();
  return submitBtn.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
}

/** Chọn 1 đáp án bất kỳ của câu hỏi đầu tiên (ưu tiên UI "A." tuỳ biến, fallback input/label chuẩn). */
export async function clickFirstAnswer(page: Page): Promise<void> {
  const optionA = page.getByText(/^A\.$/).first();
  if (await optionA.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)) {
    await optionA.click({ force: true }).catch(() => {});
    return;
  }
  const radio = page.locator('input[type="radio"], input[type="checkbox"]').first();
  if (await radio.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await radio.click({ force: true }).catch(() => {});
    return;
  }
  const label = page.locator('label').first();
  if (await label.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await label.click({ force: true }).catch(() => {});
  }
}

/**
 * Sau khi bấm "Nộp bài" lần 1, kiểm tra có thông báo nộp bài thành công không. Thực tế quan sát:
 * hộp thoại xác nhận thứ 2 hiện ra là "Thông báo: Hiện còn N câu chưa hoàn thành..." với nút xác
 * nhận CŨNG tên "Nộp bài" (không phải "Tôi đồng ý"/"Đồng ý" như đề thi) — dùng `.last()` để nhắm
 * đúng nút trong hộp thoại (nút "Nộp bài" gốc đã bị hộp thoại che/thay thế).
 */
export async function confirmSubmitAndCheckToast(page: Page): Promise<boolean> {
  const submit = page.getByRole('button', { name: /^Nộp bài$/i }).first();
  if (!(await submit.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false))) {
    return false;
  }
  await submit.click();
  await page.waitForTimeout(800);

  const confirm = page.getByRole('button', { name: /^Tôi đồng ý$|^Đồng ý$|^Nộp bài$/i }).last();
  if (await confirm.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await confirm.click({ force: true }).catch(() => {});
  }

  const toast = page
    .getByText(/nộp bài thành công|đã nộp bài|hoàn thành bài|nộp bài hoàn tất|kết quả|điểm số|chúc mừng/i)
    .first();
  if (await toast.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)) return true;

  return !(await isQuestionVisible(page));
}

/**
 * HC-V5-02 · Thi hay: click "Thi hay" -> sang thi.trangnguyen.edu.vn -> chọn sân chơi/chặng
 * cố định từ env (sheet: VNMF→Khởi động, fallback TNT→Vòng 1) -> "Đồng ý" -> "Vào chế độ toàn
 * màn hình" (nếu có). Trả về true nếu đề thi hiển thị.
 */
export async function openV5ExamAndCheckVisible(page: Page): Promise<{ visible: boolean; roundLabel: string }> {
  await page.goto(env.v5BaseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await ensureLoggedIn(page, env.v5BaseUrl);
  await dismissPopups(page);

  const thiHay = page
    .getByRole('link', { name: /^Thi hay$/i })
    .or(page.getByRole('button', { name: /^Thi hay$/i }))
    .first();
  await thiHay.click({ timeout: 10000 }).catch(async () => {
    await dismissPopups(page);
    await thiHay.click({ force: true });
  });
  await page.waitForURL(/thi\.trangnguyen\.edu\.vn|id\.trangnguyen\.edu\.vn/i, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await dismissPopups(page);
  // Domain thi.* đôi khi đá về Keycloak nếu phiên rớt — login lại rồi quay lại Thi hay.
  if (/id\.trangnguyen\.edu\.vn/i.test(page.url()) || (await page.locator('input[name="username"]').isVisible().catch(() => false))) {
    await ensureLoggedIn(page, env.v5BaseUrl);
    await page
      .getByRole('link', { name: /^Thi hay$/i })
      .or(page.getByRole('button', { name: /^Thi hay$/i }))
      .first()
      .click({ force: true });
    await page.waitForURL(/thi\.trangnguyen\.edu\.vn/i, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await dismissPopups(page);
  }

  async function pickRound(playground: string, round: string): Promise<boolean> {
    const pg = page.getByText(playground, { exact: false }).first();
    if (!(await pg.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false))) return false;
    await pg.click();
    await page.waitForTimeout(800);
    const roundLoc = page.getByText(new RegExp(round.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first();
    if (!(await roundLoc.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false))) return false;
    await roundLoc.click();
    return true;
  }

  let roundLabel = '';
  if (await pickRound(env.v5ExamPlayground, env.v5ExamRound)) {
    roundLabel = `${env.v5ExamPlayground} · ${env.v5ExamRound}`;
  } else if (await pickRound(env.v5ExamFallbackPlayground, env.v5ExamFallbackRound)) {
    roundLabel = `${env.v5ExamFallbackPlayground} · ${env.v5ExamFallbackRound}`;
  } else {
    return { visible: false, roundLabel: 'N/A' };
  }

  await page.waitForTimeout(1000);
  const agree = page.getByRole('button', { name: /tôi đồng ý|^đồng ý$/i }).first();
  if (await agree.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await agree.click();
    await page.waitForTimeout(1000);
  }

  const fullscreen = page.getByRole('button', { name: /vào chế độ toàn màn hình/i }).first();
  if (await fullscreen.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await fullscreen.click();
  }

  await page.waitForTimeout(1000);
  const visible = await isQuestionVisible(page);
  return { visible, roundLabel };
}

/**
 * HC-V5-03 · Luyện thích: click "Luyện thích" -> 1 gói ôn luyện bất kỳ -> 1 vòng ôn luyện bất kỳ
 * -> Đồng ý (nếu có). Trả về true nếu đề luyện hiển thị.
 */
export async function openV5PracticeAndCheckVisible(page: Page): Promise<boolean> {
  // Case trước (HC-V5-02) có thể kết thúc ở chế độ toàn màn hình của bài thi (domain khác,
  // thi.trangnguyen.edu.vn) -> phải quay lại trang chủ V5 mới thấy mục "Luyện thích".
  await page.goto(env.v5BaseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await ensureLoggedIn(page, env.v5BaseUrl);
  await dismissPopups(page);
  await page
    .getByRole('link', { name: /^Luyện thích$/i })
    .or(page.getByRole('button', { name: /^Luyện thích$/i }))
    .first()
    .click({ force: true });
  await page.waitForTimeout(2000);
  await dismissPopups(page);

  // Click 1 "gói ôn luyện" bất kỳ trong khối nội dung chính — CHỈ trong <main> để không lỡ tay
  // bấm nhầm vào menu/header (vd link "Khen thưởng") nếu selector gói không khớp.
  const packageCard = page.locator('main').getByRole('button').first();
  if (await packageCard.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await packageCard.click().catch(() => {});
    await page.waitForTimeout(1500);
    await dismissPopups(page);
  }

  // Nhóm vòng ôn luyện hiển thị dạng nút "Ôn luyện vòng…"/"Ôn luyện thi…"/"Ôn luyện theo…" (chọn
  // xong chỉ active/highlight, KHÔNG điều hướng). Chọn xong hiện 1 bảng các vòng cụ thể (mỗi row
  // là 1 "Ôn luyện vòng N - …", click thẳng vào row mới thực sự vào làm bài).
  const roundGroupBtn = page
    .getByRole('button', { name: /^ôn luyện|luyện ngay|luyện lại|vào luyện/i })
    .first();
  if (await roundGroupBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await roundGroupBtn.click();
    await page.waitForTimeout(1000);
  }

  const roundRow = page.getByRole('row').filter({ hasText: /ôn luyện vòng/i }).first();
  if (await roundRow.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)) {
    await roundRow.click();
    await page.waitForTimeout(1500);
  }

  const agree = page.getByRole('button', { name: /tôi đồng ý|^đồng ý$/i }).first();
  if (await agree.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)) {
    await agree.click();
    await page.waitForTimeout(1000);
  }

  const fullscreen = page.getByRole('button', { name: /vào chế độ toàn màn hình/i }).first();
  if (await fullscreen.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)) {
    await fullscreen.click();
  }

  await page.waitForTimeout(1000);
  return isQuestionVisible(page);
}

/** Mở Học giỏi và vào lộ trình có ô lục giác (chuyên đề "Học chữ", không phải danh sách Tuần). */
async function openV5HocGioiMap(page: Page): Promise<string> {
  await page.goto(env.v5BaseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await ensureLoggedIn(page, env.v5BaseUrl);
  await dismissPopups(page);
  await page
    .getByRole('link', { name: /^Học giỏi$/i })
    .or(page.getByRole('button', { name: /^Học giỏi$/i }))
    .first()
    .click({ force: true });
  await page.waitForTimeout(1500);
  await dismissPopups(page);

  const course = page.locator('a[href*="/lessons-course/"]').filter({ hasNotText: /tuần học/i }).first();
  let lessonTitle = '';
  if (await course.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    lessonTitle = ((await course.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    await course.click();
    await page.waitForTimeout(1500);
  }
  await page.getByText(/^Học chữ$/).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  return lessonTitle;
}

/** Nhãn trong bong bóng bài (vd "Học chữ: ch - gi - ng"), không phải banner section. */
function lessonBubbleLabel(page: Page) {
  return page.getByText(/Học chữ:|ch\s*-\s*gi\s*-\s*ng/i).last();
}

/** Hai icon tròn trong bong bóng: [0] sách = video, [1] bút = bài luyện tập. */
function lessonBubbleButtons(page: Page) {
  return lessonBubbleLabel(page).locator('xpath=ancestor::*[.//button][1]').locator('button');
}

/**
 * Bấm ô lục giác vàng ngay sau 2 ô đã học của mục "Học chữ"
 * (menu header = button 1, 2 ô tick = button 2–3, ô vàng = button 4).
 */
async function openV5LessonBubble(page: Page): Promise<boolean> {
  const hocChu = page.getByText(/^Học chữ$/).first();
  await hocChu.scrollIntoViewIfNeeded().catch(() => {});
  for (const index of [4, 5, 3]) {
    const node = hocChu.locator(`xpath=following::button[${index}]`);
    if ((await node.count().catch(() => 0)) === 0) continue;
    await node.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    if (await lessonBubbleLabel(page).waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false)) {
      return true;
    }
  }
  return false;
}

/** HC-V5-04 · Học giỏi: ô lục giác → icon sách (video) → play, chờ currentTime > 0. */
export async function openV5AnyLessonAndPlayVideo(page: Page): Promise<{ currentTime: number; lessonTitle: string }> {
  const courseTitle = await openV5HocGioiMap(page);
  const opened = await openV5LessonBubble(page);
  const bubbleText = lessonBubbleLabel(page);
  const lessonTitle =
    ((await bubbleText.innerText().catch(() => '')) || courseTitle || 'N/A').replace(/\s+/g, ' ').trim();
  if (!opened) return { currentTime: 0, lessonTitle };

  // Icon trái trong bong bóng = sách / video.
  await lessonBubbleButtons(page).first().click({ force: true }).catch(() => {});

  const video = await waitForLessonVideo(page);
  if (!video) return { currentTime: 0, lessonTitle };

  const playBtn = page.getByRole('button', { name: /play|phát/i }).first();
  if (await playBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await playBtn.click().catch(() => {});
  }
  await video.evaluate((el: HTMLVideoElement) => {
    el.muted = true;
    const tryPlay = () => {
      void el.play().catch(() => {});
    };
    el.addEventListener('loadeddata', tryPlay);
    tryPlay();
  });

  // Máy GitHub tải video từ VN chậm hơn máy local: chờ currentTime nhích, không chốt sau 3s.
  const deadline = Date.now() + 20_000;
  let currentTime = 0;
  while (Date.now() < deadline) {
    currentTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime).catch(() => 0);
    if (currentTime > 0) break;
    await page.waitForTimeout(500);
  }
  return { currentTime, lessonTitle };
}

async function waitForLessonVideo(page: Page): Promise<Locator | null> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const video = await locateVideo(page);
    if ((await video.count().catch(() => 0)) > 0) return video;
    await page.waitForTimeout(500);
  }
  return null;
}

/**
 * HC-V5-05 · Học giỏi bài tập: Học giỏi → ô lục giác → icon bút → dòng "Bài luyện tập".
 * Chỉ kiểm tra đề có hiển thị (không nộp).
 */
export async function openV5ExerciseAfterLessonAndCheckVisible(page: Page): Promise<boolean> {
  await openV5HocGioiMap(page);
  const opened = await openV5LessonBubble(page);
  if (!opened) return false;

  const icons = lessonBubbleButtons(page);
  const pencil = (await icons.count().catch(() => 0)) > 1 ? icons.nth(1) : icons.last();
  await pencil.click({ force: true });
  await page.waitForTimeout(800);

  const row = page.getByText(/^Bài luyện tập$/).last();
  if (!(await row.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false))) return false;
  await row.click({ force: true });
  await page.waitForTimeout(2000);
  // UI bài luyện V5: câu hỏi + đáp án A/B/C/D, "Nộp bài" là ảnh (không phải button).
  const exerciseShown = await page
    .getByText(/đáp án nào/i)
    .first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (exerciseShown) return true;
  return isQuestionVisible(page);
}
