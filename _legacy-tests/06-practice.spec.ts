import { test, expect } from '@playwright/test';
import { assertLoggedIn, dismissPopups } from '../src/pages/auth';
import { practiceAttemptUrl, practiceListUrl } from '../src/config';
import { generatePracticeQuestions } from '../src/api/learning';

test.describe('Learning · Luyện toán', { tag: ['@critical'] }, () => {
  test('Danh sách vòng luyện + generate đề + UI làm luyện thi', async ({ page }) => {
    await assertLoggedIn(page);
    await dismissPopups(page);

    await page.goto(practiceListUrl(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await expect(page.getByText(/Ôn luyện vòng/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Luyện lại|Luyện ngay/i).first()).toBeVisible();

    const gen = await generatePracticeQuestions(page);
    expect([200, 201]).toContain(gen.res.status());
    expect(gen.body.code, gen.text).toBe(200);
    expect(gen.body.data, gen.text).toBeTruthy();

    await page.goto(practiceAttemptUrl(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await expect(page.getByRole('button', { name: /nộp bài/i }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('body')).toContainText(/Ôn luyện vòng|Còn lại|Nộp bài/i);
  });
});
