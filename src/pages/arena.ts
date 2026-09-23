import { type Page } from '@playwright/test';
import { env } from '../config';
import { dismissPopups, ensureLoggedIn } from './auth';
import { isQuestionVisible } from './v5-learning';

/**
 * HC-V6-06 · Đấu trường:
 * Đấu trường → Bắt đầu → Đấu với bot → chọn 1 nhân vật → Vào Đấu.
 * PASS khi màn "Chọn câu hỏi" / đề thi đấu hiển thị.
 */
export async function playArenaVsBotAndCheckQuestion(page: Page): Promise<boolean> {
  await page.goto(env.baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissPopups(page);
  await ensureLoggedIn(page);
  await dismissPopups(page);

  await page
    .getByRole('link', { name: /^Đấu trường$/i })
    .or(page.getByRole('button', { name: /^Đấu trường$/i }))
    .first()
    .click();
  await page.waitForTimeout(2000);
  await dismissPopups(page);

  const sessionClash = page.getByText(/đăng nhập ở một thiết bị|vui lòng đăng nhập lại/i).first();
  if (await sessionClash.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)) {
    await dismissPopups(page);
    await ensureLoggedIn(page);
    await page
      .getByRole('link', { name: /^Đấu trường$/i })
      .or(page.getByRole('button', { name: /^Đấu trường$/i }))
      .first()
      .click();
    await page.waitForTimeout(2000);
    await dismissPopups(page);
  }

  await page.getByRole('button', { name: /^Bắt đầu$/i }).first().click();
  await page.waitForTimeout(1500);

  const vsBot = page.getByRole('button', { name: /^Đấu với bot$/i }).first();
  await vsBot.waitFor({ state: 'visible', timeout: 10000 });
  await vsBot.click();
  await page.getByText(/Danh sách đối thủ/i).first().waitFor({ state: 'visible', timeout: 15000 });

  const enter = page.getByRole('button', { name: /^Vào Đấu$/i });
  const names = ['+20 Pi', '+50 Trạng Toán', '+100 Pythagoras', '+20 My'];
  for (const name of names) {
    const card = page.getByRole('button', { name });
    if (!(await card.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false))) continue;
    const box = await card.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await card.click();
    }
    await page.waitForTimeout(500);
    if (await enter.isEnabled().catch(() => false)) break;
  }

  if (!(await enter.isEnabled().catch(() => false))) return false;
  await enter.click();

  await page
    .getByText(/Chọn câu hỏi|Đề thi đấu|Điền số thích hợp/i)
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => {});

  if (await page.getByText(/Chọn câu hỏi|Đề thi đấu/i).first().isVisible().catch(() => false)) return true;
  return isQuestionVisible(page);
}
