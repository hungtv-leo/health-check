import { expect, type Page } from '@playwright/test';
import { env } from '../config';
import { dismissPopups, ensureLoggedIn, loginAsStudent } from './auth';
import { probeCurrentPageStatus } from './result';

/**
 * Đúng host đích. Không dùng regex chuỗi con: `trangnguyen.edu.vn` cũng khớp
 * `id.trangnguyen.edu.vn` (trang đăng nhập Keycloak), nên waitForURL dừng sớm.
 */
function urlOnHost(baseUrl: string): (url: URL) => boolean {
  const expected = new URL(baseUrl).host;
  return (url: URL) => {
    if (url.host === 'id.trangnguyen.edu.vn') return false;
    return url.host === expected || url.host.endsWith(`.${expected}`);
  };
}

export type SwitchResult = { host: string; path: string; status: number };

function toSwitchResult(page: Page, status: number): SwitchResult {
  const u = new URL(page.url());
  return { host: u.host, path: u.pathname, status };
}

/** V5 -> V6 (HC-V5-06): click banner/link "VNMF" trên header V5 -> điều hướng thẳng sang V6. */
export async function switchV5ToV6(page: Page): Promise<SwitchResult> {
  await page.goto(env.v5BaseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await dismissPopups(page);
  await page.getByRole('link', { name: /^VNMF$/i }).first().click();
  await page.waitForURL(urlOnHost(env.baseUrl), { timeout: 20000 });
  await page.waitForTimeout(1000);
  return toSwitchResult(page, await probeCurrentPageStatus(page));
}

/**
 * Sau HC-V5-07 (logout V5) phiên SSO bị huỷ — khôi phục đúng tiền điều kiện của HC-V6-01
 * (đã đăng nhập V5, vừa đứng trên V6 chưa bấm "Đăng nhập"). Không phải case sheet.
 */
export async function restoreV5SessionThenOpenV6(page: Page): Promise<void> {
  await loginAsStudent(page, undefined, env.v5BaseUrl);
  await switchV5ToV6(page);
}

/** V6 -> VNMF (HC-V6-08): click link "VNMF" trên header/footer V6 -> điều hướng sang vnmf.edu.vn. */
export async function switchV6ToVnmf(page: Page): Promise<SwitchResult> {
  await page.goto(env.baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await dismissPopups(page);
  await page.getByRole('link', { name: /^VNMF$/i }).first().click();
  await page.waitForURL(urlOnHost(env.vnmfBaseUrl), { timeout: 20000 });
  await page.waitForTimeout(1000);
  return toSwitchResult(page, await probeCurrentPageStatus(page));
}

/**
 * Điền form login Keycloak nếu nó thực sự xuất hiện. SSO dùng chung realm (id.trangnguyen.edu.vn)
 * nên nếu trình duyệt còn phiên hợp lệ, Keycloak có thể tự redirect thẳng mà KHÔNG hiện form
 * (silent SSO) — hành vi thật quan sát được trên prod, không phải lỗi. Trả về true nếu đã phải
 * điền form (login "nguội"), false nếu SSO tự động (không cần điền).
 */
async function fillKeycloakFormIfShown(page: Page, timeout = 15000): Promise<boolean> {
  const userField = page.locator('input[name="username"]');
  const shown = await userField
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
  if (!shown) return false;

  await userField.fill(env.studentUser);
  await page.locator('input[type="password"]').fill(env.studentPass);
  await page.getByRole('button', { name: /^đăng nhập$/i }).last().click();
  return true;
}

/**
 * VNMF -> V6 (HC-VNMF-03): click nút "Đăng nhập" trên VNMF -> chuyển qua SSO
 * (id.trangnguyen.edu.vn, cùng realm với V6/V5) -> sau khi login redirect thẳng về V6 và hiện SBD.
 */
export async function switchVnmfToV6ViaLogin(page: Page): Promise<SwitchResult> {
  await page.goto(env.vnmfBaseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await dismissPopups(page);
  await page.getByRole('button', { name: /^Đăng nhập$/i }).first().click();
  await fillKeycloakFormIfShown(page);
  await page.waitForURL(urlOnHost(env.baseUrl), { timeout: 20000 });
  await expect(page.getByText(/SBD:/i).first()).toBeVisible({ timeout: 15000 });
  return toSwitchResult(page, await probeCurrentPageStatus(page));
}

/**
 * V6 -> V5 (HC-V6-07): menu "Thi Toán" -> 1 tab kỳ thi (vd "Thi VNMF (Lớp 1 - 2 - 3)") -> bảng
 * chặng thi -> "Thi ngay" của chặng "Đang diễn ra". Hành vi thật trên prod (theo video ghi lại
 * thao tác): đích cuối là thi.trangnguyen.edu.vn/vao-thi-trang-nguyen-2023/ (màn "Thi hay" của
 * V5), session được GIỮ NGUYÊN — không có bounce logout/login SSO.
 */
export async function switchV6ToV5ViaThiNgay(page: Page): Promise<SwitchResult & { sessionKept: boolean }> {
  await page.goto(`${env.baseUrl}/thi-toan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await dismissPopups(page);
  await ensureLoggedIn(page);

  const tab = page.getByRole('tab', { name: /thi vnmf/i }).or(page.getByText(/thi vnmf/i)).first();
  if (await tab.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(1500);
  }

  const activeRow = page.locator('tr, .round-row').filter({ hasText: /đang diễn ra/i }).first();
  await activeRow.scrollIntoViewIfNeeded().catch(() => {});
  const examNowBtn = (await activeRow.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false))
    ? activeRow.getByRole('link', { name: /^Thi ngay$/i }).first()
    : page.getByRole('link', { name: /^Thi ngay$/i }).first();

  await examNowBtn.click();
  // Keycloak có thể hiện vài giây rồi tự chuyển tiếp nếu phiên còn. Không điền form:
  // sheet coi phải đăng nhập lại là mất phiên.
  await page.waitForURL(urlOnHost(env.v5BaseUrl), { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const sessionKept = await page.getByText(/SBD:/i).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  return { ...toSwitchResult(page, await probeCurrentPageStatus(page)), sessionKept };
}
