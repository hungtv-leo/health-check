import { test } from '@playwright/test';

/**
 * Sheet "Quản trị các V - Test case" có case, nhưng chưa có tài khoản
 * (cột Ghi chú: "Chưa cấp tk chạy test"). CMS6 bỏ khỏi đợt này vì URL chưa chốt.
 */
const pending = [
  ['HC-CMS5', 'CMS5', 'https://admin.infra.trangnguyen.edu.vn/'],
  ['HC-NOIBO', 'Nội bộ', 'https://noibo.trangnguyen.edu.vn/'],
  ['HC-CMSNEW', 'Cms new', 'https://cms-news.trangnguyen.edu.vn/'],
  ['HC-ADMVNMF', 'Admin vnmf', 'https://vnmf.edu.vn/admin'],
] as const;

for (const [id, name] of pending) {
  test.describe(`${id} · ${name}`, () => {
    for (const step of ['01 Đăng nhập', '02 Kiểm tra TẤT CẢ menu chính', '03 Đăng xuất'] as const) {
      test(`${id}-${step.slice(0, 2)} · ${step.slice(3)}`, () => {
        test.skip(true, 'Chưa cấp tài khoản chạy test');
      });
    }
  });
}
