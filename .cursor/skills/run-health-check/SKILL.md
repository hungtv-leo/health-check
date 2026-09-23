---
name: run-health-check
description: >
  Chạy bộ Playwright health-check TNMath V6 và đọc kết quả (PASS/WARNING/FAIL),
  điều tra case đỏ, chạy lại từng spec. Dùng khi user nói "chạy auto-check",
  "chạy health-check", "kiểm tra hệ thống TNMath", "chạy lại spec 0X", hoặc
  cần diễn giải/khắc phục kết quả test của repo này.
---

# Run health-check (TNMath V6 auto-check)

Ritual chạy và diễn giải bộ auto-check. Chi tiết case: `docs/SRS-kich-ban-auto-check-TNMath-V6.md`.

## Tiền đề (kiểm nhanh)

- Có `.env` với `STUDENT_USER`, `STUDENT_PASS` (bắt buộc), `DISCORD_WEBHOOK_URL` (tuỳ chọn).
- Đã `npm install` + `npx playwright install chromium`.
- Nếu thiếu `.env` → dừng, báo user điền trước; suite chạy thật lên prod nên không tự bịa credentials.

## Chạy

| Ý định | Lệnh |
|--------|------|
| Toàn bộ | `npm test` |
| Chỉ Login/Logout | `npm run test:auth` |
| 1 nhóm case | `npx playwright test tests/0X-*.spec.ts` |
| Xem trình duyệt (debug) | `npm run test:headed` |
| Mở HTML report | `npm run test:report` |

`workers: 1` là cố ý (tránh xung đột phiên login prod) — không chạy song song.

## Đọc kết quả

- **PASS**: thao tác OK và ≤ 4s.
- **WARNING**: thao tác OK nhưng 4s < t ≤ 6s (test vẫn pass, Discord báo vàng).
- **FAIL**: thao tác thất bại **hoặc** > 6s (phân loại trong `src/timing.ts`).
- Discord gửi **1 summary/lần chạy** (`src/reporters/discord-reporter.ts`); artefact lỗi ở `test-results/`, HTML ở `playwright-report/`.

## Khi có case FAIL — điều tra

1. Chạy lại đúng spec đỏ: `npx playwright test tests/0X-*.spec.ts --headed` để xem UI thật.
2. Xem trace/screenshot/video trong `test-results/` (config bật `trace: on-first-retry`, `screenshot/video: on failure`).
3. Phân biệt loại lỗi:
   - **App thật hỏng** (prod đổi UI/API, video không phát, điểm nộp trống ≠ 0) → báo user; đây là mục tiêu của health-check, KHÔNG "sửa test cho pass".
   - **Selector/luồng đã đổi** → cập nhật Page Object trong `src/pages/**` hoặc API trong `src/api/learning.ts`, giữ spec mỏng.
   - **Chậm/timeout mạng** → xác nhận có lặp lại; ngưỡng thời gian là chủ đích, không nới nếu user không yêu cầu.
4. Sửa xong → verify theo `AGENTS.md` (tsc + chạy lại spec) trước khi báo xong.

## Không làm

- Không nới ngưỡng 4s/6s hay đổi content ID prod để "cho pass".
- Không hardcode credentials/webhook; luôn qua `.env` + `src/config.ts`.
- Không commit `test-results/`, `playwright-report/`, `.env`.
