# SRS — Kịch bản kiểm tra tự động TNMath V6 (Auto-check)

| Mục | Nội dung |
|-----|----------|
| **Tên hệ thống** | TNMath V6 — Trạng Nguyên Toán |
| **Loại tài liệu** | Software Requirements Specification (kiểm thử / health-check) |
| **Phiên bản** | 1.0 |
| **Ngày** | 2026-09-21 |
| **Phạm vi** | WEB học sinh · môi trường **Production** |
| **Công cụ** | Playwright (Chromium) + Discord webhook |

---

## 1. Mục đích

Tài liệu mô tả **yêu cầu kiểm tra tự động** (auto health-check) cho các luồng chính trên TNMath V6, nhằm:

- Phát hiện sớm lỗi Login / Logout / học liệu / làm bài.
- Đo thời gian thao tác quan trọng theo ngưỡng Pass / Warning / Fail.
- Báo cáo kết quả có cấu trúc lên Discord sau mỗi lần chạy.

---

## 2. Phạm vi

### 2.1 Trong phạm vi (phase hiện tại)

| STT | Luồng | Vị trí |
|-----|--------|--------|
| 1 | Login | WEB V6 — `https://tnmath.edu.vn` |
| 2 | Logout | WEB V6 |
| 3 | Hiển thị menu / button chính | WEB V6 (ưu tiên TNMath) |
| 4 | Học bài giảng (video) | Học Toán · bài học cố định |
| 5 | Làm **bài tập** | Trong bài học · nộp trống → 0 điểm |
| 6 | Làm **bài kiểm tra** | Trong bài học · UI + API |
| 7 | **Luyện toán** | Menu Luyện Toán · 1 vòng luyện cố định |
| 8 | Login/Logout **V5** | WEB V5 — `https://trangnguyen.edu.vn` |
| 9 | **Chuyển hệ** V5 ↔ V6 ↔ VNMF | 4 hướng: V5→V6, V6→VNMF, VNMF→V6, V6→V5 |

### 2.2 Ngoài phạm vi (chưa automate)

- CMS (CMS2 / CMS5 / CMS6)
- Hết giờ / hệ thống tự nộp bài
- Kiểm tra flicker UI
- GitLab CI schedule (sẽ bổ sung sau khi local ổn)

---

## 3. Môi trường & điều kiện tiên quyết

| Hạng mục | Giá trị |
|----------|---------|
| WEB URL (V6) | `https://tnmath.edu.vn` |
| WEB URL (V5) | `https://trangnguyen.edu.vn` |
| WEB URL (VNMF) | `https://vnmf.edu.vn` |
| API URL | `https://tne-prod-api.tnmath.edu.vn/apis` |
| SSO | Keycloak dùng chung realm `tne-main` (`id.trangnguyen.edu.vn`) cho cả V5/V6/VNMF — 1 tài khoản đăng nhập được cả 3 hệ |
| Tài khoản | 1 TK học sinh (không MFA / Captcha / OTP) |
| Trình duyệt | Chromium (Playwright) |
| Session | Fresh mỗi test (không dùng cache đăng nhập cũ) |
| Mạng | Ổn định; VPN tùy mạng máy chạy |
| Báo cáo | Discord webhook (1 tin / lần chạy suite) |

> **Ràng buộc quan trọng:** hệ thống chỉ cho **1 phiên hoạt động/tài khoản** trên toàn bộ 3 hệ (V5/V6/VNMF) — bất kỳ đăng nhập mới nào (kể cả tự động qua SSO) sẽ âm thầm huỷ phiên khác đang mở của cùng tài khoản. Vì vậy các case có đăng nhập lại (TC-10, TC-11) phải chạy **sau cùng**, sau TC-02 (Logout V6) — xem `tests/990-v5-auth.spec.ts` / `tests/991-v-switch.spec.ts`.

### 3.1 Dữ liệu nội dung cố định (prod)

| Loại | ID / ghi chú |
|------|----------------|
| Course (frame) | `4e5e8399-969f-4906-8ac7-a144ac036069` |
| Bài học (category / lesson) | `41f4e45d-e756-40c6-a506-66f2a95509e7` — *Cộng trừ số tự nhiên* |
| Tuần học (week) | `c3562117-b255-48b2-a4b8-78720f8128d4` — *Tuần ôn tập 1* |
| Learning media (video) | `aa684c05-44ee-4648-8120-4c6fd3d4a3c1` |
| Bài tập | `273820f4-97f2-49ce-9c06-b85f68f3e039` — *Giới thiệu cộng trừ có nhớ* |
| Bài kiểm tra (testingConfig) | `5c202119-2440-442b-a9f5-11b29b9e613c` |
| Luyện — training | `faa09272-12d8-42ef-992b-59ac2dc6f646` |
| Luyện — vòng | `9a205ddb-4fc0-4e62-9407-95bb515335d3` — *Ôn luyện vòng 1 - bài thi số 1* |

