import { test, expect } from '@playwright/test';

test.describe('Production notes (lines starting with >)', () => {
  test('lines starting with > are hidden from the teleprompter', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/open');
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    });
    await page.reload();
    await page.waitForSelector('[class*="sourceName"]');

    const content = [
      'Welcome to the show',
      '> Director: pause for 3 seconds here',
      'Let us begin the first act',
      '  > indented stage cue',
      'This line should be visible',
      '>> nested production note',
      'Final line spoken aloud',
    ].join('\n');

    await page.evaluate(async (c) => {
      await navigator.clipboard.writeText(c);
    }, content);

    await page.keyboard.press('Meta+v');
    await page.waitForURL(/\/teleprompter\/?\?id=/);

    await expect(page.getByText('Welcome to the show')).toBeVisible();
    await expect(page.getByText('Let us begin the first act')).toBeVisible();
    await expect(page.getByText('This line should be visible')).toBeVisible();
    await expect(page.getByText('Final line spoken aloud')).toBeVisible();

    await expect(page.getByText('Director: pause for 3 seconds here')).toHaveCount(0);
    await expect(page.getByText('indented stage cue')).toHaveCount(0);
    await expect(page.getByText('nested production note')).toHaveCount(0);
  });
});
