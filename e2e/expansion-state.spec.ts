import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'teleprompter_expanded_sources';

test.describe('Expansion state persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/open');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  });

  test('my-scripts is expanded by default on first visit', async ({ page }) => {
    await page.goto('/open');

    // Wait for the source list to load
    await page.waitForSelector('[class*="sourceName"]');

    // Find the My Scripts header (use first() to avoid strict mode issue)
    const myScriptsHeader = page.locator('[class*="sourceHeader"]').filter({ hasText: 'My Scripts' }).first();
    await expect(myScriptsHeader).toBeVisible();

    // The chevron should be rotated (expanded state)
    const chevron = myScriptsHeader.locator('[class*="expandIcon"]');
    const chevronClass = await chevron.getAttribute('class');
    console.log('Chevron class:', chevronClass);

    // Check localStorage
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    console.log('Stored state:', stored);

    // Verify expanded state via class
    expect(chevronClass).toContain('expandIconExpanded');
  });

  test('collapsed state persists after page refresh', async ({ page }) => {
    await page.goto('/open');
    await page.waitForSelector('[class*="sourceName"]');

    // Click to collapse my-scripts
    const myScriptsHeader = page.locator('[class*="sourceHeader"]').filter({ hasText: 'My Scripts' }).first();
    await myScriptsHeader.click();

    // Wait for state to update
    await page.waitForTimeout(100);

    // Verify it's collapsed
    const chevron = myScriptsHeader.locator('[class*="expandIcon"]');
    let chevronClass = await chevron.getAttribute('class');
    console.log('After collapse, chevron class:', chevronClass);
    expect(chevronClass).not.toContain('expandIconExpanded');

    // Check localStorage after collapse
    const storedAfterCollapse = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    console.log('Stored after collapse:', storedAfterCollapse);

    // Refresh the page
    await page.reload();
    await page.waitForSelector('[class*="sourceName"]');

    // Check localStorage after reload
    const storedAfterReload = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    console.log('Stored after reload:', storedAfterReload);

    // Verify it's still collapsed
    const myScriptsHeaderAfter = page.locator('[class*="sourceHeader"]').filter({ hasText: 'My Scripts' });
    const chevronAfter = myScriptsHeaderAfter.locator('[class*="expandIcon"]');
    chevronClass = await chevronAfter.getAttribute('class');
    console.log('After reload, chevron class:', chevronClass);

    expect(chevronClass).not.toContain('expandIconExpanded');
  });

  test('expanded state persists after page refresh', async ({ page }) => {
    await page.goto('/open');
    await page.waitForSelector('[class*="sourceName"]');

    // my-scripts should be expanded by default
    const myScriptsHeader = page.locator('[class*="sourceHeader"]').filter({ hasText: 'My Scripts' });
    let chevron = myScriptsHeader.locator('[class*="expandIcon"]');
    let chevronClass = await chevron.getAttribute('class');
    console.log('Initial chevron class:', chevronClass);
    expect(chevronClass).toContain('expandIconExpanded');

    // Check localStorage
    const storedInitial = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    console.log('Initial stored state:', storedInitial);

    // Refresh the page
    await page.reload();
    await page.waitForSelector('[class*="sourceName"]');

    // Check localStorage after reload
    const storedAfterReload = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    console.log('Stored after reload:', storedAfterReload);

    // Verify it's still expanded
    const myScriptsHeaderAfter = page.locator('[class*="sourceHeader"]').filter({ hasText: 'My Scripts' });
    const chevronAfter = myScriptsHeaderAfter.locator('[class*="expandIcon"]');
    chevronClass = await chevronAfter.getAttribute('class');
    console.log('After reload, chevron class:', chevronClass);

    expect(chevronClass).toContain('expandIconExpanded');
  });
});