---

## 4. Quy tắc đánh giá thời gian

Áp dụng cho **thời gian thao tác đo được** (không phải tổng thời gian cả file test Playwright).

| Kết quả | Điều kiện |
|---------|-----------|
| **PASS** | Thao tác thành công **và** `t ≤ 4s` |
| **WARNING** | Thao tác thành công **và** `4s < t ≤ 6s` → test vẫn pass, Discord báo WARNING |
| **FAIL** | Thao tác thất bại **hoặc** `t > 6s` |

### 4.1 Cách đo

| Thao tác | Bắt đầu đo | Kết thúc đo |
|----------|------------|-------------|
| Login | Click nút **Đăng nhập** trên form | Xuất hiện `SBD:` trên header |
| Logout | Click **Đăng xuất** (sau đó xác nhận **Đồng ý**) | Xuất hiện nút/link **Đăng nhập** và mất `SBD:` |
| Nộp bài (API) | Gửi request nộp | Nhận response thành công |

> **Lưu ý:** Thời gian tổng của 1 case test (vd. 8.3s) gồm mở trang, điền form, assert… — **không** dùng để Pass/Warning/Fail.

---

## 5. Kịch bản kiểm tra chi tiết

### TC-01 — Login

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-AUTH-01 |
| **File** | `tests/auth.setup.ts` (project `setup`, chạy 1 lần trước mọi spec khác) |
| **Mô tả** | Học sinh đăng nhập thành công trên V6, lưu session vào `playwright/.auth/user.json` |
| **Bước** | 1. Mở trang chủ · 2. Mở form Đăng nhập · 3. Nhập user/pass · 4. Bấm Đăng nhập |
| **PASS** | Thấy tên HS + `SBD:` · `t ≤ 4s` |
| **WARNING** | Login OK · `4s < t ≤ 6s` |
| **FAIL** | Không vào được tài khoản · hoặc `t > 6s` |

---

### TC-02 — Logout

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-AUTH-02 |
| **File** | `tests/99-logout.spec.ts` (chạy cuối suite, dùng lại session từ `auth.setup.ts`) |
| **Mô tả** | Học sinh đăng xuất thành công |
| **Bước** | 1. Đã login · 2. Mở menu profile · 3. Đăng xuất · 4. Xác nhận **Đồng ý** |
| **PASS** | Thấy Đăng nhập · không còn `SBD:` · `t ≤ 4s` |
| **WARNING** | Logout OK · `4s < t ≤ 6s` |
| **FAIL** | Không logout được · hoặc `t > 6s` |

---

### TC-03 — Hiển thị menu / button chính

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-UI-01 |
| **File** | `tests/02-menus.spec.ts` |
| **Mô tả** | Các menu chính TNMath hiển thị và tương tác được |
| **Đối tượng** | My TNMath, Về TNMath, Khóa học, Học Toán, Luyện Toán, Thi Toán, Game Toán, Đấu trường, Thế giới Toán học, Vinh danh, Đổi quà, Vòng quay may mắn, Tin tức |
| **PASS** | Tất cả menu visible + enabled; click **Học Toán** điều hướng OK |
| **FAIL** | ≥ 1 menu không hiển thị / không click được |

---

### TC-04 — Bài giảng (video)

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-LEARN-01 |
| **File** | `tests/03-video.spec.ts` |
| **Mô tả** | Video bài giảng load và phát được |
| **URL** | `/hoc-toan/{COURSE_ID}/{LESSON_ID}` (fallback: vào học từ trang khóa) |
| **PASS** | Có thẻ `video` · `readyState ≥ 2` · sau ~2–3s `currentTime > 0` · không lỗi media |
| **FAIL** | Không load video · thời gian phát không tăng · có `video.error` |
| **Ghi chú** | Không kiểm tra giật/lag giữa chừng |

---

