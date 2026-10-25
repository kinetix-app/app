import { expect, test, type Page } from '@playwright/test';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const email = process.env.KINETIX_E2E_EMAIL;
const password = process.env.KINETIX_E2E_PASSWORD;
const emailB = process.env.KINETIX_E2E_EMAIL_B;
const passwordB = process.env.KINETIX_E2E_PASSWORD_B;
function authorization(second = false) {
  const user = second ? emailB : email;
  const pass = second ? passwordB : password;
  if (!user || !pass || email === emailB)
    throw new Error('Two distinct isolated test accounts required');
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}
async function get(path: string, second = false) {
  return fetch(`${api}/api/v1${path}`, { headers: { Authorization: authorization(second) } });
}
async function signIn(page: Page, second = false) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill((second ? emailB : email)!);
  await page.getByLabel('Password', { exact: true }).fill((second ? passwordB : password)!);
  await page.getByRole('button', { name: /^Sign in/ }).click();
}

test('incomplete accounts finish profile/objective, log without targets, and edit exact optional targets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const initial = await (await get('/auth/me')).json();
  expect(initial.onboarding.required).toBe(true);
  expect((await get('/nutrition-goals/me')).status).toBe(404);
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email!);
  await page.getByLabel('Password', { exact: true }).fill('invalid-acceptance-password');
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('alert')).toContainText('not accepted');
  await expect(page.getByRole('tablist', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible();
  for (const [label, value] of [
    ['Name', 'Acceptance Alice'],
    ['Age (years)', '30'],
    ['Height (cm)', '170'],
    ['Weight', '100'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Choose kg or lb.')).toBeVisible();
  await page.getByRole('radio', { name: 'lb', exact: true }).click();
  await page.route('**/api/v1/me/profile', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save your profile');
  await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('100');
  await page.unroute('**/api/v1/me/profile');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: "What's your goal?", exact: true })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Save objective', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: 'Build muscle', exact: true }).click();
  await page.getByRole('button', { name: 'Save objective', exact: true }).click();
  await expect(page.getByText('Acceptance Alice', { exact: true })).toBeVisible();
  const saved = await (await get('/auth/me')).json();
  expect(saved.id).toBe(initial.id);
  expect(saved.profile.weight_kg).toBe('45.359237');
  expect(saved.profile.picture_url).toBeNull();
  expect(saved.onboarding.required).toBe(false);
  expect((await get('/nutrition-goals/me')).status).toBe(404);
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await expect(page.getByText('No nutrition target yet.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add food to Breakfast', exact: true }).click();
  await page.getByRole('button', { name: /New food$/ }).click();
  await page.getByLabel('Food name', { exact: true }).fill('Onboarding oats');
  for (const [label, value] of [
    ['calories', '370'],
    ['protein', '13'],
    ['carbohydrates', '60'],
    ['fats', '7'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save food', exact: true }).click();
  await page.getByRole('button', { name: 'Select Onboarding oats', exact: true }).click();
  await page.getByLabel('Food amount', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Add to Breakfast', exact: true }).click();
  await expect(page.getByText('185 kcal', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit nutrition goal', exact: true }).click();
  await expect(page.getByLabel('Daily calorie goal')).toHaveValue('');
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  await page.getByRole('button', { name: 'Edit nutrition goal', exact: true }).click();
  for (const [label, value] of [
    ['Daily calorie goal', '2400.15'],
    ['Daily protein goal', '150.12'],
    ['Daily carbohydrate goal', '250.25'],
    ['Daily fat goal', '0'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.route(/\/api\/v1\/nutrition-goals(?:\/me)?$/, (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('Could not save your goal. Try again.')).toBeVisible();
  await expect(page.getByLabel('Daily protein goal')).toHaveValue('150.12');
  await page.unroute(/\/api\/v1\/nutrition-goals(?:\/me)?$/);
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('185 kcal', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  for (const objective of ['Lose fat', 'Gain weight', 'Maintain weight']) {
    await page.getByRole('button', { name: 'Change objective', exact: true }).click();
    await page.getByRole('radio', { name: objective, exact: true }).click();
    await page.getByRole('button', { name: 'Save objective', exact: true }).click();
    await expect(page.getByText(objective, { exact: true })).toBeVisible();
  }
  const oldTarget = await (await get('/nutrition-goals/me')).json();
  expect(oldTarget.objective).toBe('build_muscle');
  await page.getByRole('button', { name: 'Edit nutrition goal', exact: true }).click();
  await expect(page.getByLabel('Daily protein goal')).toHaveValue('150.12');
  await expect(page.getByLabel('Daily fat goal')).toHaveValue('0');
  await expect(page.getByText(/These saved amounts belong to Build muscle/)).toBeVisible();
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect
    .poll(async () => (await (await get('/nutrition-goals/me')).json()).objective)
    .toBe('maintain_weight');
  await page.reload();
  await signIn(page);
  await expect(page.getByText('Acceptance Alice', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('100.000000');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: '.codex/artifacts/previews/onboarding-home-dark.png' });
  await expect(page.getByText('Acceptance Alice', { exact: true })).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: '.codex/artifacts/previews/onboarding-home-light.png' });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await signIn(page, true);
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible();
  const other = await (await get('/auth/me', true)).json();
  expect(other.id).not.toBe(initial.id);
  expect(other.profile.display_name).toBeNull();
  expect((await get('/nutrition-goals/me', true)).status).toBe(404);
  expect((await (await get('/me/objective', true)).json()).objective).toBeNull();
});
