import { expect, test, type Page } from '@playwright/test';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const email = process.env.KINETIX_E2E_EMAIL;
const password = process.env.KINETIX_E2E_PASSWORD;
async function signIn(page: Page) {
  if (!email || !password)
    throw new Error('Home acceptance requires private development test credentials');
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const account = page.waitForResponse((response) => response.url().endsWith('/api/v1/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await account).status()).toBe(200);
}
async function get(path: string) {
  const response = await fetch(`${api}/api/v1${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}` },
  });
  expect(response.status).toBe(200);
  return response.json();
}

test('home shares navigation, goal persistence, existing nutrition and an ongoing workout across tabs and reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'Nutrition goal', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Main navigation' })).toHaveCount(1);
  await page.getByLabel('Daily calorie goal').fill('2400');
  await page.route(/\/api\/v1\/nutrition-goals(?:\/me)?$/, (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('Could not save your goal. Try again.')).toBeVisible();
  await expect(page.getByLabel('Daily calorie goal')).toHaveValue('2400');
  await page.unroute(/\/api\/v1\/nutrition-goals(?:\/me)?$/);
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Nutrition', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Add food to Breakfast' })).toBeVisible();
  expect(Number((await get('/nutrition-goals/me')).calories)).toBe(2400);

  await page.getByRole('button', { name: 'Add food to Breakfast' }).click();
  await expect(page.getByRole('heading', { name: 'Add food', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to nutrition', exact: true }).click();
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByRole('button', { name: 'New routine', exact: true }).click();
  await page.getByLabel('Routine name', { exact: true }).fill('Unsaved across tabs');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await expect(page.getByLabel('Routine name', { exact: true })).toHaveValue('Unsaved across tabs');
  await page.getByRole('button', { name: 'Back to routines', exact: true }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();

  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Add Acceptance press', exact: true }).click();
  await page.getByLabel('Exercise 1 set 1 kg', { exact: true }).fill('35');
  await page.getByLabel('Exercise 1 set 1 reps', { exact: true }).fill('9');
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' && response.url().includes('/session-drafts/'),
  );
  await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeDisabled();
  const persistedDraft = await get('/session-drafts');
  expect(persistedDraft.exercises[0].sets[0].reps).toBe(9);

  await page.reload();
  await signIn(page);
  const resume = page.getByRole('button', { name: 'Resume workout', exact: true });
  await expect(resume).toBeVisible();
  await resume.click();
  await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
  await expect(page.getByLabel('Exercise 1 set 1 reps', { exact: true })).toHaveValue('9');
  const finished = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/finish'),
  );
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  const response = await finished;
  expect(response.status()).toBe(200);
  const completed = await response.json();
  expect(completed.client_session_id).toBe(persistedDraft.client_session_id);
  expect(completed.exercises[0].sets[0].reps).toBe(9);
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: `View workout ${completed.id}`, exact: true }).click();
  await expect(page.getByText('1. Acceptance press', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await expect(page.getByLabel('Daily calorie goal')).toHaveValue('2400');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByRole('button', { name: 'Edit nutrition goal', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByLabel('Daily calorie goal')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
});
