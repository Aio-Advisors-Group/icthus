import { expect, test } from '@playwright/test';

test.describe('You and Icthus Everywhere', () => {
  test('You shows a clickable Icthus Everywhere card that routes correctly', async ({ page }) => {
    await page.goto('/you');
    const card = page.getByRole('link', { name: /Icthus Everywhere/ });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/you\/everywhere$/);
    await expect(page.getByRole('heading', { name: 'Icthus Everywhere' })).toBeVisible();
  });

  test('browses the destination catalog and honours capability labels', async ({ page }) => {
    await page.goto('/you/everywhere');
    await page.getByRole('link', { name: '+ Add a destination' }).click();
    await expect(page).toHaveURL(/\/you\/everywhere\/destinations$/);

    // The prototype's five groups.
    for (const group of [
      'Productivity',
      'AI Assistants',
      'Messaging',
      'Social',
      'On your device',
    ]) {
      await expect(page.getByRole('heading', { name: group })).toBeVisible();
    }

    // Honest classification, visible in the catalog itself.
    const whatsapp = page.getByRole('link', { name: /WhatsApp/ });
    await expect(whatsapp).toContainText('Ready to share');
    await expect(page.getByRole('link', { name: /Lock Screen widget/ })).toContainText(
      'Future native extension',
    );
    // A credential-gated destination must not read "Connected" in a browse
    // list, where it would look like a statement of current state.
    await expect(page.getByRole('link', { name: /Slack/ })).toContainText('Needs connecting');
    await expect(page.getByRole('link', { name: /Notion/ })).not.toContainText(/^Connected$/);
  });

  test('a ready-to-share destination cannot be scheduled to send automatically', async ({
    page,
  }) => {
    await page.goto('/you/everywhere/destinations/whatsapp');
    await expect(page.getByText('Ready to share').first()).toBeVisible();
    await expect(page.getByText(/It cannot post here on its own/)).toBeVisible();
    await expect(page.getByText(/would require WhatsApp Business API approval/)).toBeVisible();
    // No scheduling section exists for a destination that cannot self-deliver.
    await expect(page.getByRole('heading', { name: 'When' })).toHaveCount(0);
  });

  test('a future-native destination cannot be enabled at all', async ({ page }) => {
    await page.goto('/you/everywhere/destinations/lock_screen_widget');
    await expect(page.getByText('Cannot be enabled')).toBeVisible();
    await expect(page.getByRole('switch', { name: /Enable Lock Screen widget/ })).toBeDisabled();
    await expect(page.getByText(/native WidgetKit extension/)).toBeVisible();
  });

  test('Apple Notes does not claim background sync', async ({ page }) => {
    await page.goto('/you/everywhere/destinations/apple_notes');
    await expect(page.getByText(/cannot sync with Apple Notes/i)).toBeVisible();
  });

  test('adds, tests, pauses and revokes a route', async ({ page }) => {
    await page.goto('/you/everywhere/destinations/icthus_saved');

    await page.getByRole('switch', { name: /Enable Your Saved collection/ }).click();
    await page.getByRole('switch', { name: /Send Daily Scripture/ }).click();
    await page.getByRole('button', { name: 'Save destination' }).click();
    await expect(page).toHaveURL(/\/you\/everywhere$/);
    await expect(page.getByText('Your Saved collection').first()).toBeVisible();

    // Test delivery runs the real adapter for this capability class.
    await page.getByRole('link', { name: /Your Saved collection/ }).click();
    await page.getByRole('button', { name: 'Send a test' }).click();
    await expect(page.getByRole('status')).toContainText(/Test delivered|prepared/);

    // Pause.
    await page.getByRole('switch', { name: /Pause Your Saved collection/ }).click();
    await page.getByRole('button', { name: 'Save destination' }).click();
    await expect(page.getByText('Paused')).toBeVisible();

    // Scheduled-task history reflects it, content-free.
    await page.getByRole('link', { name: 'View scheduled tasks' }).click();
    await expect(page).toHaveURL(/\/you\/everywhere\/schedule$/);
    await expect(page.getByRole('heading', { name: 'Delivery history' })).toBeVisible();
    await expect(page.getByText(/Icthus never records the content/)).toBeVisible();

    // Revoke and delete.
    await page.goto('/you/everywhere/destinations/icthus_saved');
    await page.getByRole('button', { name: 'Revoke and delete this route' }).click();
    await expect(page).toHaveURL(/\/you\/everywhere$/);
    await expect(page.getByText('No destinations yet')).toBeVisible();
  });

  test('routing a raw journal entry requires a separate confirmation', async ({ page }) => {
    await page.goto('/you/everywhere/destinations/icthus_saved');
    await page.getByRole('switch', { name: /Enable Your Saved collection/ }).click();
    await page.getByRole('switch', { name: /Send Journal entry or excerpt/ }).click();

    await expect(page.getByText('This sends your own words')).toBeVisible();
    // It is not switched on by the first click.
    await expect(
      page.getByRole('switch', { name: /Send Journal entry or excerpt/ }),
    ).toHaveAttribute('aria-checked', 'false');

    await page.getByRole('button', { name: 'I understand — allow it' }).click();
    await expect(
      page.getByRole('switch', { name: /Send Journal entry or excerpt/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Daily Devotional Companion', () => {
  test('toggles inputs and runs a deterministic flow with an inspectable transcript', async ({
    page,
  }) => {
    await page.goto('/you');
    await page.getByRole('link', { name: /Daily Devotional Companion/ }).click();
    await expect(page).toHaveURL(/\/you\/daily-companion$/);

    // Providers report their real state, never a fake "Connected".
    await expect(page.getByText('Local sample content').first()).toBeVisible();
    await expect(page.getByText('Gloo is not connected in this build')).toBeVisible();

    // Without Gloo consent the question is composed but not sent.
    await page.getByRole('button', { name: 'Run now' }).click();
    await expect(page.getByText('Degraded').first()).toBeVisible();
    await expect(page.getByText('Composed — not sent').first()).toBeVisible();

    // With consent, the run completes against the local adapter and says so.
    await page
      .getByRole('switch', { name: /Allow Icthus to send a bounded question to Gloo/ })
      .click();
    await page.getByRole('button', { name: 'Run now' }).click();
    await expect(page.getByText('Complete').first()).toBeVisible();
    await expect(page.getByText('What it read:').first()).toBeVisible();
    await expect(page.getByText(/GLOO — LOCAL SAMPLE CONTENT/i).first()).toBeVisible();

    // Input consent is a separate control and is reflected in the transcript.
    await expect(page.getByText(/Inputs allowed for this run/).first()).toBeVisible();
  });

  test('blocks a run when no inputs are selected', async ({ page }) => {
    await page.goto('/you/daily-companion');
    await page.getByRole('switch', { name: /Allow the companion to read Today’s capture/ }).click();
    await page.getByRole('button', { name: 'Run now' }).click();
    await expect(page.getByText('Blocked')).toBeVisible();
    await expect(page.getByText(/nothing for Icthus to read/)).toBeVisible();
  });
});

test.describe('Memory', () => {
  test('is off by default and reveals nothing until opted in', async ({ page }) => {
    await page.goto('/you/memory');
    await expect(page.getByText('Memory is off')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What Memory has noticed' })).toHaveCount(0);

    await page.getByRole('switch', { name: 'Turn Memory on' }).click();
    await expect(page.getByText('Memory is on')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What Memory has noticed' })).toBeVisible();
    // With too few entries it stays quiet rather than inventing a pattern.
    await expect(page.getByText(/Memory stays quiet until it has real evidence/)).toBeVisible();
  });
});

test.describe('Integration honesty', () => {
  test('the connections screen never claims an unconfigured provider is live', async ({ page }) => {
    await page.goto('/you/integrations');
    await expect(page.getByText('YouVersion Platform').first()).toBeVisible();
    await expect(page.getByText('Gloo AI Studio').first()).toBeVisible();
    await expect(
      page.getByText(/Icthus will not show something as connected when it is not/),
    ).toBeVisible();
    // No provider is configured in this build, so no badge may read "Connected".
    await expect(page.getByText('Connected', { exact: true })).toHaveCount(0);
  });
});
