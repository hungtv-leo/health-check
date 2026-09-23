# Auto-check Trạng Nguyên

Health-check Playwright trên prod. Hai suite tách nhau, mỗi suite một báo cáo Discord.

| Suite | Lệnh | Nội dung |
| --- | --- | --- |
| Auto Check Web Học Thi | `npm test` | V5, V6, VNMF |
| Auto Check Web Quản Trị | `npm run test:cms` | CMS2 và Quản trị. Hệ chưa có tài khoản thì skip |

## Setup

```powershell
npm install
npx playwright install chromium
Copy-Item .env.example .env
```

Điền `.env` trên máy chạy. File này không commit. URL và content ID trong `.env.example` để nguyên.

## Chạy

```powershell
npm test                  # Web Học Thi
npm run test:cms          # Web Quản Trị
npm run test:headed       # xem trình duyệt (Học Thi)
npm run test:report       # mở HTML report
```

Task `Auto-check` chạy cả hai suite mỗi ngày lúc 16:30 qua `scripts/run-checks.ps1`.
