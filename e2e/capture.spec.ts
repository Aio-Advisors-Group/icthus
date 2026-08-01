import { expect, test } from '@playwright/test';

/** The contest flow: bring something real → Scripture → save → delete. */
test.describe('life-first capture flow', () => {
  test('submits a reflection and receives a source-grounded response', async ({ page }) => {
    await page.goto('/capture');

    await page
      .getByLabel('What is happening in your life today?')
      .fill('I am completely exhausted and burdened by everything at work right now.');
    await page.getByRole('button', { name: 'Discern' }).click();
    await page.getByRole('button', { name: 'Find a place to begin' }).click();

    await expect(page).toHaveURL(/\/entry\//);

    // The response contract, as rendered.
    await expect(page.getByRole('heading', { name: 'A reflection' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A prayer to begin with' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'One next step' })).toBeVisible();
    await expect(page.getByText('Matthew 11:28-30').first()).toBeVisible();
    await expect(page.getByText(/World English Bible/i).first()).toBeVisible();

    // Every displayed claim traces to a source record.
    await page.getByText(/Sources used \(\d+\)/).click();
    await expect(page.getByText('web:matthew-11-28')).toBeVisible();

    // The rationale is an invitation, not an instruction.
    await page.getByText('Why this passage?').click();
    await expect(page.getByText(/may meet you here|may be relevant|may help/i)).toBeVisible();
  });

  test('saves a prayer and then deletes the whole reflection', async ({ page }) => {
    await page.goto('/capture');
    await page
      .getByLabel('What is happening in your life today?')
      .fill('I am so grateful today and full of thanks for the people around me.');
    await page.getByRole('button', { name: 'Find a place to begin' }).click();
    await expect(page).toHaveURL(/\/entry\//);

    await page.getByRole('button', { name: 'Save prayer' }).click();
    await expect(page.getByRole('status')).toContainText('Prayer saved');

    await page.getByRole('link', { name: 'Saved' }).first().click();
    await expect(page).toHaveURL(/\/saved$/);
    await page.getByRole('tab', { name: 'Prayers' }).click();
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();

    // Reflections list, then delete the entry itself.
    await page.getByRole('heading', { name: 'Your reflections' }).scrollIntoViewIfNeeded();
    await page.getByText('I am so grateful today').first().click();
    await expect(page).toHaveURL(/\/entry\//);

    await page.getByRole('button', { name: 'Delete this reflection' }).click();
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByText('I am so grateful today')).toHaveCount(0);
  });

  test('an offline draft survives leaving the screen', async ({ page }) => {
    await page.goto('/capture');
    await page.getByLabel('What is happening in your life today?').fill('A half-written thought');
    // Give the debounced autosave a moment.
    await page.waitForTimeout(700);

    await page.getByRole('link', { name: 'Today' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('link', { name: 'Capture' }).first().click();

    await expect(page.getByLabel('What is happening in your life today?')).toHaveValue(
      'A half-written thought',
    );
    await expect(page.getByText('Restored from an unfinished draft')).toBeVisible();
  });

  test('crisis input returns support rather than devotional content', async ({ page }) => {
    await page.goto('/capture');
    await page
      .getByLabel('What is happening in your life today?')
      .fill('I do not want to be alive anymore.');

    // Warned before submitting, not only after.
    await expect(page.getByText('Before you go on')).toBeVisible();

    await page.getByRole('button', { name: 'Find a place to begin' }).click();
    await expect(page).toHaveURL(/\/entry\//);

    await expect(page.getByText(/Local emergency services/)).toBeVisible();
    await expect(page.getByText(/not emergency, medical, or crisis support/i)).toBeVisible();
    // Devotional structure must be absent on this path.
    await expect(page.getByRole('heading', { name: 'A reflection' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'One next step' })).toHaveCount(0);
  });

  test('quick-start chips seed the composer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'I feel anxious' }).click();
    await expect(page).toHaveURL(/\/capture\?prompt=/);
    await expect(page.getByLabel('What is happening in your life today?')).toHaveValue(
      /I feel anxious/,
    );
  });
});
