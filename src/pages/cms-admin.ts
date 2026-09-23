import type { Page } from '@playwright/test';
import { env } from '../config';
import { classifyTiming, type TimingVerdict } from '../timing';

export type CmsAccount = {
  baseUrl: string;
  user: string;
  pass: string;
};

export type MainMenu = {
  name: string;
  /** Trang đại diện của mục menu chính. Nhóm (href `#`) dùng trang con đầu tiên có URL thật. */
  url: string | null;
};

export type MenuCheck = {
  name: string;
  ok: boolean;
  status: number;
  note: string;
};

const AVATAR = 'img[alt="Midone Tailwind HTML Admin Template"]:visible';

function originOf(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

async function waitUntilLeftLogin(page: Page, timeout: number): Promise<boolean> {
  try {
    await page.waitForURL((url) => !String(url).includes('/login'), { timeout });
    return true;
  } catch {
    return !page.url().includes('/login');
  }
}

/** Form React hay mount lại và xóa giá trị vừa gõ — điền lại đến khi DOM giữ đúng. */
async function fillLoginForm(page: Page, account: CmsAccount): Promise<void> {
  const user = page.locator('input[name="username"]');
  const pass = page.locator('input[name="password"]');
  await user.waitFor({ state: 'visible', timeout: 15_000 });
  for (let attempt = 0; attempt < 4; attempt++) {
    await user.fill(account.user);
    await pass.fill(account.pass);
    await page.waitForTimeout(250);
    const userOk = (await user.inputValue()) === account.user;
    const passOk = (await pass.inputValue()) === account.pass;
    if (userOk && passOk) return;
  }
  throw new Error('Form đăng nhập không nhận tài khoản');
}

/** Đăng nhập CMS. Đồng hồ bắt đầu lúc bấm nút, dừng khi rời màn hình đăng nhập. */
export async function loginCms(
  page: Page,
  account: CmsAccount,
): Promise<{ elapsed: number; reached: boolean; reloaded: boolean }> {
  await page.goto(account.baseUrl, { waitUntil: 'domcontentloaded' });
  await fillLoginForm(page, account);

  const start = Date.now();
  await page.locator('button[type="submit"]').click();
  let reached = await waitUntilLeftLogin(page, env.warningMaxMs + 2_000);
  let reloaded = false;
  if (!reached) {
    reloaded = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await fillLoginForm(page, account);
    await page.locator('button[type="submit"]').click();
    reached = await waitUntilLeftLogin(page, 8_000);
  }
  return { elapsed: Date.now() - start, reached, reloaded };
}

export function loginVerdict(reached: boolean, elapsed: number, reloaded: boolean): TimingVerdict {
  if (!reached || elapsed > env.warningMaxMs) return 'FAIL';
  if (reloaded) return 'WARNING';
  return classifyTiming(elapsed, env.passMaxMs, env.warningMaxMs);
}

/**
 * Menu chính = mục sidebar đang hiện (cao ≥ 40px), bỏ mục `hidden`.
 * Mục chỉ mở nhóm con thì lấy URL trang con đầu tiên trong cùng `<li>`.
 */
export async function listMainMenus(page: Page, baseUrl: string): Promise<MainMenu[]> {
  const origin = originOf(baseUrl);
  await page.locator('a:visible').filter({ hasText: 'Quản lý tài khoản' }).first().waitFor({ state: 'visible', timeout: 15_000 });
  const raw = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')].filter((a) => {
      const cls = String(a.className || '');
      if (!cls.includes('pl-5') || cls.includes('hidden')) return false;
      const box = a.getBoundingClientRect();
      return box.height >= 40 && box.width >= 80;
    });

    return links.map((a) => {
      const own = a.getAttribute('href');
      let href = own && own !== '#' && !own.startsWith('javascript:') ? own : '';
      if (!href) {
        const li = a.closest('li');
        const child = li
          ? [...li.querySelectorAll('a')].find((node) => {
              const value = node.getAttribute('href');
              return !!value && value !== '#' && !value.startsWith('javascript:');
            })
          : null;
        href = child?.getAttribute('href') || '';
      }
      return {
        name: (a.innerText || '').trim().replace(/\s+/g, ' '),
        href,
      };
    });
  });

  const seen = new Set<string>();
  const menus: MainMenu[] = [];
  for (const item of raw) {
    if (!item.name || seen.has(item.name)) continue;
    seen.add(item.name);
    menus.push({
      name: item.name,
      url: item.href ? new URL(item.href, origin).href : null,
    });
  }
  return menus;
}

export async function checkMenuPage(page: Page, url: string): Promise<{ ok: boolean; status: number; note: string }> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status = response?.status() ?? 0;
  await page.waitForTimeout(500);

  if (page.url().includes('/login')) {
    return { ok: false, status, note: 'bị đẩy về đăng nhập' };
  }
  if (status !== 200 && status !== 304) {
    return { ok: false, status, note: `HTTP ${status || 'không có'}` };
  }

  let mainText = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    mainText = await page.evaluate(() => {
      let best = '';
      for (const node of document.querySelectorAll('div')) {
        const box = node.getBoundingClientRect();
        if (box.x < 240 || box.width < 400 || box.height < 160) continue;
        const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
        if (text.length > best.length && text.length < 8000) best = text;
      }
      return best;
    });
    if (mainText.length >= 40) break;
    await page.waitForTimeout(700);
  }

  if (mainText.length < 40) {
    return { ok: false, status, note: 'trang trắng' };
  }
  if (/internal server error|bad gateway|service unavailable|502 bad|503 service/i.test(mainText)) {
    return { ok: false, status, note: 'lỗi hiển thị' };
  }
  return { ok: true, status, note: '' };
}

export async function checkMainMenus(page: Page, baseUrl: string): Promise<MenuCheck[]> {
  let menus: MainMenu[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      menus = await listMainMenus(page, baseUrl);
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === 2 || !message.includes('Execution context was destroyed')) throw err;
      await page.waitForLoadState('domcontentloaded');
    }
  }
  if (menus.length < 3) {
    await page.locator('a:visible').filter({ hasText: 'Quản lý tài khoản' }).first().hover().catch(() => undefined);
    menus = await listMainMenus(page, baseUrl);
  }

  const results: MenuCheck[] = [];
  for (const menu of menus) {
    if (!menu.url) {
      results.push({ name: menu.name, ok: false, status: 0, note: 'không có trang để mở' });
      continue;
    }
    const checked = await checkMenuPage(page, menu.url);
    results.push({ name: menu.name, ok: checked.ok, status: checked.status, note: checked.note });
  }
  return results;
}

/** Bấm avatar góc trên → Đăng xuất. Đồng hồ bắt đầu lúc bấm mục Đăng xuất. */
export async function logoutCms(page: Page): Promise<number> {
  const avatars = page.locator(AVATAR);
  const count = await avatars.count();
  let avatar = avatars.first();
  if (count > 1) {
    const index = await avatars.evaluateAll((els) => {
      let best = 0;
      let bestY = Number.POSITIVE_INFINITY;
      els.forEach((el, i) => {
        const y = el.getBoundingClientRect().y;
        if (y >= 0 && y < bestY) {
          bestY = y;
          best = i;
        }
      });
      return best;
    });
    avatar = avatars.nth(index);
  }
  await avatar.click();
  const item = page.getByText('Đăng xuất', { exact: true });
  await item.waitFor({ state: 'visible', timeout: 8_000 });
  const start = Date.now();
  await item.click();
  await page.waitForURL((url) => String(url).includes('/login'), { timeout: 15_000 });
  return Date.now() - start;
}
