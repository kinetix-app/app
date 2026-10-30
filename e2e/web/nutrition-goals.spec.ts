import { expect, test, type Page } from '@playwright/test';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const credentials = [
  [process.env.KINETIX_E2E_EMAIL, process.env.KINETIX_E2E_PASSWORD],
  [process.env.KINETIX_E2E_EMAIL_B, process.env.KINETIX_E2E_PASSWORD_B],
];

function authorization(second = false) {
  const [email, password] = credentials[second ? 1 : 0];
  if (!email || !password || credentials[0][0] === credentials[1][0])
    throw new Error('Two distinct private test identities are required');
  return `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;
}

async function request(path: string, method = 'GET', body?: unknown, second = false) {
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: { Authorization: authorization(second), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function goal(second = false) {
  const response = await request('/nutrition-goals/me', 'GET', undefined, second);
  expect(response.status).toBe(200);
  return response.json();
}

async function signIn(page: Page, second = false) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(credentials[second ? 1 : 0][0]!);
  await page.getByLabel('Password', { exact: true }).fill(credentials[second ? 1 : 0][1]!);
  const account = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await account).status()).toBe(200);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
}

async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Edit nutrition goal', exact: true }).click();
  await expect(page.getByLabel('Daily calorie goal')).toBeVisible();
}

async function split(page: Page, carbohydrate: string, protein: string, fat: string) {
  await page.getByLabel('Carbohydrate percentage', { exact: true }).fill(carbohydrate);
  await page.getByLabel('Protein percentage', { exact: true }).fill(protein);
  await page.getByLabel('Fat percentage', { exact: true }).fill(fat);
}

const legacy = { calories: 2400.15, protein: 150.12, carbohydrates: 250.25, fats: 0 };

test('manual percentage targets persist, retain legacy values and isolate two authenticated accounts', async ({
  page,
}) => {
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Use a run-owned isolated test database and APP_ENV=test');
  // These identities must belong to this run; never prepare personal accounts.
  for (const second of [false, true]) {
    expect((await request('/auth/me', 'GET', undefined, second)).status).toBe(200);
    const profile = await request(
      '/me/profile',
      'PATCH',
      {
        display_name: second ? 'Nutrition acceptance B' : 'Nutrition acceptance A',
        age: 30,
        height_cm: 170,
        weight_kg: 70,
        measurement_system: 'metric',
        timezone: 'Europe/Madrid',
      },
      second,
    );
    expect(profile.status).toBe(200);
    expect(
      (await request('/me/objective', 'PUT', { objective: 'maintain_weight' }, second)).status,
    ).toBe(200);
  }
  expect((await request('/nutrition-goals/me')).status).toBe(404);
  expect(
    (
      await request(
        '/nutrition-goals',
        'POST',
        { calories: 1800, protein: 100, carbohydrates: 200, fats: 50 },
        true,
      )
    ).status,
  ).toBe(201);
  const beforeB = await goal(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await openEditor(page);
  await expect(page.getByLabel('Protein percentage')).toHaveValue('');
  for (const [macro, factor] of [
    ['Carbohydrate', 4],
    ['Protein', 4],
    ['Fat', 9],
  ] as const) {
    const info = page.getByRole('button', { name: `${macro} calories per gram`, exact: true });
    await info.click();
    await expect(
      page.getByText(`${macro}: ${factor} kcal per gram.`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Close macro information', exact: true })
      .click({ position: { x: 5, y: 5 } });
    await expect(page.getByText(`${macro}: ${factor} kcal per gram.`, { exact: true })).toHaveCount(
      0,
    );
  }

  await page.getByLabel('Daily calorie goal').fill('2000');
  await split(page, '40', '30', '29.99');
  await expect(page.getByText('1999.80 kcal · 99.99%')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save goal', exact: true })).toBeDisabled();
  expect((await request('/nutrition-goals/me')).status).toBe(404);
  await page.getByLabel('Fat percentage').fill('30');
  await expect(page.getByRole('slider', { name: 'Fat range', exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Fat range', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Fat percentage')).toHaveValue('30.01');
  const range = page.getByRole('slider', { name: 'Fat range', exact: true });
  await range.scrollIntoViewIfNeeded();
  const bounds = await range.boundingBox();
  if (!bounds) throw new Error('Fat range must have a visible drag target');
  await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  const dragged = Number(await range.inputValue());
  expect(dragged).toBeGreaterThan(50);
  await expect(page.getByLabel('Fat percentage')).toHaveValue(dragged.toFixed(2));
  await page.getByLabel('Fat percentage').fill('30');
  await expect(range).toHaveValue('30');
  const saveBounds = await page
    .getByRole('button', { name: 'Save goal', exact: true })
    .boundingBox();
  const navigationBounds = await page
    .getByRole('tablist', { name: 'Main navigation' })
    .boundingBox();
  if (!saveBounds || !navigationBounds) throw new Error('Editor and navigation must be visible');
  expect(saveBounds.y).toBeGreaterThanOrEqual(0);
  const headingBounds = await page
    .getByRole('heading', { name: 'Nutrition goal', exact: true })
    .boundingBox();
  expect(headingBounds?.y).toBeGreaterThanOrEqual(0);
  expect(saveBounds.y + saveBounds.height).toBeLessThanOrEqual(navigationBounds.y);
  await page.getByLabel('Carbohydrate percentage').fill('60');
  await expect(page.getByText('2400.00 kcal · 120.00%')).toBeVisible();
  await expect(page.getByText('Out of budget · 400.00 kcal over 2000.00 kcal')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save goal', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: 'Grams', exact: true }).click();
  await expect(page.getByLabel('Carbohydrate grams')).toHaveValue('300.00');
  await expect(page.getByText('60.00%', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save goal', exact: true })).toBeDisabled();
  await page.getByLabel('Carbohydrate grams').fill('200');
  await expect(page.getByText(/Out of budget/)).toHaveCount(0);
  await page.getByRole('radio', { name: 'Percentages', exact: true }).click();
  await expect(page.getByLabel('Carbohydrate percentage')).toHaveValue('40.00');
  await expect(page.getByText('200.00 g', { exact: true })).toBeVisible();

  await expect(page.getByText('66.67 g', { exact: true })).toBeVisible();
  const mutations = /\/api\/v1\/nutrition-goals(?:\/me)?$/;
  await page.route(mutations, (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('Could not save your goal. Try again.')).toBeVisible();
  await expect(page.getByLabel('Protein percentage')).toHaveValue('30.00');
  await page.unroute(mutations);
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  const saved = await goal();
  expect(Number(saved.calories)).toBe(2000);
  expect(Number(saved.carbohydrates)).toBe(200);
  expect(Number(saved.protein)).toBe(150);
  expect(Number(saved.fats)).toBe(66.67);
  expect(await goal(true)).toEqual(beforeB);
  await openEditor(page);
  await expect(page.getByLabel('Fat percentage')).toHaveValue('30.00');
  await expect(page.getByLabel('Protein percentage')).toHaveValue('30.00');
  await expect(page.getByText('2000.00 kcal · 100.00%')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({
    path: '.codex/artifacts/previews/nutrition-percentages-light.png',
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: '.codex/artifacts/previews/nutrition-percentages-dark.png',
    fullPage: true,
  });
  await page.reload();
  await signIn(page);
  await openEditor(page);
  await expect(page.getByLabel('Fat percentage')).toHaveValue('30.00');
  await split(page, '0', '100', '0');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  expect(Number((await goal()).protein)).toBe(500);
  expect(Number((await goal()).fats)).toBe(0);
  expect((await request('/nutrition-goals/me', 'PATCH', legacy)).status).toBe(200);
  await page.reload();
  await signIn(page);
  await openEditor(page);
  await expect(page.getByLabel('Protein percentage')).not.toHaveValue('');
  await expect(page.getByLabel('Fat percentage')).toHaveValue('0.00');
  await expect(page.getByRole('button', { name: 'Save goal', exact: true })).toBeDisabled();
  await expect(page.getByText(/Percentages must total 100% to save/)).toBeVisible();
  await page.getByRole('radio', { name: 'Grams', exact: true }).click();
  await expect(page.getByLabel('Protein grams')).toHaveValue('150.12');
  await expect(page.getByRole('button', { name: 'Save goal', exact: true })).toBeEnabled();
  await page.getByRole('radio', { name: 'Percentages', exact: true }).click();

  await expect(page.getByLabel('Protein percentage')).not.toHaveValue('');
  await page.getByRole('radio', { name: 'Grams', exact: true }).click();
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  await page.reload();
  await signIn(page);
  await openEditor(page);
  await page.getByRole('radio', { name: 'Grams', exact: true }).click();
  await expect(page.getByLabel('Protein grams')).toHaveValue('150.12');
  await expect(page.getByLabel('Fat grams')).toHaveValue('0');
  const unchanged = await goal();
  expect(Number(unchanged.calories)).toBe(legacy.calories);
  expect(Number(unchanged.protein)).toBe(legacy.protein);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page, true);
  await openEditor(page);
  await expect(page.getByLabel('Daily calorie goal')).toHaveValue('1800');
  await split(page, '50', '25', '25');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  expect((await goal(true)).user_id).not.toBe(unchanged.user_id);
  expect(await goal()).toEqual(unchanged);
  expect((await fetch(`${api}/api/v1/nutrition-goals/me`)).status).toBe(401);
});
