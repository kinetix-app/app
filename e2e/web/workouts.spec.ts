import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const user = {
  email: process.env.KINETIX_E2E_EMAIL ?? '',
  password: process.env.KINETIX_E2E_PASSWORD ?? '',
};
const other = {
  email: process.env.KINETIX_E2E_EMAIL_B ?? '',
  password: process.env.KINETIX_E2E_PASSWORD_B ?? '',
};

async function request(path: string, method = 'GET', body?: unknown, identity = user) {
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${identity.email}:${identity.password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(page: Page, identity = user) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(identity.email);
  await page.getByLabel('Password', { exact: true }).fill(identity.password);
  const me = page.waitForResponse((response) => response.url().endsWith('/api/v1/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await me).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: /^(Start workout|Minimize workout|Resume workout)$/ }).first(),
  ).toBeVisible();
  if (!(await page.getByRole('button', { name: 'Minimize workout', exact: true }).isVisible())) {
    await page.getByRole('tab', { name: 'Workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'History', exact: true })).toBeVisible();
  }
}

test.beforeAll(() => {
  if (!user.email || !user.password || !other.email || !other.password)
    throw new Error('Acceptance requires two private development test credentials');
  if (user.email === other.email) throw new Error('Acceptance requires distinct test accounts');
});

test('real authenticated UI and atomic, idempotent, isolated completed history', async ({
  page,
}) => {
  await signIn(page);
  const account = await request('/me');
  expect(account.status).toBe(200);
  expect((await account.json()).id).toEqual(expect.any(Number));
  const catalogue = await request('/exercises?name=Acceptance%20press');
  expect(catalogue.status).toBe(200);
  const exercises = await catalogue.json();
  expect(exercises.items.length).toBeGreaterThan(0);
  const exerciseId = exercises.items[0].id;
  const payload = {
    client_session_id: randomUUID(),
    started_at: '2026-10-24T10:00:00Z',
    ended_at: '2026-10-24T10:30:00Z',
    exercises: [
      {
        exercise_id: exerciseId,
        sets: [{ reps: 8, weight: { value: '100', unit: 'lb' } }],
      },
      {
        exercise_id: exerciseId,
        sets: [{ reps: 12, weight: { value: '0', unit: 'kg' } }],
      },
    ],
  };
  const submitted = await request('/sessions', 'POST', payload);
  expect(submitted.status).toBe(201);
  const completed = await submitted.json();
  expect(completed.state).toBe('completed');
  expect(completed.exercises).toHaveLength(2);
  expect(completed.exercises[0].sets[0].weight_kg).toBe('45.359237');
  const retries = await Promise.all([
    request('/sessions', 'POST', payload),
    request('/sessions', 'POST', payload),
  ]);
  for (const retry of retries) {
    expect(retry.status).toBe(200);
    expect((await retry.json()).id).toBe(completed.id);
  }
  const conflict = await request('/sessions', 'POST', {
    ...payload,
    ended_at: '2026-10-24T10:31:00Z',
  });
  expect(conflict.status).toBe(409);
  const pounds = await request(`/sessions/${completed.id}?weight_unit=lb`);
  expect(pounds.status).toBe(200);
  expect((await pounds.json()).exercises[0].sets[0].weight).toEqual({
    value: '100.00',
    unit: 'lb',
  });
  const inaccessible = await request(`/sessions/${completed.id}`, 'GET', undefined, other);
  expect(inaccessible.status).toBe(404);
  const otherHistory = await request('/sessions', 'GET', undefined, other);
  expect(otherHistory.status).toBe(200);
  expect(
    (await otherHistory.json()).items.some((item: { id: number }) => item.id === completed.id),
  ).toBe(false);
  const invalidKey = randomUUID();
  const invalid = await request('/sessions', 'POST', {
    ...payload,
    client_session_id: invalidKey,
    exercises: [
      {
        exercise_id: exerciseId,
        sets: [{ reps: 0, weight: { value: '-1', unit: 'kg' } }],
      },
    ],
  });
  expect(invalid.status).toBe(422);
  const history = await request('/sessions?limit=100');
  expect(history.status).toBe(200);
  const items = (await history.json()).items;
  expect(
    items.filter(
      (item: { client_session_id: string }) => item.client_session_id === payload.client_session_id,
    ),
  ).toHaveLength(1);
  expect(
    items.some((item: { client_session_id: string }) => item.client_session_id === invalidKey),
  ).toBe(false);
});

test('blank workout persists locally, resumes and retries the identical frozen Finish', async ({
  page,
}) => {
  await signIn(page);
  const before = await (await request('/sessions?limit=100')).json();
  const writes: { method: string; path: string }[] = [];
  page.on('request', (value) => {
    const url = new URL(value.url());
    if (url.pathname.startsWith('/api/v1/') && !['GET', 'OPTIONS'].includes(value.method()))
      writes.push({ method: value.method(), path: url.pathname });
  });
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Add Acceptance press', exact: true }).click();
  await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Exercise 1 set 1 reps', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Display weight in lb', exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel('Exercise 1 set 1 kg', { exact: true }).fill('100');
  await page.getByLabel('Exercise 1 set 1 reps', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'History', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Edit sets for Acceptance press',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await signIn(page);
  const resume = page.getByRole('button', {
    name: 'Resume workout',
    exact: true,
  });
  if (await resume.isVisible()) await resume.click();
  await expect(
    page.getByRole('button', {
      name: 'Edit sets for Acceptance press',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    writes.some(
      (value) => value.method === 'PUT' && value.path.startsWith('/api/v1/session-drafts/'),
    ),
  ).toBe(true);
  expect(writes.some((value) => value.path === '/api/v1/sessions')).toBe(false);
  const during = await (await request('/sessions?limit=100')).json();
  expect(during.items.map((value: { id: number }) => value.id)).toEqual(
    before.items.map((value: { id: number }) => value.id),
  );
  let frozen: unknown;
  await page.route('**/api/v1/session-drafts/*/finish', async (route) => {
    if (route.request().method() === 'POST') {
      frozen = route.request().postDataJSON();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry Finish', exact: true })).toBeVisible();
  expect(frozen).toBeDefined();
  await page.unroute('**/api/v1/session-drafts/*/finish');
  const submitted = page.waitForRequest(
    (value) => value.method() === 'POST' && new URL(value.url()).pathname.endsWith('/finish'),
  );
  const confirmed = page.waitForResponse(
    (value) =>
      value.request().method() === 'POST' && new URL(value.url()).pathname.endsWith('/finish'),
  );
  await page.getByRole('button', { name: 'Retry Finish', exact: true }).click();
  expect((await submitted).postDataJSON()).toEqual(frozen);
  const response = await confirmed;
  expect(response.status()).toBe(200);
  const workout = await response.json();
  expect(workout.exercises[0].sets[0].weight_kg).toBe('100.000000');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: `View workout ${workout.id}`, exact: true }).click();
  await expect(page.getByText('1. Acceptance press', { exact: true })).toBeVisible();
});

test('routine start snapshots repeated slots and two finishes retain distinct IDs', async ({
  page,
}) => {
  const exercises = await (await request('/exercises?name=Acceptance%20press')).json();
  const exerciseId = exercises.items[0].id;
  const name = `Acceptance routine ${randomUUID()}`;
  const saved = await request('/routines', 'POST', {
    name,
    exercises: [
      { exercise_id: exerciseId, sets: [{ reps: 5, weight_kg: '20.00' }] },
      { exercise_id: exerciseId, sets: [{ reps: 6, weight_kg: '30.00' }] },
    ],
  });
  expect(saved.status).toBe(201);
  const routine = await saved.json();
  await signIn(page);
  const completedIds: number[] = [];
  for (let round = 0; round < 2; round += 1) {
    await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Start routine', exact: true }).click();
    const slots = page.getByRole('button', {
      name: 'Edit sets for Acceptance press',
      exact: true,
    });
    await expect(slots).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      if ((await slots.nth(index).getAttribute('aria-expanded')) !== 'true')
        await slots.nth(index).click();
      const weight = page.getByLabel(`Exercise ${index + 1} set 1 kg`, {
        exact: true,
      });
      const reps = page.getByLabel(`Exercise ${index + 1} set 1 reps`, {
        exact: true,
      });
      await expect(weight).toHaveValue('');
      await expect(reps).toHaveValue('');
      await weight.fill(String(40 + index));
      await reps.fill(String(8 + index));
      await page
        .getByRole('button', { name: `Save exercise ${index + 1} set 1`, exact: true })
        .click();
      await expect(
        page
          .getByRole('button', { name: 'Edit sets for Acceptance press', exact: true })
          .nth(index),
      ).toHaveAttribute('aria-expanded', 'false');
    }
    const confirmed = page.waitForResponse(
      (value) =>
        value.request().method() === 'POST' && new URL(value.url()).pathname.endsWith('/finish'),
    );
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page.getByRole('button', { name: 'Keep routine', exact: true }).click();
    const response = await confirmed;
    expect(response.status()).toBe(200);
    const workout = await response.json();
    completedIds.push(workout.id);
    expect(workout.routine_id).toBe(routine.id);
    expect(workout.exercises.every((value: object) => !('routine_exercise_id' in value))).toBe(
      true,
    );
    expect(
      workout.exercises.map((value: { sets: { reps: number }[] }) => value.sets[0].reps),
    ).toEqual([8, 9]);
    await expect(page.getByRole('button', { name: 'History', exact: true })).toBeVisible();
  }
  expect(new Set(completedIds).size).toBe(2);
  const unchanged = await (await request(`/routines/${routine.id}`)).json();
  expect(
    unchanged.exercises.map(
      (value: { default_sets: { reps: number }[] }) => value.default_sets[0].reps,
    ),
  ).toEqual([5, 6]);
});

test('logout retains A server draft while B never inherits private draft or history', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Add Acceptance press', exact: true }).click();
  await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await signIn(page, other);
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toHaveCount(0);
  const bHistory = page.waitForResponse(
    (value) =>
      value.request().method() === 'GET' && new URL(value.url()).pathname === '/api/v1/sessions',
  );
  await page.getByRole('button', { name: 'History', exact: true }).click();
  expect((await bHistory).status()).toBe(200);
  await expect(page.getByText('No completed workouts yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^View workout / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to profile', exact: true }).click();
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
});
