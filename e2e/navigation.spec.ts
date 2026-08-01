import { expect, test, type Page } from '@playwright/test';

/**
 * Navigation is tested first and hardest because the prototype's biggest
 * structural flaw was using hidden sheets as its only routing mechanism. Every
 * assertion here is about a real, addressable, clickable route.
 */

/** Fails the test if any uncaught error or console error occurs. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.describe('bottom navigation', () => {
  test('every bottom-nav item navigates visibly', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();

    await nav.getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByRole('heading', { name: 'Explore', level: 1 })).toBeVisible();

    await nav.getByRole('link', { name: 'Capture' }).click();
    await expect(page).toHaveURL(/\/capture$/);
    await expect(
      page.getByRole('heading', { name: 'Bring what is real.', level: 1 }),
    ).toBeVisible();

    await nav.getByRole('link', { name: 'Saved' }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByRole('heading', { name: 'Saved', level: 1 })).toBeVisible();

    await nav.getByRole('link', { name: 'You' }).click();
    await expect(page).toHaveURL(/\/you$/);
    await expect(page.getByRole('heading', { name: 'You', level: 1 })).toBeVisible();

    await nav.getByRole('link', { name: 'Today' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Bring what is real.' })).toBeVisible();

    expect(errors, `Navigation produced errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('bottom navigation stays clickable above page content', async ({ page }) => {
    await page.goto('/');
    // Scroll to the bottom, where an overlay or a stacking-context bug would
    // most plausibly swallow the nav. (mouse.wheel is unsupported on mobile
    // WebKit, so scroll the document directly.)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const youLink = page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'You' });
    await expect(youLink).toBeVisible();
    await youLink.click();
    await expect(page).toHaveURL(/\/you$/);
  });

  test('no JavaScript startup error prevents navigation', async ({ page }) => {
    const errors = trackErrors(page);
    for (const path of ['/', '/explore', '/capture', '/saved', '/you', '/privacy', '/onboarding']) {
      await page.goto(path);
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('deep links load directly on refresh', async ({ page }) => {
    for (const path of [
      '/you/everywhere',
      '/you/everywhere/destinations',
      '/you/everywhere/destinations/slack',
      '/you/everywhere/schedule',
      '/you/daily-companion',
      '/you/memory',
      '/you/integrations',
      '/study/matthew-11-28-30',
    ]) {
      await page.goto(path);
      await page.reload();
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('an unknown route shows a real not-found screen', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText('There is nothing at this address')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });
});
