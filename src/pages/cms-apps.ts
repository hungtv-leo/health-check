import type { Page } from '@playwright/test';
import { env } from '../config';
import {
  assessVisibleContent,
  checkMenuPage,
  visitMenus,
  type CmsAccount,
  type LoginResult,
  type MainMenu,
  type MenuCheck,
} from './cms-admin';

function originOf(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

export function isAuthScreen(url: string): boolean {
  return (
    /\/login\/?(?:$|\?|#)/.test(url) ||
    url.includes('/realms/') ||
    url.includes('openid-connect') ||
    url.includes('/auth/login')
  );
}

async function authFailureNote(page: Page): Promise<string | undefined> {
  const text = (
    await page
      .locator('#input-error, .kc-feedback-text, .alert-error')
      .first()
      .innerText()
      .catch(() => '')
  ).replace(/\s+/g, ' ').trim();
  if (/invalid username or password/i.test(text)) return 'Sai tài khoản hoặc mật khẩu';
  const local = await page.getByText(/Sai tên người dùng hoặc mật khẩu|Invalid credentials/i).first().innerText().catch(() => '');
  if (local) return 'Sai tài khoản hoặc mật khẩu';
  return undefined;
}

async function waitLeftAuth(page: Page, timeout: number): Promise<boolean> {
  const error = page
    .locator('#input-error, .kc-feedback-text, .alert-error')
    .or(page.getByText(/Sai tên người dùng hoặc mật khẩu|Invalid credentials/i));
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await error.first().isVisible().catch(() => false)) return false;
    if (!isAuthScreen(page.url())) return true;
    await page.waitForTimeout(200);
  }
  return !isAuthScreen(page.url()) && !(await error.first().isVisible().catch(() => false));
}

async function finishLogin(page: Page, start: number): Promise<LoginResult> {
  const reached = await waitLeftAuth(page, env.warningMaxMs + 2_000);
  const note = reached ? undefined : await authFailureNote(page);
  return { elapsed: Date.now() - start, reached, reloaded: false, note };
}

/** CMS5 (vào thẳng Keycloak) và CMS6 (bấm Đăng nhập rồi sang Keycloak). */
export async function loginSso(page: Page, account: CmsAccount): Promise<LoginResult> {
  await page.goto(account.baseUrl, { waitUntil: 'domcontentloaded' });
  const user = page.locator('#username, input[name="username"]').first();
  const gate = page.getByRole('button', { name: 'Đăng nhập' });
  await Promise.race([
    user.waitFor({ state: 'visible', timeout: 20_000 }),
    gate.waitFor({ state: 'visible', timeout: 20_000 }),
  ]).catch(() => undefined);

  if ((await gate.isVisible().catch(() => false)) && !(await user.isVisible().catch(() => false))) {
    await gate.click();
  }
  await user.waitFor({ state: 'visible', timeout: 20_000 });
  await user.fill(account.user);
  await page.locator('#password, input[name="password"]').first().fill(account.pass);

  const submit = page.locator('#kc-login').or(page.locator('input[name="login"]')).or(page.locator('button[name="login"]')).first();
  const start = Date.now();
  await submit.click();
  return finishLogin(page, start);
}

export async function logoutCms6(page: Page): Promise<number> {
  await page.locator('.MuiAvatar-root').first().click();
  const item = page.getByRole('menuitem', { name: 'Sign Out' }).or(page.getByText('Sign Out', { exact: true }));
  await item.first().waitFor({ state: 'visible', timeout: 8_000 });
  const start = Date.now();
  await item.first().click();
  await page.waitForURL((url) => isAuthScreen(String(url)), { timeout: 15_000 });
  return Date.now() - start;
}

