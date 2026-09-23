import { expect, type Page, type TestInfo } from '@playwright/test';
import { env } from '../config';
import { classifyTiming, formatMs } from '../timing';

export async function dismissPopups(page: Page): Promise<void> {
  // 1) Nút text thường gặp (modal thông báo / cookie / onboarding).
  for (const label of ['Đóng', 'Close', 'Bỏ qua', 'Để sau', 'Đã hiểu', 'OK', 'Không, cảm ơn']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
    if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
      await btn.click({ timeout: 1000 }).catch(() => {});
    }
  }

  // 2) Popup khuyến mãi dạng ảnh (vd Trung thu) — chỉ có nút X, không có label "Đóng".
  const closeCandidates = [
    page.locator('button[aria-label*="close" i], button[aria-label*="đóng" i]').first(),
    page.locator('[class*="modal"] button[class*="close" i], [class*="popup"] button[class*="close" i]').first(),
    page.locator('.ant-modal-close, .el-dialog__close, [class*="ModalClose"]').first(),
    page.locator('div[role="dialog"] button').filter({ hasText: /^[×x✕]$/ }).first(),
    page.locator('button').filter({ hasText: /^[×x✕]$/ }).first(),
    page.locator('[class*="popup"] img, [class*="modal"] img').locator('xpath=ancestor::*[contains(@class,"popup") or contains(@class,"modal")][1]//button').first(),
  ];
  for (const closeBtn of closeCandidates) {
    if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await closeBtn.click({ timeout: 1000, force: true }).catch(() => {});
    }
  }

  // Click mọi phần tử chỉ chứa ký tự × (thường là nút X trắng trên banner khuyến mãi).
  const xMarks = page.locator('span, button, a, div').filter({ hasText: /^[×✕]$/ });
  const xCount = Math.min(await xMarks.count().catch(() => 0), 5);
  for (let i = 0; i < xCount; i += 1) {
    const el = xMarks.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ force: true, timeout: 500 }).catch(() => {});
    }
  }

  // 3) Escape để đóng overlay còn sót.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
}

export async function assertLoggedIn(page: Page, baseUrl: string = env.baseUrl): Promise<void> {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await dismissPopups(page);
  await expect(page.getByText(/SBD:/i).first()).toBeVisible({ timeout: 15000 });
  await dismissPopups(page);
}

/**
 * Quan sát thực tế trên prod (luồng liên tục tests/10-13): sau khi HC-V6-01 login V6 thành công
 * (SBD hiện rõ), phiên V6 đôi khi "rớt" ngay ở case kế tiếp (header quay lại 'Đăng nhập'/'Đăng
 * ký') dù chưa hề gọi logout — nghi vấn liên quan ràng buộc "1 phiên/tài khoản" (AGENTS.md) khi
 * login V6 bằng form thay vì SSO im lặng. Gọi hàm này ở đầu mỗi case cần đăng nhập để tự đăng
 * nhập lại nếu phát hiện đã rớt phiên, tránh báo sai "không hiển thị" (thực chất là do mất phiên,
 * không phải do chức năng đó lỗi). KHÔNG dùng cho case tự nó đang test hành vi login/logout.
 */
export async function ensureLoggedIn(page: Page, baseUrl: string = env.baseUrl): Promise<boolean> {
  const loggedIn = await page.getByText(/SBD:/i).first().isVisible().catch(() => false);
  if (loggedIn) return false;
  // loginAsStudent() tự goto(baseUrl) (trang chủ) để login — quay lại đúng URL đang đứng trước
  // đó, nếu không case gọi hàm này sẽ "lạc" sang trang chủ thay vì trang nó thực sự cần.
  const returnTo = page.url();
  await loginAsStudent(page, undefined, baseUrl);
  if (returnTo && returnTo !== page.url() && !returnTo.startsWith('about:')) {
    await page.goto(returnTo, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await dismissPopups(page);
  }
  return true;
}

export async function openLoginModal(page: Page, baseUrl: string = env.baseUrl): Promise<void> {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissPopups(page);

  await loginTrigger(page).click();
  await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 15000 });
}

