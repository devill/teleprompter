import { test, expect } from '@playwright/test';

test.describe('Paste creates script', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/open');

    // Clear IndexedDB for clean state
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    });

    // Reload to pick up clean state
    await page.reload();
    await page.waitForSelector('[class*="sourceName"]');
  });

  test('paste creates new script and navigates to teleprompter', async ({ page }) => {
    const testContent = 'This is my test script content for the teleprompter.';

    // Write test content to clipboard
    await page.evaluate(async (content) => {
      await navigator.clipboard.writeText(content);
    }, testContent);

    // Simulate Cmd+V keypress (Meta+v for Mac, but Playwright handles it)
    await page.keyboard.press('Meta+v');

    // Wait for navigation to /teleprompter
    await page.waitForURL(/\/teleprompter\/?\?id=/);

    // Verify URL contains /teleprompter
    expect(page.url()).toMatch(/\/teleprompter/);

    // Verify the pasted content is visible on the page
    await expect(page.getByText(testContent)).toBeVisible();
  });

  test('paste extracts script name from first line of content', async ({ page }) => {
    const scriptTitle = 'TUNNELBAHN FLEISSALM SCRIPT';
    const testContent = `${scriptTitle}\n\nWelcome everyone to this presentation.`;

    // Write test content to clipboard
    await page.evaluate(async (content) => {
      await navigator.clipboard.writeText(content);
    }, testContent);

    // Simulate paste
    await page.keyboard.press('Meta+v');

    // Wait for navigation to /teleprompter
    await page.waitForURL(/\/teleprompter\/?\?id=/);

    // Go back to /open to check the script name
    await page.goto('/open');
    await page.waitForSelector('[class*="sourceName"]');

    // Expand My Scripts if collapsed
    const myScriptsChevron = page.locator('[class*="sourceHeader"]')
      .filter({ hasText: 'My Scripts' })
      .locator('[class*="expandIcon"]');
    const chevronClass = await myScriptsChevron.getAttribute('class');
    if (!chevronClass?.includes('expandIconExpanded')) {
      await page.locator('[class*="sourceHeader"]').filter({ hasText: 'My Scripts' }).click();
    }

    // Verify the script was created with the extracted title
    await expect(page.locator('[class*="fileLink"]').filter({ hasText: scriptTitle })).toBeVisible();
  });

  test('paste in rename field does not create new script', async ({ page }) => {
    // First, create a script manually using the + button in My Scripts
    const newScriptButton = page.locator('[title="New Script"]');
    await newScriptButton.click();

    // Wait for the script to appear in the list
    await page.waitForSelector('[class*="fileLink"]');

    // Verify we're still on /open
    expect(page.url()).toContain('/open');

    // Click the rename button to start editing
    const renameButton = page.locator('[title="Rename script"]').first();
    await renameButton.click();

    // Wait for the input field to appear and be focused
    const renameInput = page.locator('[class*="nameInput"]');
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toBeFocused();

    // Write content to clipboard
    await page.evaluate(async () => {
      await navigator.clipboard.writeText('pasted name');
    });

    // Simulate paste while input is focused
    await page.keyboard.press('Meta+v');

    // Wait a moment to ensure no navigation occurs
    await page.waitForTimeout(500);

    // Verify we did NOT navigate away from /open
    expect(page.url()).toContain('/open');
    expect(page.url()).not.toContain('/teleprompter');

    // The input should still be visible (we're still in edit mode)
    await expect(renameInput).toBeVisible();
  });
});
