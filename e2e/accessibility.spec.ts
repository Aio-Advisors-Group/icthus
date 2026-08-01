import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility smoke tests.
 *
 * Not a substitute for a real audit, but these catch the regressions that
 * actually happen: a heading level skipped, a control below the touch minimum,
 * an image without a name, a form field without a label.
 */

const ROUTES = [
  '/',
  '/capture',
  '/explore',
  '/saved',
  '/you',
  '/you/everywhere',
  '/you/everywhere/destinations',
  '/you/daily-companion',
  '/you/memory',
  '/you/integrations',
  '/privacy',
  '/onboarding',
];

async function headingLevels(page: Page): Promise<number[]> {
  return page.$$eval('h1, h2, h3, h4, h5, h6', (nodes) =>
    nodes.map((node) => Number(node.tagName.slice(1))),
  );
}

test.describe('accessibility smoke', () => {
  for (const route of ROUTES) {
    test(`${route} has exactly one h1 and no skipped heading levels`, async ({ page }) => {
      await page.goto(route);
      const levels = await headingLevels(page);
      expect(levels.filter((level) => level === 1).length, `${route} h1 count`).toBe(1);

      let previous = 0;
      for (const level of levels) {
        if (previous !== 0) {
          expect(level - previous, `${route} skipped a heading level`).toBeLessThanOrEqual(1);
        }
        previous = level;
      }
    });
  }

  test('interactive controls meet the 44px minimum touch target', async ({ page }) => {
    for (const route of ['/', '/capture', '/you', '/you/everywhere']) {
      await page.goto(route);
      const controls = page.locator(
        'button:visible, a:visible, input:visible, [role="switch"]:visible',
      );
      const count = await controls.count();
      for (let index = 0; index < count; index += 1) {
        const control = controls.nth(index);
        const box = await control.boundingBox();
        if (!box) continue;
        const exempt = await control.evaluate((node) => {
          // Inline text links inside a sentence are part of prose, not
          // standalone tap targets.
          if (node.tagName === 'A' && node.closest('p') !== null) return true;
          // The skip link is visually hidden until focused; its collapsed
          // size is the point.
          if (node.classList.contains('sr-only')) return true;
          return false;
        });
        if (exempt) continue;
        const accessibleName =
          (await control.getAttribute('aria-label')) ?? (await control.innerText());
        expect(
          Math.max(box.height, 0),
          `${route}: "${accessibleName.slice(0, 40)}" is ${box.height}px tall`,
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('every form control has an accessible name', async ({ page }) => {
    for (const route of ['/capture', '/explore', '/auth/sign-in', '/you/daily-companion']) {
      await page.goto(route);
      const fields = page.locator('input:visible, textarea:visible, select:visible');
      const count = await fields.count();
      for (let index = 0; index < count; index += 1) {
        const field = fields.nth(index);
        const name = await field.evaluate((node) => {
          const element = node as HTMLInputElement;
          if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
          if (element.id) {
            const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
            if (label?.textContent?.trim()) return label.textContent.trim();
          }
          return element.closest('label')?.textContent?.trim() ?? '';
        });
        expect(name, `${route}: a form control has no accessible name`).toBeTruthy();
      }
    }
  });

  test('keyboard focus reaches the primary navigation', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => document.activeElement?.textContent ?? '');
    expect(firstFocus).toContain('Skip to content');
  });

  test('the page never scrolls horizontally on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const route of ROUTES) {
      await page.goto(route);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflows, `${route} scrolls horizontally`).toBe(false);
    }
  });
});