async function readLeftLinks(
  page: Page,
  baseUrl: string,
  box: { maxX: number; minW: number; minH: number },
): Promise<MainMenu[]> {
  const origin = originOf(baseUrl);
  const raw = await page.evaluate(({ maxX, minW, minH }) => {
    return [...document.querySelectorAll('a')]
      .map((a) => {
        const rect = a.getBoundingClientRect();
        return {
          name: (a.innerText || '').trim().replace(/\s+/g, ' '),
          href: a.getAttribute('href') || '',
          x: rect.x,
          w: rect.width,
          h: rect.height,
        };
      })
      .filter(
        (a) =>
          a.name &&
          a.href &&
          a.href !== '#' &&
          !a.href.startsWith('javascript:') &&
          a.x < maxX &&
          a.w >= minW &&
          a.h >= minH,
      );
  }, box);

  const seen = new Set<string>();
  const menus: MainMenu[] = [];
  for (const item of raw) {
    const url = new URL(item.href, origin).href;
    if (seen.has(url)) continue;
    seen.add(url);
    menus.push({ name: item.name.slice(0, 80), url });
  }
  return menus;
}

export async function listCms6Menus(page: Page, baseUrl: string): Promise<MainMenu[]> {
  await page.locator('a.MuiListItemButton-root:visible').first().waitFor({ state: 'visible', timeout: 15_000 });
  return readLeftLinks(page, baseUrl, { maxX: 320, minW: 80, minH: 30 });
}

export async function checkCms6Menus(page: Page, baseUrl: string): Promise<MenuCheck[]> {
  return visitMenus(page, await listCms6Menus(page, baseUrl));
}

export async function loginNoibo(page: Page, account: CmsAccount): Promise<LoginResult> {
  await page.goto(account.baseUrl, { waitUntil: 'domcontentloaded' });
  const user = page.locator('input[name="username"]');
  await user.waitFor({ state: 'visible', timeout: 15_000 });
  await user.fill(account.user);
  await page.locator('input[name="password"]').fill(account.pass);
  const start = Date.now();
  await page.locator('button[type="submit"]').click();
  return finishLogin(page, start);
}

export async function logoutNoibo(page: Page, account: CmsAccount): Promise<number> {
  await page.getByText(account.user, { exact: true }).first().click();
  const item = page.getByRole('button', { name: 'Đăng xuất' });
  await item.waitFor({ state: 'visible', timeout: 8_000 });
  const start = Date.now();
  await item.click();
  await page.waitForURL((url) => isAuthScreen(String(url)), { timeout: 15_000 });
  return Date.now() - start;
}

export async function listNoiboMenus(page: Page, baseUrl: string): Promise<MainMenu[]> {
  await page.locator('a[href="/tong-quan"]').waitFor({ state: 'visible', timeout: 15_000 });
  return readLeftLinks(page, baseUrl, { maxX: 300, minW: 80, minH: 36 });
}

export async function checkNoiboMenus(page: Page, baseUrl: string): Promise<MenuCheck[]> {
  const menus = await listNoiboMenus(page, baseUrl);
  const plain = menus.filter((menu) => menu.name !== 'Báo cáo thi');
  const checked = await visitMenus(page, plain);
  const report = menus.some((menu) => menu.name === 'Báo cáo thi') ? await checkReportLeaves(page) : [];
  const results: MenuCheck[] = [];
  for (const menu of menus) {
    if (menu.name === 'Báo cáo thi') results.push(...report);
    else {
      const item = checked.find((row) => row.name === menu.name);
      if (item) results.push(item);
    }
  }
  return results;
}

type SideLink = { name: string; href: string };

async function reportLinks(page: Page): Promise<SideLink[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .map((a) => {
        const box = a.getBoundingClientRect();
        return {
          name: (a.innerText || '').trim().replace(/\s+/g, ' '),
          href: a.getAttribute('href') || '',
          x: box.x,
          h: box.height,
          y: box.y,
        };
      })
      .filter((a) => a.name && a.href.startsWith('/report-thi/') && a.x < 340 && a.h >= 30 && a.y > 0 && a.y < 900)
      .map(({ name, href }) => ({ name, href })),
  );
}

