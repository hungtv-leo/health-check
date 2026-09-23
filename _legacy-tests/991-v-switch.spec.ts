import { test, expect } from '@playwright/test';
import { env } from '../src/config';
import { loginAsStudent } from '../src/pages/auth';
import {
  switchV5ToV6,
  switchV6ToVnmf,
  switchVnmfToV6ViaLogin,
  switchV6ToV5ViaThiNgay,
} from '../src/pages/system-switch';

/**
 * Luồng chuyển hệ V5 <-> V6 <-> VNMF (TC-06 trong kịch bản kiểm tra gốc).
 * Chỉ verify điều hướng đúng đích + trang load thành công, KHÔNG verify flicker UI
 * (không automate được, xem docs/SRS).
 */
test.describe('Luồng chuyển hệ · V5 ↔ V6 ↔ VNMF', { tag: ['@critical'] }, () => {
  test('V5 -> V6 qua banner/link VNMF', async ({ page }) => {
    await switchV5ToV6(page);
    expect(page.url()).toContain(new URL(env.baseUrl).host);
  });

  test('V6 -> VNMF qua link VNMF', async ({ page }) => {
    await switchV6ToVnmf(page);
    expect(page.url()).toContain(new URL(env.vnmfBaseUrl).host);
  });

  test('VNMF -> V6 qua nút Đăng nhập', async ({ page }) => {
    await switchVnmfToV6ViaLogin(page);
    expect(page.url()).toContain(new URL(env.baseUrl).host);
  });

  test('V6 -> V5 qua nút Thi ngay', async ({ page }) => {
    // Luồng "Thi ngay" gọi logout SSO toàn realm (Keycloak end_session) trước khi đăng nhập
    // lại — nếu dùng chung session storageState của project, nó sẽ huỷ luôn session đó cho
    // các test khác (kể cả 99-logout chạy sau). Nên tự login riêng (session độc lập) ở đây.
    await loginAsStudent(page, undefined, env.baseUrl);
    await switchV6ToV5ViaThiNgay(page);
    expect(page.url()).toContain(new URL(env.v5BaseUrl).host);
  });
});