### TC-05 — Bài tập (nộp trống → 0 điểm)

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-LEARN-02 |
| **File** | `tests/04-exercise.spec.ts` |
| **Mô tả** | Lấy câu hỏi bài tập và nộp **không chọn đáp án** |
| **API** | GET `.../exercise-lessons/generation-question/{EXERCISE_ID}` · POST `.../time-on-task` `{ type: 1, time, lessonId }` |
| **PASS** | Generate có câu hỏi · response nộp `totalResults = 0` · thời gian nộp ≤ 4s |
| **WARNING** | Nộp OK · `4s < t ≤ 6s` |
| **FAIL** | Generate/nộp lỗi · `totalResults ≠ 0` · hoặc `t > 6s` |

---

### TC-06 — Bài kiểm tra

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-LEARN-03 |
| **File** | `tests/05-exam.spec.ts` |
| **Mô tả** | Mở UI làm bài kiểm tra + generate ma trận + nộp trống → 0 điểm |
| **UI** | Từ trang bài học → **Bài kiểm tra kiến thức** → Làm lại → `/lam-bai-kiem-tra?...` · thấy **Nộp bài** |
| **API generate** | POST `.../select-question-matrices/generation-pursuit-matrix` |
| **API nộp** | POST `.../time-on-task` `{ type: 2, time, lessonId: EXAM_ID }` |
| **PASS** | UI có Nộp bài · generate có câu hỏi · `totalResults = 0` |
| **FAIL** | Không mở được đề · generate/nộp lỗi · điểm khác 0 khi nộp trống |

---

### TC-07 — Luyện toán

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-LEARN-04 |
| **File** | `tests/06-practice.spec.ts` |
| **Mô tả** | Danh sách vòng luyện + generate đề + mở UI làm luyện |
| **UI list** | `/luyen-toan?training={PRACTICE_ID}` · thấy **Ôn luyện vòng…** · **Luyện lại / Luyện ngay** |
| **UI làm bài** | `/lam-luyen-thi?frameIds=...&training_exam_id=...&training_exam_round_id=...` · thấy **Nộp bài** |
| **API generate** | POST `.../training-exam-tests-web/generation-question-exam` `{ roundId, type: 2, enumLang }` |
| **PASS** | List hiển thị · generate OK · UI làm bài có Nộp bài |
| **FAIL** | Không load list / đề / trang làm bài |
| **Ghi chú** | Phase này **chưa** assert nộp trống luyện → 0 điểm (khác bài tập/kiểm tra) |

---

### TC-08 — E2E sau login: bài giảng + bài tập

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-E2E-01 |
| **File** | `tests/07-e2e-lesson-exercise.spec.ts` |
| **Mô tả** | Một phiên: Login → mở bài học → video phát → vào bài tập UI → nộp trống → 0 điểm |
| **PASS** | Video `currentTime > 0` · vào `/lam-bai-tap` · nộp `totalResults = 0` · UI hiện hoàn thành |
| **FAIL** | Video không load · không mở bài tập · nộp lỗi / điểm ≠ 0 |

---

### TC-09 — Visual regression (trang ổn định)

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-VISUAL-01 |
| **File** | `tests/08-visual.spec.ts` |
| **Mô tả** | So khớp ảnh chụp (`toHaveScreenshot`) với baseline cho 3 trang ổn định: form đăng nhập (logged out), trang bài học, danh sách luyện toán |
| **Baseline** | `tests/08-visual.spec.ts-snapshots/` (commit vào repo) |
| **PASS** | Ảnh khớp baseline trong dung sai `maxDiffPixelRatio: 0.05`; vùng động (`video`, header `SBD:`) được mask |
| **FAIL** | Lệch layout/UI vượt dung sai |
| **Ghi chú** | KHÔNG chụp trang làm bài kiểm tra/luyện (câu hỏi random → false-fail). Cập nhật baseline có chủ đích: `npm run test:update-snapshots`. Ảnh baseline gắn nền tảng (vd. `-win32`) — cần chạy cùng OS với máy tạo baseline. |

---

### TC-10 — Login + Logout V5

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-AUTH-03 |
| **File** | `tests/990-v5-auth.spec.ts` (tự đăng nhập riêng, KHÔNG dùng chung storageState của V6 — chạy sau `99-logout.spec.ts`) |
| **Mô tả** | Học sinh đăng nhập + đăng xuất thành công trên V5 (`trangnguyen.edu.vn`), cùng tài khoản với V6 |
| **PASS** | Thấy `SBD:` sau login, mất `SBD:` sau logout · mỗi thao tác `t ≤ 4s` |
| **WARNING** | Thao tác OK · `4s < t ≤ 6s` |
| **FAIL** | Login/logout thất bại · hoặc `t > 6s` |
| **Ghi chú** | V5 có UI khác V6: nút mở dropdown profile là `button[aria-haspopup]` riêng (không phải click thẳng chữ SBD), và đăng xuất **không có** dialog xác nhận "Đồng ý". |

