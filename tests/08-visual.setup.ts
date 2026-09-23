import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loginAsStudent } from '../src/pages/auth';

/**
 * Login V6 riêng CHỈ để phục vụ 08-visual.spec.ts (visual regression cần 1 session độc lập,
 * ổn định để chụp ảnh). KHÔNG phải login chính của suite — luồng chính (V5 → V6 → VNMF) nằm ở
 * tests/10-13 và tự login trong HC-V5-01 (xem src/fixtures.ts). Phiên V6 ở đây sẽ bị "âm thầm
 * huỷ" khi luồng chính login lại sau đó — không sao vì không có test nào sau 08-visual còn cần
 * dùng session này (xem AGENTS.md § Ràng buộc hệ thống: 1 phiên/tài khoản).
 */
export const AUTH_STATE_PATH = path.join('playwright', '.auth', 'user.json');

setup('Login V6 riêng cho visual regression', { tag: ['@visual'] }, async ({ page }, testInfo) => {
  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  const elapsed = await loginAsStudent(page, testInfo);
  await expect(page.getByText(/SBD:/i).first()).toBeVisible();
  expect(elapsed).toBeGreaterThan(0);

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
