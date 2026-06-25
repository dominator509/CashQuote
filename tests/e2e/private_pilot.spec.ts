import { expect, test } from '@playwright/test';

test('private pilot workflow reaches invoice print/export', async ({ page }) => {
  const unique = Date.now();
  const pilotEmail =
    process.env.PILOT_EMAIL_ALLOWLIST?.split(',')[0]?.trim() || `pilot-${unique}@example.com`;
  await page.addInitScript(() => {
    Object.defineProperty(window, 'print', {
      value: () => {
        window.localStorage.setItem('cashquote-print-called', 'true');
      },
    });
  });

  await page.goto('/');
  await expect(page.getByText('Pilot Login')).toBeVisible();

  await page.getByPlaceholder('Pilot email').fill(pilotEmail);
  await page.getByPlaceholder('Access code').fill(process.env.PILOT_ACCESS_CODE || 'e2e-pilot-code');
  await page.getByRole('button', { name: 'Pilot Login' }).click();

  await expect(page.getByText('Clients')).toBeVisible();
  await page.getByPlaceholder('Client name').fill(`Pilot Client ${unique}`);
  await page.getByPlaceholder('Email').fill(`client-${unique}@example.com`);
  await page.getByRole('button', { name: 'Create Client' }).click();
  await expect(page.getByText(`Pilot Client ${unique}`)).toBeVisible();

  const quoteBuilder = page.locator('form').filter({ hasText: 'Quote Builder' });
  await quoteBuilder.locator('select').selectOption({ label: `Pilot Client ${unique}` });
  await quoteBuilder.getByPlaceholder('Line item').fill('Private pilot readiness review');
  await quoteBuilder.getByPlaceholder('Price').fill('250');
  await quoteBuilder.getByRole('button', { name: 'Create Accepted Quote' }).click();

  await expect(page.getByText('$250.00')).toBeVisible();
  await page
    .locator('article')
    .filter({ hasText: `Pilot Client ${unique}` })
    .getByRole('button', { name: 'Convert' })
    .click();
  await expect(page.getByText('Quote converted to invoice.')).toBeVisible();

  await page.getByPlaceholder('Payment').fill('250');
  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByText('Payment recorded.')).toBeVisible();

  await page.getByRole('button', { name: 'Remind' }).last().click();
  await expect(page.getByText('Reminder scheduled.')).toBeVisible();
  const pendingReminder = page.locator('article').filter({ hasText: 'pending' }).first();
  await pendingReminder.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Reminder sent.')).toBeVisible();
  await page.locator('article').filter({ hasText: 'sent' }).first().getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByText('Reminder resolved.')).toBeVisible();

  await page.getByRole('button', { name: 'Print' }).click();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('cashquote-print-called')))
    .toBe('true');
});

test('unauthenticated users see the login workflow only', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Pilot Login')).toBeVisible();
  await expect(page.getByText('Quote Builder')).not.toBeVisible();
});
