# Testing Strategy — TNMath V6 auto-check

Chiến lược kiểm thử/health-check cho dự án, tham chiếu mục **Testing** của
[sindresorhus/awesome](https://github.com/sindresorhus/awesome). Mục tiêu: **tự động phát hiện
sớm sự cố hệ thống prod** một cách đáng tin cậy, ít flaky, báo động rõ ràng.

## Mục tiêu & phạm vi

- Đây là **monitoring / health-check** trên prod (`tnmath.edu.vn` + `trangnguyen.edu.vn` (V5) + `vnmf.edu.vn`), KHÔNG phải unit/integration test khi build.
- Ưu tiên: (1) tín hiệu đúng (ít false-positive/negative), (2) chạy nhanh nhóm quan trọng, (3) báo Discord có cấu trúc.

## Ánh xạ awesome Testing → dự án

| Mục awesome | Quyết định | Lý do |
|-------------|-----------|-------|
| **Playwright** | ✅ Dùng chính | Chromium, 1 API, trace/screenshot/video khi fail |
| **Visual Regression Testing** | ✅ Đã thêm (`tests/08-visual.spec.ts`) | Bắt vỡ layout/UI không cần viết selector; dùng `toHaveScreenshot` built-in |
| **k6 / JMeter / Gatling** (load/perf) | ⏸️ Chưa | Bắn tải lên prod rủi ro; đã đo timing 1-request (Pass≤4s/Warn≤6s/Fail>6s). Chỉ thêm khi có staging |
| **Selenium / Appium** | ❌ Không | Playwright đã đủ; không có app mobile |
| **TAP** | ❌ Không | Reporter Discord + HTML đã đáp ứng |
| **QA Roadmap** | 📖 Tham khảo | Tài liệu định hướng, không tích hợp |
| **CodeRabbit** (AI review) | ➖ Đã có tương đương | Dùng Bugbot / Security-review của Cursor cho vòng dev harness |

## Phân tầng test & tag

Dùng tag Playwright để chạy nhóm theo nhu cầu (setup login luôn chạy trước vì là dependency):

| Tag | Gồm | Lệnh | Khi dùng |
|-----|-----|------|----------|
| `@smoke` | menus + bài tập (nhanh) | `npm run test:smoke` | Kiểm tra nhanh còn sống |
| `@critical` | video, bài tập, kiểm tra, luyện, e2e, logout, login/logout V5, chuyển hệ | `npm run test:critical` | Health-check lõi |
| `@visual` | 3 ảnh baseline ổn định | `npm run test:visual` | Phát hiện vỡ layout |
| (tất cả) | toàn bộ | `npm test` | Chạy đầy đủ (dùng cho lịch) |

**Ràng buộc thứ tự (quan trọng):** hệ thống chỉ cho 1 phiên hoạt động/tài khoản trên toàn bộ V5/V6/VNMF (cùng SSO realm). Vì vậy `990-v5-auth.spec.ts` và `991-v-switch.spec.ts` (có hành động đăng nhập lại) luôn được đặt số thứ tự **sau** `99-logout.spec.ts`, để không huỷ phiên V6 dùng chung của các case `02`–`99`. Chạy `--grep @critical` vẫn giữ đúng thứ tự này vì Playwright chạy theo tên file trong cùng project.

## Visual Regression — quy tắc chống flaky

- **Chỉ chụp trang ổn định**: form đăng nhập, trang bài học, danh sách luyện toán.
- **KHÔNG chụp** trang làm bài kiểm tra / làm luyện (câu hỏi sinh ngẫu nhiên → luôn khác → false-fail).
- Luôn **mask** vùng động: `video`, header `SBD:` (tên/mã học sinh).
- `animations: 'disabled'`, `caret: 'hide'`, `maxDiffPixelRatio: 0.05` (dung sai cho prod).
- Baseline lưu trong `tests/08-visual.spec.ts-snapshots/` (commit vào repo). Cập nhật khi UI đổi có chủ đích:
  ```bash
  npm run test:update-snapshots
  ```
- Ảnh baseline gắn nền tảng (vd. `-win32`) → chạy trên cùng OS với máy tạo baseline (máy chạy lịch).

## Reporting & alerting

- Discord: **1 summary/lần chạy** (`src/reporters/discord-reporter.ts`) — PASS/WARNING/FAIL + timing.
- HTML report: `npm run test:report`; artefact lỗi (trace/screenshot/video) trong `test-results/`.

## Định hướng mở rộng (khi có nhu cầu / staging)

- **k6** cho latency API chính (login, generation-question) — chạy trên staging hoặc low-VUs, tách khỏi suite daily.
- Thêm trang vào visual khi xác định được vùng ổn định.
- GitLab/GitHub CI schedule (thay/bổ sung Windows Task Scheduler) — secrets qua CI, không commit `.env`.
