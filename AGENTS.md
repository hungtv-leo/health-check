# AGENTS.md

Contract cho AI coding agent làm việc trên repo này. Đọc file này như README-cho-máy trước khi sửa gì.

## Dự án

`auto-check` — bộ **Playwright health-check cho TNMath V6 (prod)** ở `https://tnmath.edu.vn`, tập trung luồng học sinh. Ngoài V6, có thêm luồng đăng nhập V5 (`trangnguyen.edu.vn`) và luồng chuyển hệ V5 ↔ V6 ↔ VNMF (`vnmf.edu.vn`) — 3 hệ dùng chung 1 SSO realm (Keycloak, `id.trangnguyen.edu.vn`). Stack: TypeScript + `@playwright/test` (Chromium), báo cáo qua Discord webhook (1 summary/lần chạy). Chạy thật lên prod → cần `.env` + tài khoản học sinh.

Đặc tả chi tiết từng case (nguồn canonical hiện tại): `docs/kịch bản kiểm tra hệ thống Trạng Nguyên_1.xlsx`.
- Sheet **"Webuser các V - Test case"** — 22 case học sinh, mã `HC-V5-xx` / `HC-V6-xx` / `HC-VNMF-xx`. Chạy bằng `npm test`.
- Sheet **"Quản trị các V - Test case"** — CMS quản trị (đăng nhập → menu chính → đăng xuất). Suite **riêng** `npm run test:cms`, không trộn vào `npm test`. Chạy CMS2, CMS5, CMS6 (`admin.tnmath.edu.vn`), Quản trị, Nội bộ, Cms new, Admin vnmf. MinIO có tài khoản nhưng sheet không có case HC — không chạy.

`docs/SRS-kich-ban-auto-check-TNMath-V6.md` là tài liệu SRS phase 1 cũ (V6-only, TC-xx) — đã lỗi thời so với kiến trúc hiện tại, giữ lại để tham khảo lịch sử, KHÔNG dùng làm nguồn đặc tả case mới.

## Cấu trúc (path thật)

Luồng chính chạy **đúng thứ tự sheet**: HC-V5-01..07 → HC-V6-01..09 → HC-VNMF-01..03 trên 1 `sharedPage` (xem `src/fixtures.ts`). Sau HC-V5-07 (logout V5) có **bridge không báo cáo** (`restoreV5SessionThenOpenV6`) để khôi phục tiền điều kiện HC-V6-01. `npm test` chỉ chạy project `chromium` (visual tách `npm run test:visual`).

- `src/fixtures.ts` — fixture **worker-scoped** `sharedPage` xuyên suốt `tests/10-14` (`workers: 1`). Spec luồng chính PHẢI `import { test, expect } from '../src/fixtures'` và dùng `sharedPage`.
- `tests/` — thứ tự chạy = tên file (Playwright):
  - `10-flow-v5.spec.ts` — HC-V5-01..06 (login V5 → Thi hay → Luyện thích → Học giỏi video → bài tập → chuyển V5→V6).
  - `11-flow-v5-logout.spec.ts` — HC-V5-07 logout V5 + bridge login lại V5 → mở V6.
  - `12-flow-v6.spec.ts` — HC-V6-01..08 (SSO login V6 → video → bài tập → kiểm tra → luyện → Đấu trường → V6→V5 → V6→VNMF).
  - `13-flow-v6-logout.spec.ts` — HC-V6-09 đăng xuất V6.
  - `14-flow-vnmf.spec.ts` — HC-VNMF-01..03 (trang chủ → tin tức → VNMF→V6).
  - `08-visual.setup.ts` + `08-visual.spec.ts` — visual regression (ngoài `npm test`; chạy bằng `npm run test:visual`).
  - `_legacy-tests/` — spec cũ, không quét.
- `src/config.ts` — `.env` + URL helpers. Vòng thi V5 cố định: `V5_EXAM_PLAYGROUND` / `V5_EXAM_ROUND` (+ fallback).
- `src/pages/` — Page Objects: `auth`, `result`, `v5-learning`, `v6-flow`, `arena`, `vnmf`, `system-switch` (`restoreV5SessionThenOpenV6`), `learning` (chỉ visual).
- `src/timing.ts`, `src/discord.ts`, `src/reporters/discord-reporter.ts`, `scripts/run-checks.ps1`.
- `tests/cms/` — suite CMS, project Playwright `cms` (`npm run test:cms`). Context mới mỗi hệ, không dùng `sharedPage`. `20-cms2` + `21-quantri` (Midone); `22-cms5` + `23-cms6` (Keycloak); `24-noibo`; `25-cmsnew`; `26-admvnmf` (Strapi).
- `src/pages/cms-admin.ts` — login / menu chính / logout cho admin Midone (CMS2, Quản trị).
- `src/pages/cms-apps.ts` — driver các hệ còn lại (SSO, Nội bộ, Cms new, Strapi).
- `playwright.config.ts` — `workers: 1`, `fullyParallel: false`, timeout 120s, `actionTimeout: 15_000` / `navigationTimeout: 30_000`; projects `visual-setup`/`visual` + `chromium` + `cms`. `npm test` chỉ project `chromium` (không gồm `cms`).

