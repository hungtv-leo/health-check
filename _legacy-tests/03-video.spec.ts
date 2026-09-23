import { test } from '@playwright/test';
import { assertLoggedIn, dismissPopups } from '../src/pages/auth';
import { openLessonPage, assertVideoPlaying } from '../src/pages/learning';

test.describe('Learning · Bài giảng video', { tag: ['@critical'] }, () => {
  test('Video load và currentTime tăng sau khi play', async ({ page }) => {
    await assertLoggedIn(page);
    await dismissPopups(page);
    await openLessonPage(page);
    await dismissPopups(page);
    await assertVideoPlaying(page);
  });
});
