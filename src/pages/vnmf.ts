import { type Page } from '@playwright/test';
import { env } from '../config';
import { dismissPopups } from './auth';
import { probeCurrentPageStatus } from './result';

const MENU_ITEMS = ['Giới thiệu', 'Thể lệ và lịch trình', 'Vinh danh', 'Tin tức', 'Liên hệ'];

/** HC-VNMF-01 · Trang chủ: mở vnmf.edu.vn, kiểm tra HTTP status + đủ 5 mục menu + nút Vào thi/Đăng nhập. */
export async function openVnmfHomeAndInspect(page: Page): Promise<{
  status: number;
  menuFound: number;
  hasEnterExam: boolean;
  hasLogin: boolean;
}> {
  const response = await page.goto(env.vnmfBaseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await dismissPopups(page);

  let menuFound = 0;
  for (const label of MENU_ITEMS) {
    const visible = await page
      .getByRole('link', { name: new RegExp(label, 'i') })
      .first()
      .waitFor({ state: 'visible', timeout: 2000 }).then(() => true)
      .catch(() => false);
    if (visible) menuFound += 1;
  }

  const hasEnterExam = await page
    .getByRole('link', { name: /vào thi/i })
    .or(page.getByRole('button', { name: /vào thi/i }))
    .first()
    .waitFor({ state: 'visible', timeout: 3000 }).then(() => true)
    .catch(() => false);
  const hasLogin = await page
    .getByRole('button', { name: /^Đăng nhập$/i })
    .or(page.getByRole('link', { name: /^Đăng nhập$/i }))
    .first()
    .waitFor({ state: 'visible', timeout: 3000 }).then(() => true)
    .catch(() => false);

  return { status: response?.status() ?? 0, menuFound, hasEnterExam, hasLogin };
}

/** HC-VNMF-02 · Tin tức: click "Tin tức", đếm số bài viết, mở 1 bài kiểm tra nội dung không rỗng. */
export async function openVnmfNewsAndInspect(page: Page): Promise<{
  status: number;
  articleCount: number;
  articleContentNotEmpty: boolean;
}> {
  await page.getByRole('link', { name: /^Tin tức$/i }).first().click();
  await page.waitForURL(/tin-tuc/i, { timeout: 20000 });
  await page.waitForTimeout(2000);
  await dismissPopups(page);
  const status = await probeCurrentPageStatus(page);

  // Trang /tin-tuc/ của VNMF hiển thị THẲNG bài viết mới nhất (không phải dạng danh sách card),
  // nên thử đếm theo card trước, fallback: có nội dung bài viết hiển thị trực tiếp -> tính là 1.
  const cardArticles = page.locator('article, .news-item, .post-item');
  let articleCount = await cardArticles.count();

  const readMore = page.getByRole('link', { name: /đọc tiếp/i }).first();
  if (await readMore.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await readMore.click();
    await page.waitForTimeout(2000);
  }

  const content = page.locator('main').first();
  const text = (await content.innerText().catch(() => '')).trim();
  const articleContentNotEmpty = text.length > 200;
  if (articleCount === 0 && articleContentNotEmpty) articleCount = 1;

  return { status, articleCount, articleContentNotEmpty };
}