**Tag**: `@smoke` (HC-V5-01), `@critical`, `@visual`, `@HC-V5`/`@HC-V6`/`@HC-VNMF`.

### Ràng buộc hệ thống: 1 phiên/tài khoản

TNMath chỉ cho **1 phiên/tài khoản**. Hệ quả:
- HC-V5-01 là login form đầu; sau HC-V5-07 bridge login lại V5 (bắt buộc vì sheet đặt logout V5 trước các case V6).
- Không chạy thêm login/logout song song trong cùng lần chạy nếu làm hỏng `sharedPage`.

### HC-V6-01 (SSO)

PASS sheet chỉ khi **không** phải nhập lại mật khẩu. Prod thường hiện lại form Keycloak → **FAIL hợp lệ** (`phai_nhap_lai = có`); case vẫn điền form để HC-V6-02.. tiếp tục. `ensureLoggedIn()` cứu phiên rớt ở case sau.

## Vòng lặp bắt buộc (đến khi Done)

1. Sửa code tối thiểu theo nhiệm vụ.
2. Chạy **Lệnh verify** đúng khu vực đã đụng (bảng dưới).
3. FAIL do thay đổi của mình → đọc lỗi → sửa → lại bước 2.
4. PASS + Definition of done → mới báo hoàn thành.

Tối đa **8** vòng. Hết vòng vẫn fail (do thay đổi của mình) → dừng, tóm tắt lỗi + các lần thử, hỏi user. Không nói "xong" khi verify còn đỏ.

## Lệnh

**Setup (1 lần)**

```powershell
npm install
npx playwright install chromium
Copy-Item .env.example .env   # điền STUDENT_USER / STUDENT_PASS / DISCORD_WEBHOOK_URL
```

**Chạy**

```powershell
npm test                              # luồng chính 10-14 (project chromium; chạm prod, cần .env)
npm run test:flow                     # tường minh cùng bộ 10-14
npm run test:smoke                    # @smoke
npm run test:critical                 # @critical
npm run test:visual                   # visual (ngoài npm test)
npm run test:update-snapshots         # cập nhật baseline ảnh (UI đổi có chủ đích)
npm run test:headed                   # xem trình duyệt
npm run test:report                   # mở HTML report
npm run test:cms                      # CMS quản trị (project cms; tách khỏi npm test)
```

## Lệnh verify

| Đụng tới | Tầng NHANH (mỗi vòng) | Tầng ĐẦY ĐỦ (trước Done) |
|----------|-----------------------|--------------------------|
| Bất kỳ `.ts` (`src/**`, `tests/**`, `playwright.config.ts`) | `npx tsc --noEmit` | `npm test` |
| Luồng chính (`tests/10-14`, page objects liên quan, `src/fixtures.ts`) | `npx tsc --noEmit` | `npm run test:flow` |
| Chỉ 1 case trong luồng chính | `npx tsc --noEmit` | `npm run test:flow` — không chạy lẻ 1 file 10-14 |
| `src/config.ts` / thêm env | `npx tsc --noEmit` | `npm test` |
| `src/discord.ts`, `src/reporters/**` | `npx tsc --noEmit` | `npm test` |
| `tests/08-visual.spec.ts` / UI đổi | `npx tsc --noEmit` | `npm run test:visual` |
| Suite CMS (`tests/cms/**`, `src/pages/cms-admin.ts`, `src/pages/cms-apps.ts`) | `npx tsc --noEmit` | `npm run test:cms` |

- **Verify chính: `npm test`**.
- Thiếu `.env`/mạng/tài khoản → lỗi môi trường, không tính vào 8 vòng; coi `npm test` là "n/a", dựa `tsc --noEmit`.

## Hard stop

- Không commit `.env` / secret / `playwright/.auth/` / report.
- Không nới ngưỡng 4s/6s hay content ID prod trong `.env.example` nếu user không yêu cầu.
- Không force-push; không `--no-verify` trừ khi user yêu cầu.
- Không tuyên bố xong khi verify đỏ; không đoán kết quả test.
- Không sửa file Excel kịch bản gốc.

## Do / Don't

- **Do:** selector/logic trong `src/pages/**`; spec chỉ orchestrate + assert; `attachTiming` / `attachResult` đúng sheet.
- **Do:** `workers: 1` giữ nguyên.
- **Don't:** bỏ verify; hardcode credentials; `locator.isVisible({ timeout })` khi ý định là chờ (dùng `waitVisible`).

## Definition of done

- [ ] Phạm vi nhiệm vụ đã đủ.
- [ ] `npx tsc --noEmit` xanh.
- [ ] `npm test` PASS (đã chạy thật) — hoặc ghi rõ "n/a" (thiếu `.env`/mạng/tài khoản).
- [ ] Không lộ secret; không commit `.env` / report.
- [ ] Nêu rõ lệnh verify đã dùng + kết quả.
