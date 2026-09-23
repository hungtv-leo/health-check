import type { Locator, Page, TestInfo } from '@playwright/test';
import { dismissPopups } from './auth';

export type Verdict = 'PASS' | 'WARNING' | 'FAIL';

/**
 * Ghi 1 dòng "KẾT QUẢ TRẢ VỀ" đúng format của
 * docs/kịch bản kiểm tra hệ thống Trạng Nguyên_1.xlsx (sheet "Webuser các V - Test case"),
 * vd: `PASS | t_login = 2.1s | trang chủ V5 đã login | user = Bùi Thị Thư | SBD = 739231826`.
 * In ra console + đính kèm report (`discord-reporter.ts` đọc attachment 'result' để đẩy
 * đúng dòng này lên Discord cho từng case). FAIL sẽ throw để Playwright đánh dấu test thất bại.
 */
export async function attachResult(
  testInfo: TestInfo,
  verdict: Verdict,
  fields: Record<string, string | number>,
): Promise<void> {
  const parts = Object.entries(fields).map(([k, v]) => `${k} = ${v}`);
  const line = [verdict, ...parts].join(' | ');
  console.log(line);

  await testInfo.attach('result', { body: line, contentType: 'text/plain' });
  if (verdict === 'WARNING') {
    await testInfo.attach('timing-warning', { body: line, contentType: 'text/plain' });
  }
  if (verdict === 'FAIL') {
    throw new Error(line);
  }
}

/**
 * Đọc họ tên + SBD trên header (khối avatar chứa text "SBD:"). Trả về rỗng nếu không đọc được
 * — case gọi hàm này tự quyết định PASS/FAIL theo tiêu chí của nó (không throw ở đây).
 */
export async function readHeaderUserInfo(page: Page): Promise<{ tenUser: string; sbd: string }> {
  await dismissPopups(page);
  const sbdNode = page.getByText(/SBD:/i).first();
  const visible = await sbdNode.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) return { tenUser: '', sbd: '' };

  const container = sbdNode.locator('xpath=ancestor::*[self::div or self::li or self::a][1]');
  const raw = (await container.innerText().catch(() => '')) || (await sbdNode.innerText().catch(() => ''));

  const sbdMatch = raw.match(/SBD:\s*([\d]+)/i);
  const sbd = sbdMatch?.[1] || '';

  const nameLine = raw
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !/SBD:/i.test(l));

  return { tenUser: nameLine || '', sbd };
}

/**
 * `Locator.isVisible()` KHÔNG chờ (chỉ kiểm tra tức thời) dù có truyền `timeout` — dùng hàm này
 * bất cứ khi nào ý định thực sự là "đợi tối đa N ms để phần tử xuất hiện" (khác với việc kiểm
 * tra ngay lập tức 1 phần tử có thể đã có sẵn hay không).
 */
export async function waitVisible(locator: Locator, timeout = 5000): Promise<boolean> {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

/**
 * Đọc HTTP status của trang đang đứng (GET lại đúng URL hiện tại qua APIRequestContext, dùng
 * chung cookie phiên với `page` — không điều hướng lại DOM). Dùng sau khi `page.waitForURL(...)`
 * đã chờ điều hướng ổn định, để tránh đọc nhầm status của 1 hop trung gian trong chuỗi redirect
 * (vd SSO qua id.trangnguyen.edu.vn).
 */
export async function probeCurrentPageStatus(page: Page): Promise<number> {
  const resp = await page.request.get(page.url()).catch(() => null);
  if (resp) return resp.status();
  // Một số host (CDN/WAF) từ chối APIRequestContext → fallback: DOM đã load coi như 200.
  const ready = await page.evaluate(() => document.readyState).catch(() => '');
  return ready === 'complete' || ready === 'interactive' ? 200 : 0;
}