export async function loginAsStudent(
  page: Page,
  testInfo?: TestInfo,
  baseUrl: string = env.baseUrl,
): Promise<number> {
  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await dismissPopups(page);

      await loginTrigger(page).click();

      // SSO dùng chung realm (id.trangnguyen.edu.vn): nếu context đã có phiên hợp lệ
      // (VD auth.setup vừa login V6 trước đó), Keycloak có thể tự redirect thẳng mà
      // KHÔNG hiện form username/password — không phải lỗi, chỉ là đăng nhập "nguội" vs "nóng".
      const userField = page.locator('input[name="username"]');
      const formShown = await userField
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true)
        .catch(() => false);

      const sbd = page.getByText(/SBD:/i).first();
      let started = Date.now();

      if (formShown) {
        await userField.fill(env.studentUser);
        await page.locator('input[type="password"]').fill(env.studentPass);

        // V6 mới có POST /user-service/public/login. V5 không gọi API này — không được
        // await hết timeout (5s) bên trong t_login, nếu không đồng hồ luôn ~5s dù site nhanh.
        const loginResponsePromise = page
          .waitForResponse(
            (res) =>
              res.url().includes('/user-service/public/login') &&
              res.request().method() === 'POST',
            { timeout: 8000 },
          )
          .catch(() => null);

        // Sheet: bấm "Đăng nhập" trên form rồi mới đếm, dừng khi header hiện SBD.
        started = Date.now();
        await page.getByRole('button', { name: /^đăng nhập$/i }).last().click();
        await sbd.waitFor({ state: 'visible', timeout: 30000 });
        const elapsed = Date.now() - started;

        const loginRes = await Promise.race([
          loginResponsePromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
        ]);
        if (loginRes && loginRes.status() >= 400) {
          throw new Error(`Login API status ${loginRes.status()}`);
        }

        await dismissPopups(page);
        await attachTiming(testInfo, 'Login', elapsed);
        return elapsed;
      }

      await sbd.waitFor({ state: 'visible', timeout: 30000 });
      const elapsed = Date.now() - started;
      await dismissPopups(page);
      await attachTiming(testInfo, 'Login', elapsed);
      return elapsed;
    } catch (err) {
      lastError = err;
      console.warn(`Login attempt ${attempt}/${maxAttempts} failed:`, err);
      await page.context().clearCookies().catch(() => {});
      await page.evaluate(() => localStorage.clear()).catch(() => {});
      await page.goto('about:blank').catch(() => {});
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Mở dropdown menu profile. Trên V6, khối "SBD:" là 1 button gộp nên click thẳng vào text
 * là đủ. Trên V5, khối tên/SBD chỉ là <div> tĩnh — nút mở dropdown thật là 1 button
 * `aria-haspopup="true"` tách riêng (chevron) — fallback sang nút đó nếu click text không
 * mở được dropdown.
 */
async function openProfileMenu(page: Page): Promise<void> {
  await page.getByText(/SBD:/i).first().click({ timeout: 3000 }).catch(() => {});
  const opened = await page
    .getByText(/đăng xuất/i)
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);
  if (opened) return;

  // Trang có nhiều bản aria-haspopup ẩn (duplicate cho responsive/mobile) — chỉ lấy bản visible.
  await page
    .locator('button[aria-haspopup="true"]:visible')
    .last()
    .click({ timeout: 3000 })
    .catch(() => {});
}

export async function logout(page: Page, testInfo?: TestInfo): Promise<number> {
  await dismissPopups(page);
  await openProfileMenu(page);
  const logoutBtn = page.getByText(/đăng xuất/i).first();
  await expect(logoutBtn).toBeVisible({ timeout: 10000 });

  const started = Date.now();
  await logoutBtn.click();
  // Confirm dialog "Bạn có chắc chắn muốn đăng xuất..." (V6) — V5 đăng xuất thẳng, không có dialog.
  const confirm = page.getByRole('button', { name: /đồng ý/i }).first();
  const hasConfirm = await confirm.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasConfirm) {
    await confirm.click();
  }
  // After logout, header shows link/button "Đăng nhập" (not logged-in profile)
  await loginTrigger(page).waitFor({ state: 'visible', timeout: 30000 });
  await expect(page.getByText(/SBD:/i)).toHaveCount(0);
  const elapsed = Date.now() - started;
  await attachTiming(testInfo, 'Logout', elapsed);
  return elapsed;
}

export function loginTrigger(page: Page) {
  return page
    .getByRole('link', { name: /^đăng nhập$/i })
    .or(page.getByRole('button', { name: /^đăng nhập$/i }))
    .first();
}

export async function attachTiming(testInfo: TestInfo | undefined, label: string, elapsedMs: number): Promise<void> {
  const verdict = classifyTiming(elapsedMs, env.passMaxMs, env.warningMaxMs);
  const details = `${label}: ${formatMs(elapsedMs)} → ${verdict} (pass≤${env.passMaxMs}ms, warn≤${env.warningMaxMs}ms)`;
  console.log(details);

  if (testInfo) {
    await testInfo.attach('timing', {
      body: details,
      contentType: 'text/plain',
    });
    if (verdict === 'WARNING') {
      await testInfo.attach('timing-warning', {
        body: details,
        contentType: 'text/plain',
      });
    }
  }

  if (verdict === 'FAIL') {
    throw new Error(details);
  }
}

export async function authHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const access = cookies.find((c) => c.name === 'user_access_token')?.value;
  const session = cookies.find((c) => c.name === 'x-session-token')?.value;
  const userId = cookies.find((c) => c.name === 'x-user-id')?.value;
  if (!access || !session || !userId) {
    throw new Error('Missing auth cookies after login');
  }
  return {
    Authorization: `Bearer ${access}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-session-token': session,
    'x-user-id': userId,
  };
}