/** Báo cáo thi chỉ là nhóm. Trang con mới có filter; chọn lần lượt ô "Chọn …", không bấm nút ghi dữ liệu. */
async function checkReportLeaves(page: Page): Promise<MenuCheck[]> {
  await page.locator('a[href="/report-thi"]').click();
  await page.waitForTimeout(400);
  const groups = (await reportLinks(page)).filter((link) => link.href.split('/').filter(Boolean).length === 2);
  const leaves: SideLink[] = [];
  for (const group of groups) {
    await page.locator(`a[href="${group.href}"]`).first().click();
    await page.waitForTimeout(400);
    for (const leaf of await reportLinks(page)) {
      if (leaf.href.split('/').filter(Boolean).length < 3) continue;
      if (!leaf.href.startsWith(`${group.href}/`)) continue;
      if (leaves.some((item) => item.href === leaf.href)) continue;
      leaves.push(leaf);
    }
  }

  const results: MenuCheck[] = [];
  for (const leaf of leaves) {
    const groupHref = `/${leaf.href.split('/').filter(Boolean).slice(0, 2).join('/')}`;
    await page.locator(`a[href="${groupHref}"]`).first().click();
    await page.locator(`a[href="${leaf.href}"]`).first().click();
    await page.waitForTimeout(500);
    const picked = await chooseFilters(page);
    const checked = await assessVisibleContent(page);
    const errorText = await reportErrorText(page);
    const note = errorText || checked.note;
    const detail = picked.length ? `${note ? note + ' · ' : ''}filter: ${picked.join('; ')}` : note;
    results.push({
      name: `Báo cáo thi · ${leaf.name}`,
      ok: checked.ok && !errorText,
      status: checked.status,
      note: checked.ok && !errorText ? '' : detail,
    });
  }
  if (leaves.length === 0) {
    results.push({ name: 'Báo cáo thi', ok: false, status: 0, note: 'không thấy mục con' });
  }
  return results;
}

