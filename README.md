# TNMath V6 auto-check

Playwright checks for **TNMath prod** (`tnmath.edu.vn`), focused on student flows.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env   # fill STUDENT_USER / STUDENT_PASS / DISCORD_WEBHOOK_URL
```

## Run

```bash
npm test                 # all checks
npm run test:auth        # login/logout only
npm run test:headed      # headed browser
npm run test:report      # open HTML report
```

## Auth flow

1. `auth.setup.ts` — **login 1 lần** (V6), đo timing, lưu `playwright/.auth/user.json`
2. Các case (`02`…`08`) — **không login lại**, dùng `storageState`
3. `99-logout.spec.ts` — **logout cuối suite của V6**
4. `990-v5-auth.spec.ts`, `991-v-switch.spec.ts` — login V5 + chuyển hệ, chạy **sau `99-logout`** (hệ thống chỉ cho 1 phiên/tài khoản — đăng nhập lại sẽ huỷ phiên V6 đang dùng nếu chạy trước)

Chạy full: `npm test`  
Chạy lẻ 1 case: setup vẫn chạy trước (dependency) → vẫn có session.

## Coverage (phase 1 + phase 2)

| Spec | What |
|------|------|
| `auth.setup` | Login 1 lần (V6) + lưu session + timing |
| `02-menus` | Main TNMath menus visible & clickable |
| `03-video` | Lesson video loads + `currentTime` increases |
| `04-exercise` | Bài tập: generate + submit empty → `totalResults = 0` |
| `05-exam` | Bài kiểm tra: UI mở đề + API generate/submit empty → 0 |
| `06-practice` | Luyện toán: danh sách vòng + generate đề + UI làm luyện |
| `07-e2e-lesson-exercise` | Sau login: video bài giảng → làm bài tập UI → nộp trống → 0 điểm |
| `08-visual` | Visual regression: form đăng nhập, trang bài học, danh sách luyện toán |
| `99-logout` | Logout cuối suite (V6) + timing |
| `990-v5-auth` | Login + Logout trực tiếp trên V5 (`trangnguyen.edu.vn`) |
| `991-v-switch` | Luồng chuyển hệ: V5→V6, V6→VNMF, VNMF→V6, V6→V5 |

Discord nhận **1 summary** mỗi lần chạy (PASS / WARNING / FAIL), liệt kê từng case.

## Notes

- Secrets live in `.env` only (gitignored).
- GitLab CI schedule can be added later when local runs are stable.
