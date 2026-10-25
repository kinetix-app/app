import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.use({ actionTimeout: 10000 });
const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const email = process.env.KINETIX_E2E_EMAIL ?? '';
const password = process.env.KINETIX_E2E_PASSWORD ?? '';
const headers = {
  Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
  'Content-Type': 'application/json',
};
async function request(path: string, method = 'GET', body?: unknown) {
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const me = page.waitForResponse((response) => response.url().endsWith('/api/v1/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await me).status()).toBe(200);
}

test('partial results, independent routine origin, history placeholders and atomic optional routine update', async ({
  page,
}) => {
  test.setTimeout(120000);
  expect(email && password, 'Private integration profile is required').toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  const catalogue = await (await request('/exercises?name=Acceptance%20press')).json();
  const exerciseId = catalogue.items[0].id;
  const name = `Results ${randomUUID().slice(0, 8)}`;
  const historic = await request('/sessions', 'POST', {
    client_session_id: randomUUID(),
    started_at: new Date(Date.now() - 60000).toISOString(),
    ended_at: new Date().toISOString(),
    exercises: [
      {
        exercise_id: exerciseId,
        sets: [
          { reps: 6, weight: { value: '55', unit: 'kg' } },
          { reps: 5, weight: { value: '60', unit: 'kg' } },
        ],
      },
    ],
  });
  expect(historic.status).toBe(201);
  const created = await request('/routines', 'POST', {
    name,
    exercises: [
      {
        exercise_id: exerciseId,
        sets: [
          { reps: 8, weight_kg: '80.00' },
          { reps: 8, weight_kg: '80.00' },
        ],
      },
    ],
  });
  expect(created.status).toBe(201);
  const routine = await created.json();
  let draftId: string | undefined;
  try {
    await signIn(page);
    await page.getByLabel('Search routines', { exact: true }).fill(name);
    const start = page.getByRole('button', { name: `Start ${name}`, exact: true });
    await start.click();
    await expect(page.getByRole('button', { name: 'Minimize workout', exact: true })).toBeEnabled();
    draftId = (await (await request('/session-drafts')).json()).client_session_id;
    await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
    await expect(start).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start routine', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Back to routines', exact: true }).click();
    // Replacing template slots mid-workout must not invalidate the independent session rows.
    expect(
      (
        await request(`/routines/${routine.id}`, 'PATCH', {
          exercises: [{ exercise_id: exerciseId, sets: [{ reps: 1, weight_kg: '99.00' }] }],
        })
      ).status,
    ).toBe(200);
    await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
    await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
    await page.getByLabel('Exercise 1 set 1 kg', { exact: true }).fill('42');
    await page.getByLabel('Exercise 1 set 1 reps', { exact: true }).fill('9');
    await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 1 set 1', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Exercise 1 set 2 kg', { exact: true }).fill('bad');
    await page.getByRole('button', { name: /^Edit sets for /, expanded: true }).click();
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    const configuration = page.waitForResponse((response) =>
      response.url().includes(`/exercises/${exerciseId}/last-configuration`),
    );
    await page.getByRole('button', { name: 'Add Acceptance press', exact: true }).click();
    expect((await configuration).status()).toBe(200);
    await expect(page.getByLabel('Exercise 2 set 1 kg', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Exercise 2 set 1 kg', { exact: true })).toHaveAttribute(
      'placeholder',
      '55.00',
    );
    await expect(page.getByLabel('Exercise 2 set 1 reps', { exact: true })).toHaveAttribute(
      'placeholder',
      '6',
    );
    await expect(page.getByLabel('Exercise 2 set 2 kg', { exact: true })).toHaveAttribute(
      'placeholder',
      '60.00',
    );
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 2 set 1', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Update the routine?', exact: true }),
    ).toBeVisible();
    for (const colorScheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({
        path: `.codex/artifacts/previews/routine-update-${colorScheme}.png`,
        animations: 'disabled',
      });
    }

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    let firstId: number | undefined;
    const finishBodies: unknown[] = [];
    let drop = true;
    await page.route('**/api/v1/session-drafts/*/finish', async (route) => {
      finishBodies.push(route.request().postDataJSON());
      const response = await route.fetch();
      if (drop) {
        drop = false;
        expect(response.status()).toBe(200);
        firstId = (await response.json()).id;
        await route.abort('failed');
      } else await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Update routine', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry Finish', exact: true })).toBeVisible();
    expect(firstId).toEqual(expect.any(Number));
    const completed = await (await request(`/sessions/${firstId}`)).json();
    expect(completed.routine_id).toBe(routine.id);
    expect(completed.exercises.map((entry: { sets: unknown[] }) => entry.sets.length)).toEqual([
      1, 0,
    ]);
    expect(completed.exercises[0].sets[0]).toMatchObject({ reps: 9, weight_kg: '42.000000' });
    expect(completed.exercises.every((entry: object) => !('routine_exercise_id' in entry))).toBe(
      true,
    );
    const updated = await (await request(`/routines/${routine.id}`)).json();
    expect(
      updated.exercises.map((entry: { default_sets: unknown[] }) => entry.default_sets.length),
    ).toEqual([1, 0]);
    expect(updated.exercises[0].default_sets[0]).toMatchObject({ reps: 9, weight_kg: '42.000000' });
    // A lost Finish response must not reapply the routine update on retry.
    expect(
      (
        await request(`/routines/${routine.id}`, 'PATCH', {
          exercises: [{ exercise_id: exerciseId, sets: [{ reps: 4, weight_kg: '88.00' }] }],
        })
      ).status,
    ).toBe(200);
    await page.getByRole('button', { name: 'Retry Finish', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
    expect(finishBodies).toHaveLength(2);
    expect(finishBodies[1]).toEqual(finishBodies[0]);
    expect(finishBodies[1]).toMatchObject({ update_routine: true });
    const retained = await (await request(`/routines/${routine.id}`)).json();
    expect(retained.exercises[0].default_sets[0]).toMatchObject({
      reps: 4,
      weight_kg: '88.000000',
    });
    await page.unroute('**/api/v1/session-drafts/*/finish');
    // Declining the update permits an entirely unfulfilled exercise without touching the template.
    await start.click();
    await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeEnabled();
    const secondFinish = page.waitForResponse(
      (response) => response.url().endsWith('/finish') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page.getByRole('button', { name: 'Keep routine', exact: true }).click();
    const second = await (await secondFinish).json();
    expect(second.exercises[0].sets).toEqual([]);
    expect(
      (await (await request(`/routines/${routine.id}`)).json()).exercises[0].default_sets[0]
        .weight_kg,
    ).toBe('88.000000');
  } finally {
    if (draftId) await request(`/session-drafts/${draftId}`, 'DELETE');
  }
});