async function chooseFilters(page: Page): Promise<string[]> {
  const picked: string[] = [];
  for (let step = 0; step < 6; step++) {
    const control = page.locator('[class*="-control"]').filter({ hasText: /^Chọn / }).first();
    if (!(await control.isVisible().catch(() => false))) break;
    const label = ((await control.innerText()) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    await control.click();
    const option = page.locator('[id*="-option-"]').first();
    const opened = await option.waitFor({ state: 'visible', timeout: 2_500 }).then(() => true).catch(() => false);
    if (!opened) {
      await page.keyboard.press('Escape');
      break;
    }
    const value = ((await option.innerText()) || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    await option.click();
    await page.waitForTimeout(600);
    picked.push(`${label} = ${value}`);
  }
  return picked;
}

async function reportErrorText(page: Page): Promise<string> {
  const toast = page.locator('.bg-red-500, .custom__toast').filter({ hasText: /lỗi|thất bại/i }).first();
  if (!(await toast.isVisible().catch(() => false))) return '';
  return ((await toast.innerText()) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

async function loginEmail(page: Page, account: CmsAccount, buttonName: string): Promise<LoginResult> {
  await page.goto(account.baseUrl, { waitUntil: 'domcontentloaded' });
  const email = page.locator('input[name="email"], input[type="email"]').first();
  await email.waitFor({ state: 'visible', timeout: 15_000 });
  await email.fill(account.user);
  await page.locator('input[name="password"], input[type="password"]').first().fill(account.pass);
  const start = Date.now();
  await page.getByRole('button', { name: buttonName }).click();
  return finishLogin(page, start);
}

export function loginStrapi(page: Page, account: CmsAccount): Promise<LoginResult> {
  return loginEmail(page, account, 'Login');
}

export function loginCmsNews(page: Page, account: CmsAccount): Promise<LoginResult> {
  return loginEmail(page, account, 'Đăng nhập');
}

export async function logoutStrapi(page: Page): Promise<number> {
  const profile = page.getByRole('button', { name: /profile/i }).or(page.locator('nav button').last());
  await profile.first().click();
  const item = page.getByRole('menuitem', { name: /log out/i }).or(page.getByText('Log out', { exact: true }));
  await item.first().waitFor({ state: 'visible', timeout: 8_000 });
  const start = Date.now();
  await item.first().click();
  await page.waitForURL((url) => isAuthScreen(String(url)), { timeout: 15_000 });
  return Date.now() - start;
}

export async function listStrapiMenus(page: Page, baseUrl: string): Promise<MainMenu[]> {
  await page.locator('a[aria-label="Home"]').waitFor({ state: 'visible', timeout: 15_000 });
  const origin = originOf(baseUrl);
  const raw = await page.evaluate(() => {
    return [...document.querySelectorAll('nav a')]
      .map((node) => {
        const a = node as HTMLAnchorElement;
        const rect = a.getBoundingClientRect();
        return {
          name: (a.innerText || '').trim().replace(/\s+/g, ' '),
          href: a.getAttribute('href') || '',
          h: rect.height,
          w: rect.width,
        };
      })
      .filter((a) => {
        if (!a.name || !a.href.startsWith('/admin') || a.h < 24 || a.w < 24) return false;
        return !a.href.includes('collection-types') && !a.href.includes('single-types') && a.href !== '#main-content';
      });
  });

  const seen = new Set<string>();
  const menus: MainMenu[] = [];
  for (const item of raw) {
    const url = new URL(item.href, origin).href;
    if (seen.has(url)) continue;
    seen.add(url);
    menus.push({ name: item.name.slice(0, 80), url });
  }
  return menus;
}

export async function checkStrapiMenus(page: Page, baseUrl: string): Promise<MenuCheck[]> {
  const menus = await listStrapiMenus(page, baseUrl);
  const results: MenuCheck[] = [];
  for (const menu of menus) {
    if (!menu.url) {
      results.push({ name: menu.name, ok: false, status: 0, note: 'không có trang để mở' });
      continue;
    }
    const path = new URL(menu.url).pathname;
    await page.locator(`nav a[href="${path}"]`).first().click();
    await page.waitForTimeout(500);
    const checked = await assessVisibleContent(page);
    results.push({ name: menu.name, ok: checked.ok, status: checked.status, note: checked.note });
  }
  return results;
}

/** Nút đăng xuất ẩn trên thanh icon, hiện khi rê chuột vào avatar. Không mở form sửa tài khoản. */
export async function logoutCmsNews(page: Page, _account: CmsAccount): Promise<number> {
  const accountLink = page.locator('a[href*="/admin/users/"]').last();
  await accountLink.hover();
  const buttons = page.locator('button:has(svg)');
  const index = await buttons.evaluateAll((els) =>
    els.findIndex((el) => {
      const box = el.getBoundingClientRect();
      return box.x < 90 && box.y > 700 && !el.querySelector('[data-icon="notifications"]');
    }),
  );
  if (index < 0) throw new Error('Không thấy nút đăng xuất trên thanh icon');
  const item = buttons.nth(index);
  await item.waitFor({ state: 'visible', timeout: 8_000 });
  await item.click();
  const confirm = page.getByRole('link', { name: 'Đăng xuất' }).or(page.getByRole('button', { name: 'Đăng xuất' }));
  await confirm.first().waitFor({ state: 'visible', timeout: 8_000 });
  const start = Date.now();
  await confirm.first().click();
  await page.waitForURL((url) => isAuthScreen(String(url)), { timeout: 15_000 });
  return Date.now() - start;
}

const MUTATION = /tạo mới|thêm mới|cập nhật|chỉnh sửa|\bsửa\b|\bxóa\b|\bdelete\b|\bcreate\b|\bupdate\b|\bedit\b|\/create|\/edit|\/delete|\/new\b/i;

function viewOnly(menus: MainMenu[]): MainMenu[] {
  return menus.filter((menu) => !MUTATION.test(`${menu.name} ${menu.url || ''}`));
}

async function cmsNewsOutage(page: Page): Promise<string> {
  const heading = page.getByRole('heading', { name: 'Lỗi Bất Thường' });
  if (!(await heading.isVisible().catch(() => false))) return '';
  const detail = await page.getByText(/SERVICE_UNAVAILABLE|unavailable|unexpected error/i).first().innerText().catch(() => '');
  return (detail || 'Lỗi Bất Thường').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/** Chờ sidebar. Nếu Directus đang báo API quá tải thì bấm Reload một lần. */
async function waitCmsNewsShell(page: Page): Promise<string> {
  const link = page.locator('a[href*="/admin/"]');
  const shell = link.or(page.getByRole('heading', { name: 'Lỗi Bất Thường' }));
  await shell.first().waitFor({ state: 'visible', timeout: 15_000 });
  if ((await cmsNewsOutage(page)) && (await link.count()) === 0) {
    const reload = page.getByRole('button', { name: 'Reload Page' });
    if (await reload.isVisible().catch(() => false)) {
      await reload.click();
      await link.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
    }
  }
  return cmsNewsOutage(page);
}

export async function listCmsNewsMenus(page: Page, baseUrl: string): Promise<MainMenu[]> {
  const outage = await waitCmsNewsShell(page);
  if (outage) throw new Error(outage);
  return viewOnly(await readLeftLinks(page, baseUrl, { maxX: 320, minW: 80, minH: 28 }));
}

export async function checkCmsNewsMenus(page: Page, baseUrl: string): Promise<MenuCheck[]> {
  try {
    return await visitMenus(page, await listCmsNewsMenus(page, baseUrl));
  } catch (err) {
    const note = err instanceof Error ? err.message.split('\n')[0].slice(0, 160) : String(err);
    return [{ name: 'Cms new', ok: false, status: 503, note }];
  }
}

export async function listGenericMenus(page: Page, baseUrl: string): Promise<MainMenu[]> {
  await page.waitForTimeout(800);
  return viewOnly(await readLeftLinks(page, baseUrl, { maxX: 320, minW: 80, minH: 28 }));
}

export async function checkGenericMenus(page: Page, baseUrl: string): Promise<MenuCheck[]> {
  return visitMenus(page, await listGenericMenus(page, baseUrl));
}

/** CMS5: Tổng quan + các danh sách trong Học liệu. Chỉ mở trang, không bấm tạo/sửa/xóa. */
export async function checkCms5Menus(page: Page, baseUrl: string): Promise<MenuCheck[]> {
  await page.getByText('Tổng quan', { exact: true }).first().waitFor({ state: 'visible', timeout: 15_000 });
  const home = await assessVisibleContent(page);
  const results: MenuCheck[] = [{ name: 'Tổng quan', ok: home.ok, status: home.status, note: home.note }];

  await page.getByText('Học liệu', { exact: true }).click();
  await page.waitForTimeout(400);
  const origin = originOf(baseUrl);
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .map((a) => {
        const box = a.getBoundingClientRect();
        return {
          name: (a.innerText || '').trim().replace(/\s+/g, ' '),
          href: a.getAttribute('href') || '',
          x: box.x,
          y: box.y,
          h: box.height,
        };
      })
      .filter((a) => a.name && a.href.startsWith('/materials') && a.x < 320 && a.h >= 20 && a.y > 0),
  );
  const seen = new Set<string>();
  for (const link of links) {
    if (seen.has(link.href) || MUTATION.test(`${link.name} ${link.href}`)) continue;
    seen.add(link.href);
    const checked = await checkMenuPage(page, new URL(link.href, origin).href);
    results.push({
      name: `Học liệu · ${link.name}`,
      ok: checked.ok,
      status: checked.status,
      note: checked.note,
    });
  }
  return results;
}

export async function logoutCms5(page: Page, account: CmsAccount): Promise<number> {
  await page.getByText(account.user).first().click();
  const item = page.getByText('Đăng xuất', { exact: true });
  await item.waitFor({ state: 'visible', timeout: 8_000 });
  const start = Date.now();
  await item.click();
  await page.waitForURL((url) => isAuthScreen(String(url)), { timeout: 15_000 });
  return Date.now() - start;
}

/** CMS5: chỉ mở avatar rồi bấm đăng xuất. Không bấm nút tạo, sửa, xóa. */
export async function logoutLabeled(page: Page): Promise<number> {
  const pattern = /Đăng xuất|Sign Out|Log out|Logout/;
  let item = page.getByRole('button', { name: pattern }).or(page.getByRole('menuitem', { name: pattern }));
  if (!(await item.first().isVisible().catch(() => false))) {
    const opener = page.locator('.MuiAvatar-root').first();
    if (await opener.isVisible().catch(() => false)) await opener.click();
    item = page.getByRole('button', { name: pattern }).or(page.getByRole('menuitem', { name: pattern })).or(page.getByText(pattern));
  }
  await item.first().waitFor({ state: 'visible', timeout: 8_000 });
  const start = Date.now();
  await item.first().click();
  await page.waitForURL((url) => isAuthScreen(String(url)), { timeout: 15_000 });
  return Date.now() - start;
}