---

### TC-11 — Luồng chuyển hệ V5 ↔ V6 ↔ VNMF

| Mục | Nội dung |
|-----|----------|
| **Mã** | TC-SWITCH-01 |
| **File** | `tests/991-v-switch.spec.ts` (chạy sau `99-logout.spec.ts`, sau TC-10) |
| **Mô tả** | Kiểm tra 4 hướng chuyển hệ, chỉ verify điều hướng đúng đích + trang load thành công |
| **V5→V6** | Click link "VNMF" trên header V5 → tới thẳng `tnmath.edu.vn` (không cần login) |
| **V6→VNMF** | Click link "VNMF" trên header/footer V6 → tới `vnmf.edu.vn` |
| **VNMF→V6** | Click nút "Đăng nhập" trên VNMF → SSO (có thể tự động, có thể hiện lại form tuỳ phiên) → về `tnmath.edu.vn`, thấy `SBD:` |
| **V6→V5** | Từ trang `/thi-toan` (đã login), click "Thi ngay" → qua trung gian `thi.trangnguyen.edu.vn` → bounce logout/login SSO → đích cuối `trangnguyen.edu.vn`, thấy `SBD:` |
| **PASS** | Mỗi hướng điều hướng đúng host đích, trang load thành công |
| **FAIL** | Điều hướng sai / không load được / lỗi hiển thị |
| **Ghi chú** | KHÔNG verify flicker UI (không automate được). Case "V6→V5" tự đăng nhập riêng (không dùng session dùng chung) vì bản thân luồng này gọi logout SSO toàn realm. |

---

## 6. Báo cáo Discord

Sau mỗi lần chạy suite, gửi **1 tin** gồm:

1. **Tổng kết:** PASSED / FAILED + số PASS / WARNING / FAIL / SKIP  
2. **PASS:** danh sách case + thời gian đo thao tác (nếu có)  
3. **WARNING:** case chậm (4–6s) + chi tiết  
4. **FAIL / ERROR:** case lỗi + message ngắn  

Ngưỡng thời gian ghi rõ trên tin: Pass ≤ 4s · Warning ≤ 6s · Fail > 6s.

---

## 7. Mapping file test ↔ SRS

| File | Mã TC |
|------|--------|
| `auth.setup.ts` | TC-AUTH-01 |
| `02-menus.spec.ts` | TC-UI-01 |
| `03-video.spec.ts` | TC-LEARN-01 |
| `04-exercise.spec.ts` | TC-LEARN-02 |
| `05-exam.spec.ts` | TC-LEARN-03 |
| `06-practice.spec.ts` | TC-LEARN-04 |
| `07-e2e-lesson-exercise.spec.ts` | TC-E2E-01 |
| `08-visual.spec.ts` | TC-VISUAL-01 |
| `99-logout.spec.ts` | TC-AUTH-02 |
| `990-v5-auth.spec.ts` | TC-AUTH-03 |
| `991-v-switch.spec.ts` | TC-SWITCH-01 |

---

## 8. Cách chạy

```bash
npm install
npx playwright install chromium
cp .env.example .env   # điền STUDENT_USER, STUDENT_PASS, DISCORD_WEBHOOK_URL
npm test
```

---

## 9. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả |
|-----------|------|--------|
| 1.0 | 2026-09-21 | SRS phase 1: Auth, Menu, Video, Bài tập, Kiểm tra, Luyện (prod V6) |
| 1.1 | 2026-09-21 | Sửa mapping TC-01/TC-02 khớp tên file thật (`auth.setup.ts` / `99-logout.spec.ts`); thêm TC-09 Visual regression (`08-visual.spec.ts`) |
| 1.2 | 2026-09-21 | Phase 2: thêm TC-10 (Login/Logout V5) + TC-11 (Luồng chuyển hệ V5↔V6↔VNMF); đưa "Chuyển hệ" ra khỏi mục ngoài phạm vi; ghi nhận ràng buộc hệ thống "1 phiên/tài khoản" (mục 3) |
