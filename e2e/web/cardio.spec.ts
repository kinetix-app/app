import { expect, test } from '@playwright/test';
import { selectExercise, minimizeWorkout } from './workout-controls';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const email = process.env.KINETIX_E2E_EMAIL ?? '';
const password = process.env.KINETIX_E2E_PASSWORD ?? '';
async function request(path: string, method = 'GET', body?: unknown) {
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('cardio recording survives reload and persists mixed measurements', async ({ page }) => {
  if (
    process.env.APP_ENV !== 'test' ||
    !process.env.DATABASE_URL?.endsWith('_test') ||
    !email ||
    !password
  )
    throw new Error('Requires private test credentials and a dedicated test database');
  expect((await request('/auth/me')).status).toBe(200);
  const oldDraft = await (await request('/session-drafts')).json();
  if (oldDraft)
    expect((await request(`/session-drafts/${oldDraft.client_session_id}`, 'DELETE')).status).toBe(
      204,
    );
  expect(
    (
      await request('/me/profile', 'PATCH', {
        display_name: 'Acceptance',
        age: 30,
        height_cm: '170',
        weight_kg: '70',
        measurement_system: 'metric',
        timezone: 'Europe/Madrid',
      })
    ).status,
  ).toBe(200);
  expect((await request('/me/objective', 'PUT', { objective: 'maintain_weight' })).status).toBe(
    200,
  );
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: /^Filter body parts/ }).click();
  await page.getByRole('button', { name: 'Cardio', exact: true }).click();
  await page.getByRole('button', { name: 'Save filters', exact: true }).click();
  await selectExercise(page, 'Acceptance cardio');
  await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
  await expect(
    page.getByText(
      'Enter valid distance and time, or a positive weight and repetitions, before saving this set.',
    ),
  ).toBeVisible();
  for (const [name, value] of [
    ['distance', '1.25'],
    ['time', '1230'],
  ])
    await page.getByLabel(`Exercise 1 set 1 ${name}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request('/session-drafts')).json())?.exercises[0]?.sets[0]?.duration_seconds,
    )
    .toBe(750);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: /^Filter body parts/ }).click();
  await page.getByRole('button', { name: 'Gym', exact: true }).click();
  await page.getByRole('button', { name: 'Save filters', exact: true }).click();
  await selectExercise(page, 'Acceptance press');
  await page.getByLabel('Exercise 2 set 1 kg').fill('25');
  await page.getByLabel('Exercise 2 set 1 reps').fill('8');
  await page.getByRole('button', { name: 'Save exercise 2 set 1', exact: true }).click();
  await minimizeWorkout(page);
  await page.reload();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Edit sets for Acceptance cardio', exact: true }).click();
  await expect(page.getByLabel('Exercise 1 set 1 distance')).toHaveValue('1.25');
  const done = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/finish'),
  );
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  const response = await done;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.exercises[0].sets[0]).toMatchObject({
    distance_km: '1.25',
    duration_seconds: 750,
    reps: null,
    weight_kg: null,
  });
  expect(result.exercises[1].sets[0]).toMatchObject({
    reps: 8,
    weight_kg: '25.000000',
    duration_seconds: null,
    distance_km: null,
  });
  expect((await request(`/sessions/${result.id}`)).status).toBe(200);
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page.getByRole('button', { name: 'Training history', exact: true }).click();
  await page.getByRole('button', { name: `View workout ${result.id}`, exact: true }).click();
  await expect(page.getByText('Set 1: 1.25 km · 00:12:30', { exact: true })).toBeVisible();
});

test('cardio routine defaults save, reopen and edit through the real app', async ({ page }) => {
  if (
    process.env.APP_ENV !== 'test' ||
    !process.env.DATABASE_URL?.endsWith('_test') ||
    !email ||
    !password
  )
    throw new Error('Requires private test credentials and a dedicated test database');
  const name = `Cardio routine ${Date.now()}`;
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByRole('button', { name: 'New routine', exact: true }).click();
  await page.getByLabel('Routine name').fill(name);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: /^Filter body parts/ }).click();
  await page.getByRole('button', { name: 'Cardio', exact: true }).click();
  await page.getByRole('button', { name: 'Save filters', exact: true }).click();
  await selectExercise(page, 'Acceptance cardio');
  await page.getByRole('button', { name: 'Edit sets for Acceptance cardio' }).click();
  await page.getByRole('button', { name: 'Add set to exercise 1' }).click();
  for (const field of ['distance', 'time'])
    await page.getByLabel(`Exercise 1 set 1 ${field}`).fill('0');
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(page.getByText('Routine saved.')).toBeVisible();
  await page.getByLabel(`Edit ${name}`).click();
  await page.getByRole('button', { name: 'Edit sets for Acceptance cardio' }).click();
  await expect(page.getByLabel('Exercise 1 set 1 distance')).toHaveValue('0.00');
  await page.getByLabel('Exercise 1 set 1 distance').fill('2.50');
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(page.getByText('Routine saved.')).toBeVisible();
  const list = await (await request('/routines')).json();
  const routine = list.items.find((item: { name: string }) => item.name === name);
  expect(routine).toBeDefined();
  const detail = await (await request(`/routines/${routine.id}`)).json();
  expect(detail.exercises[0].default_sets[0]).toMatchObject({
    distance_km: '2.50',
    duration_seconds: 0,
    reps: null,
    weight_kg: null,
  });
  expect((await request(`/routines/${routine.id}`, 'DELETE')).status).toBe(204);
});
