import { test, expect } from '@playwright/test';

const SETTINGS_KEY = 'autolektor_teleprompter_settings';

async function readPresenterMode(page: import('@playwright/test').Page) {
  return await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { presenterMode?: boolean }).presenterMode ?? false;
    } catch {
      return null;
    }
  }, SETTINGS_KEY);
}

test.describe('Presenter clicker mode button', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/open');
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      localStorage.clear();
    });
    await page.reload();
    await page.waitForSelector('[class*="sourceName"]');
  });

  test('button toggles presenter mode setting and persists it', async ({ page }) => {
    const content = '# Section One\n\nFirst paragraph.\n\nSecond paragraph.\n\n# Section Two\n\nThird paragraph.';

    await page.evaluate(async (c) => {
      await navigator.clipboard.writeText(c);
    }, content);
    await page.keyboard.press('Meta+v');
    await page.waitForURL(/\/teleprompter\/?\?id=/);

    await page.mouse.move(400, 400);

    const presenterButton = page.getByRole('button', { name: '🎮' });
    await expect(presenterButton).toBeVisible();

    // No setting persisted yet
    expect(await readPresenterMode(page)).toBeFalsy();

    // Enable
    await presenterButton.click();
    await expect.poll(() => readPresenterMode(page)).toBe(true);

    // Reload — should persist
    await page.reload();
    await page.mouse.move(400, 400);
    expect(await readPresenterMode(page)).toBe(true);

    // Disable
    const reloadedButton = page.getByRole('button', { name: '🎮' });
    await reloadedButton.click();
    await expect.poll(() => readPresenterMode(page)).toBe(false);
  });
});
