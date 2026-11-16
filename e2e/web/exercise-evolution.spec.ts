import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const email = process.env.KINETIX_E2E_EMAIL ?? '';
const password = process.env.KINETIX_E2E_PASSWORD ?? '';
async function request(path: string, method = 'GET', body?: unknown, second = false) {
  const user = second ? process.env.KINETIX_E2E_EMAIL_B : email;
  const pass = second ? process.env.KINETIX_E2E_PASSWORD_B : password;
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function signIn(page: Page, second = false) {
  await page.goto('/');
  await page
    .getByLabel('Email', { exact: true })
    .fill(second ? process.env.KINETIX_E2E_EMAIL_B! : email);
  await page
    .getByLabel('Password', { exact: true })
    .fill(second ? process.env.KINETIX_E2E_PASSWORD_B! : password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
}

test('daily Evolution graphs preserve source history, units, selection and ownership', async ({
  page,
}) => {
  test.setTimeout(120000);
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Requires a dedicated run-owned test database');
  expect(email && password && process.env.KINETIX_E2E_EMAIL_B).toBeTruthy();
  expect(email).not.toBe(process.env.KINETIX_E2E_EMAIL_B);
  await page.setViewportSize({ width: 390, height: 844 });
  const oldDraft = await (await request('/session-drafts')).json();
  if (oldDraft)
    expect((await request(`/session-drafts/${oldDraft.client_session_id}`, 'DELETE')).status).toBe(
      204,
    );
  for (const second of [false, true]) {
    expect((await request('/me', 'GET', undefined, second)).status).toBe(200);
    expect(
      (
        await request(
          '/me/profile',
          'PATCH',
          {
            display_name: 'Evolution acceptance',
            age: 30,
            height_cm: '170',
            weight_kg: '70',
            measurement_system: 'metric',
            timezone: 'Europe/Madrid',
          },
          second,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request('/me/objective', 'PUT', { objective: 'maintain_weight' }, second)).status,
    ).toBe(200);
  }
  const catalogue = (await (await request('/exercises?limit=100&name=Acceptance')).json()).items;
  const press = catalogue.find((item: { name: string }) => item.name === 'Acceptance press').id;
  const cardio = catalogue.find((item: { name: string }) => item.name === 'Acceptance cardio').id;
  const olderId = catalogue.find((item: { name: string }) => item.name === 'Acceptance squat').id;
  const emptyId = catalogue.find((item: { name: string }) => item.name === 'Acceptance row').id;
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const day = today.toISOString().slice(0, 10);
  const baseline = await (await request(`/exercises/${press}/evolution`)).json();
  const baselineVolume = (date: string) =>
    Number(baseline.days.find((d: { date: string }) => d.date === date)?.volume ?? 0);
  const todayVolume = (baselineVolume(day) + 1121).toFixed(1);
  const priorDay = yesterday.toISOString().slice(0, 10);
  const set = (value: string, reps: number) => ({ reps, weight: { value, unit: 'kg' } });
  async function complete(ended: Date, exercises: unknown[]) {
    const response = await request('/sessions', 'POST', {
      client_session_id: randomUUID(),
      started_at: new Date(ended.getTime() - 60000).toISOString(),
      ended_at: ended.toISOString(),
      exercises,
    });
    expect(response.status).toBe(201);
  }
  await complete(today, [
    { exercise_id: press, sets: [set('40', 10)] },
    { exercise_id: press, sets: [set('50', 8)] },
  ]);
  await complete(today, [{ exercise_id: press, sets: [set('60', 5)] }]);
  // Exceed the History page size; Evolution must still include every recorded set.
  for (let i = 0; i < 21; i++) await complete(today, [{ exercise_id: press, sets: [set('1', 1)] }]);
  await complete(yesterday, [{ exercise_id: press, sets: [set('20', 11), set('40', 1)] }]);
  await complete(today, [
    {
      exercise_id: cardio,
      sets: [
        { distance_km: '5', duration_seconds: 300 },
        { distance_km: '2', duration_seconds: 3720 },
      ],
    },
  ]);
  const older = new Date(today);
  older.setUTCMonth(older.getUTCMonth() - 4);
  await complete(older, [{ exercise_id: olderId, sets: [set('25', 2)] }]);
  const source = await (await request(`/exercises/${press}/history?limit=100`)).json();
  const evolution = await (await request(`/exercises/${press}/evolution`)).json();
  expect(evolution.days).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        date: day,
        estimated_1rm: '70.0',
        weight: '60.0',
        reps: Math.max(10, baseline.days.find((d: { date: string }) => d.date === day)?.reps ?? 0),
        volume: todayVolume,
      }),
      expect.objectContaining({
        date: priorDay,
        estimated_1rm: '40.0',
        volume: (baselineVolume(priorDay) + 260).toFixed(1),
        reps: 11,
      }),
    ]),
  );
  expect(
    (await (await request(`/exercises/${press}/evolution`, 'GET', undefined, true)).json()).days,
  ).toEqual([]);
  const name = `Evolution ${randomUUID().slice(0, 8)}`;
  const routine = await request('/routines', 'POST', {
    name,
    exercises: [
      { exercise_id: press },
      { exercise_id: cardio },
      { exercise_id: olderId },
      { exercise_id: emptyId },
    ],
  });
  expect(routine.status).toBe(201);
  async function openExercise(exerciseName: string) {
    await page.getByRole('button', { name: `Details for ${exerciseName}`, exact: true }).click();
    await page.getByRole('tab', { name: 'Evolution', exact: true }).click();
  }
  let draftId: string | undefined;
  let otherDraftId: string | undefined;
  try {
    await signIn(page);
    await page.getByRole('tab', { name: 'Workout', exact: true }).click();
    await page.getByLabel('Search routines', { exact: true }).fill(name);
    await page.getByRole('button', { name: `Routine actions for ${name}`, exact: true }).click();
    await page.getByRole('button', { name: `Train ${name}`, exact: true }).click();
    await expect
      .poll(async () => (await (await request('/session-drafts')).json())?.client_session_id)
      .toBeTruthy();
    draftId = (await (await request('/session-drafts')).json()).client_session_id;
    await openExercise('Acceptance press');
    await expect(
      page.getByRole('tab', { name: 'Estimated strength (1RM)', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: `${day}, 70.0 kg`, exact: true })).toBeVisible();
    const point = page.getByRole('button', { name: `${priorDay}, 40.0 kg`, exact: true });
    await point.click();
    await expect(point).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({
      path: '.codex/artifacts/e2e/evolution-selected.png',
      animations: 'disabled',
    });
    await point.click();
    await expect(point).toHaveAttribute('aria-selected', 'false');
    await point.click();
    await page.getByRole('button', { name: '1 month', exact: true }).click();
    await expect(point).toHaveAttribute('aria-selected', 'false');
    await page.getByRole('button', { name: 'About Estimated strength (1RM)', exact: true }).click();
    await expect(page.getByText(/maximum effort/i)).toBeInViewport();
    await expect(
      page.getByRole('button', { name: 'Close explanation', exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: '.codex/artifacts/e2e/evolution-explanation.png',
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Close explanation', exact: true }).click();
    await page.getByRole('tab', { name: 'Volume', exact: true }).click();
    await expect(
      page.getByRole('button', { name: `${day}, ${todayVolume} kg`, exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await openExercise('Acceptance cardio');
    await expect(page.getByRole('tab', { name: 'Distance', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByRole('tab', { name: 'Estimated strength (1RM)', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: `${day}, 5.00 km`, exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Time', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(`${day}, .*1h.*2m`) })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await openExercise('Acceptance squat');
    await expect(page.getByText(/Try a longer range/)).toBeVisible();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(
      page.getByRole('button', {
        name: `${older.toISOString().slice(0, 10)}, 26.7 kg`,
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await openExercise('Acceptance row');
    await expect(page.getByText(/No observations/)).toBeVisible();
    await page.reload();
    await signIn(page);
    await openExercise('Acceptance press');
    await expect(page.getByRole('button', { name: `${day}, 70.0 kg`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    expect((await request('/me/profile', 'PATCH', { measurement_system: 'imperial' })).status).toBe(
      200,
    );
    await page.reload();
    await signIn(page);
    let fail = true;
    await page.route('**/api/v1/exercises/*/evolution*', async (route) => {
      if (fail) await route.abort('failed');
      else await route.continue();
    });
    await openExercise('Acceptance press');
    await expect(page.getByText('Retry', { exact: true })).toBeVisible({ timeout: 20000 });
    fail = false;
    await page.getByText('Retry', { exact: true }).click();
    await expect(page.getByRole('button', { name: `${day}, 154.3 lb`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await openExercise('Acceptance cardio');
    await expect(page.getByRole('button', { name: `${day}, 3.11 mi`, exact: true })).toBeVisible();
    expect(await (await request(`/exercises/${press}/history?limit=100`)).json()).toEqual(source);
    const otherName = `${name} B`;
    expect(
      (
        await request(
          '/routines',
          'POST',
          { name: otherName, exercises: [{ exercise_id: press }] },
          true,
        )
      ).status,
    ).toBe(201);
    await page.reload();
    await signIn(page, true);
    await page.getByRole('tab', { name: 'Workout', exact: true }).click();
    await page.getByLabel('Search routines', { exact: true }).fill(otherName);
    await page
      .getByRole('button', { name: `Routine actions for ${otherName}`, exact: true })
      .click();
    await page.getByRole('button', { name: `Train ${otherName}`, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request('/session-drafts', 'GET', undefined, true)).json())
            ?.client_session_id,
      )
      .toBeTruthy();
    otherDraftId = (await (await request('/session-drafts', 'GET', undefined, true)).json())
      .client_session_id;
    await openExercise('Acceptance press');
    await expect(page.getByText(/No observations/)).toBeVisible();
    await expect(page.getByRole('button', { name: `${day}, 70.0 kg`, exact: true })).toHaveCount(0);
  } finally {
    if (otherDraftId)
      expect(
        (await request(`/session-drafts/${otherDraftId}`, 'DELETE', undefined, true)).status,
      ).toBe(204);
    if (draftId) expect((await request(`/session-drafts/${draftId}`, 'DELETE')).status).toBe(204);
  }
});
