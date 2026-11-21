import { expect, test, type Page } from '@playwright/test';

const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
function monthStart(offset: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + offset, 1);
  return { label: longDate.format(date), id: date.toISOString().slice(0, 10) };
}

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const credentials = [
  [process.env.KINETIX_E2E_EMAIL, process.env.KINETIX_E2E_PASSWORD],
  [process.env.KINETIX_E2E_EMAIL_B, process.env.KINETIX_E2E_PASSWORD_B],
];

function testCredentials(account: number) {
  const [email, password] = credentials[account];
  if (!email || !password || credentials[0][0] === credentials[1][0])
    throw new Error('Two distinct private test identities are required');
  return { email, password };
}

async function request(account: number, path: string, method = 'GET', body?: unknown) {
  const { email, password } = testCredentials(account);
  const response = await fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function signIn(page: Page, account: number) {
  const { email, password } = testCredentials(account);
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('button', { name: 'Open profile', exact: true })).toBeVisible();
}

async function openProgress(page: Page) {
  await page.getByRole('tab', { name: 'Feed', exact: true }).click();
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Main navigation' })).toHaveCount(0);
}

test('records private body trends, syncs profile values, and retains a weight target after reload', async ({
  page,
}) => {
  test.setTimeout(120000);
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Use a run-owned isolated test database and APP_ENV=test');

  for (const account of [0, 1]) {
    await request(account, '/me/profile', 'PATCH', {
      display_name: account ? 'Progress Bob' : 'Progress Alice',
      age: 30,
      height_cm: '170.00',
      weight_kg: '70.000000',
      measurement_system: 'metric',
      timezone: 'UTC',
    });
    await request(account, '/me/objective', 'PUT', { objective: 'gain_weight' });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 0);
  await openProgress(page);
  await page.getByRole('tab', { name: 'Waist', exact: true }).click();
  await expect(page.getByTestId('body-measurement-chart')).toBeVisible();
  await expect(page.getByText('No waist measurements yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^\d{4}-\d{2}-\d{2},/ })).toHaveCount(0);
  await page.screenshot({ path: '.codex/artifacts/previews/body-progress-empty.png' });

  await page.getByRole('button', { name: 'Log measurements', exact: true }).click();
  await expect(page.getByLabel('Weight (kg)', { exact: true })).toHaveValue('70.00');
  await expect(page.getByLabel('Height (cm)', { exact: true })).toHaveValue('170.00');
  await page.screenshot({
    path: '.codex/artifacts/previews/body-progress-log-editor.png',
    animations: 'disabled',
  });
  await page.getByLabel('Height (cm)', { exact: true }).clear();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('83.25');
  await page.getByLabel('Waist (cm)', { exact: true }).fill('84.50');

  const measurementRoute = '**/api/v1/me/body-measurements';
  let forwardedStatus = 0;
  await page.route(measurementRoute, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    // Commit the write but drop the response to exercise the real API's retry contract.
    const upstream = await route.fetch();
    forwardedStatus = upstream.status();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Save measurements', exact: true }).click();
  await expect(page.getByText('Could not save your measurements. Try again.')).toBeVisible();
  expect(forwardedStatus).toBe(201);
  await expect(page.getByLabel('Weight (kg)', { exact: true })).toHaveValue('83.25');
  await page.unroute(measurementRoute);
  await page.getByRole('button', { name: 'Save measurements', exact: true }).click();
  await expect(page.getByLabel('Weight (kg)', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('body-measurement-chart')).toBeVisible();
  const one = await request(0, '/me/body-measurements');
  expect(one.items.filter((item: { waist_cm: string | null }) => item.waist_cm)).toHaveLength(1);
  expect((await request(0, '/auth/me')).profile.weight_kg).toBe('83.250000');

  await page.getByRole('button', { name: 'Log measurements', exact: true }).click();
  const backfill = monthStart(-1);
  await expect(page.getByLabel('Waist (cm)', { exact: true })).toHaveValue('84.50');
  await page.getByLabel('Height (cm)', { exact: true }).clear();
  await page.getByRole('button', { name: 'Measurement date', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Measurement date', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save measurements', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next month', exact: true })).toBeDisabled();
  await page.screenshot({
    path: '.codex/artifacts/previews/body-progress-date-picker.png',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await page.getByRole('button', { name: `Select ${backfill.label}`, exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('71');
  await page.getByLabel('Waist (cm)', { exact: true }).fill('81');
  await page.getByRole('button', { name: 'Save measurements', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Measurement date', exact: true })).toHaveCount(0);
  const backfilledPoint = page.getByRole('button', {
    name: `${backfill.id}, 81.00 cm`,
    exact: true,
  });
  await backfilledPoint.click({ timeout: 6000 });
  await expect(backfilledPoint).toHaveAttribute('aria-selected', 'true');
  await backfilledPoint.click({ timeout: 6000 });
  const ordered = await request(0, '/me/body-measurements');
  expect(ordered.items[0]).toMatchObject({ date: backfill.id, waist_cm: '81.00' });
  expect((await request(0, '/auth/me')).profile.weight_kg).toBe('83.250000');

  await page.getByRole('button', { name: 'Set target', exact: true }).click();
  await page.getByLabel('Target weight (kg)', { exact: true }).fill('88');
  const due = monthStart(1);
  await page.getByRole('button', { name: 'Target date', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Target date', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await page.getByRole('button', { name: `Select ${due.label}`, exact: true }).click();
  await page.screenshot({
    path: '.codex/artifacts/previews/body-progress-target-editor.png',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Save target', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit target', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Weight target saved.');
  expect(await request(0, '/me/physical-target')).toEqual({
    objective: 'gain_weight',
    target: { weight_kg: '88.000000', target_date: due.id },
  });

  await page.getByRole('heading', { name: 'Progress', exact: true }).scrollIntoViewIfNeeded();
  const chartCardBackground = () =>
    page
      .getByTestId('body-measurement-chart')
      .evaluate((chart) => getComputedStyle(chart.parentElement!).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await chartCardBackground();
  await page.screenshot({ path: '.codex/artifacts/previews/body-progress-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(chartCardBackground).not.toBe(light);
  await page.screenshot({ path: '.codex/artifacts/previews/body-progress-dark.png' });
  await page.getByRole('button', { name: 'Back to profile', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Weight', exact: true })).toHaveValue('83.25');
  await page.getByRole('textbox', { name: 'Weight', exact: true }).fill('85.50');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Progress', exact: true })).toBeVisible();
  expect((await request(0, '/me/body-measurements')).items.at(-1).weight_kg).toBe('85.500000');

  await page.reload();
  await signIn(page, 0);
  await openProgress(page);
  await expect(page.getByRole('button', { name: 'Edit target', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /, 85\.50 kg$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back to profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page, 1);
  await openProgress(page);
  await expect(page.getByRole('button', { name: 'Set target', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /, 85\.50 kg$/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Waist', exact: true }).click();
  await expect(page.getByText('No waist measurements yet.', { exact: true })).toBeVisible();
});
