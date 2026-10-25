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
async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const me = page.waitForResponse((r) => r.url().endsWith('/api/v1/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await me).status()).toBe(200);
}

test('shared editor and real server draft tick, retry, resume, discard and completion', async ({
  page,
}) => {
  test.setTimeout(120000);
  expect(email && password, 'Private integration profile is required').toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  const catalogue = await fetch(`${api}/api/v1/exercises?name=Acceptance%20press`, { headers });
  const exerciseId = (await catalogue.json()).items[0].id;
  const guidance = await fetch(`${api}/api/v1/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      client_session_id: randomUUID(),
      started_at: new Date(Date.now() - 60000).toISOString(),
      ended_at: new Date().toISOString(),
      exercises: [
        {
          exercise_id: exerciseId,
          sets: Array.from({ length: 4 }, () => ({
            reps: 6,
            weight: { value: '100', unit: 'kg' },
          })),
        },
      ],
    }),
  });
  expect(guidance.status).toBe(201);
  const name = `Draft ${randomUUID().slice(0, 8)}`;
  const response = await fetch(`${api}/api/v1/routines`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      exercises: [
        {
          exercise_id: exerciseId,
          sets: Array.from({ length: 4 }, () => ({ reps: 6, weight_kg: '100.00' })),
        },
      ],
    }),
  });
  expect(response.status).toBe(201);
  const routine = await response.json();
  let clientId: string | undefined;
  try {
    await signIn(page);
    await page.getByLabel('Search routines', { exact: true }).fill(name);
    await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
    await expect(page.getByLabel('Exercise 1 set 4 kg', { exact: true })).toHaveValue('100.00');
    await page.getByRole('button', { name: /^Edit sets for /, expanded: true }).click();
    const started = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes('/session-drafts/'),
    );
    await page.getByRole('button', { name: 'Start routine', exact: true }).click();
    expect((await started).status()).toBe(200);
    const server = await (await fetch(`${api}/api/v1/session-drafts`, { headers })).json();
    clientId = server.client_session_id;
    expect(server.state).toBe('draft');
    expect(server.routine_id).toBe(routine.id);
    const startedAt = server.started_at;
    await expect(page.getByText(/^Started /)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Display weight in kg', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Edit sets for Acceptance press', exact: true })
      .scrollIntoViewIfNeeded();
    const drag = await page
      .getByRole('button', { name: 'Reorder Acceptance press', exact: true })
      .boundingBox();
    const title = await page
      .getByRole('button', { name: 'Edit sets for Acceptance press', exact: true })
      .boundingBox();
    expect(
      drag && title && drag.x > title.x && Math.abs(drag.y - title.y) < 2,
      JSON.stringify({ drag, title }),
    ).toBeTruthy();

    await page.getByRole('button', { name: 'Details for Acceptance press', exact: true }).click();
    await expect(
      page.getByText('1. Press with controlled movement.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
    for (let i = 1; i <= 4; i++) {
      await page
        .getByLabel(`Exercise 1 set ${i} kg`, { exact: true })
        .fill(i < 3 ? '100' : '102.5');
      await page.getByLabel(`Exercise 1 set ${i} reps`, { exact: true }).fill('6');
    }

    for (let i = 1; i <= 2; i++) {
      await page.getByRole('button', { name: `Save exercise 1 set ${i}`, exact: true }).click();
      await expect(
        page.getByRole('button', { name: `Unsave exercise 1 set ${i}`, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole('button', { name: 'Record set 3 (coming soon)', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Unsave exercise 1 set 1', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }),
    ).toBeVisible();
    const unticked = await (await fetch(`${api}/api/v1/session-drafts`, { headers })).json();
    expect(unticked.exercises[0].sets[0]).toMatchObject({
      completed: false,
      reps: 6,
      weight: { value: '100', unit: 'kg' },
    });
    await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('100');
    await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 1 set 1', exact: true }),
    ).toBeVisible();
    for (const colorScheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme });
      const fields = page.getByLabel('Exercise 1 set 1 kg', { exact: true });
      await fields.scrollIntoViewIfNeeded();
      const box = await fields.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 390).toBeTruthy();
      await page.screenshot({ path: `.codex/artifacts/previews/draft-sets-${colorScheme}.png` });
    }
    let fail = true;
    await page.route('**/api/v1/session-drafts/*', async (route) => {
      if (fail && route.request().method() === 'PUT') {
        fail = false;
        await route.abort('failed');
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Save exercise 1 set 3', exact: true }).click();
    await expect(
      page.getByText(
        'Could not save the workout. Your changes are retained. Retry the tick or Sync workout.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Exercise 1 set 3 kg', { exact: true })).toHaveValue('102.5');
    await page.getByRole('button', { name: 'Save exercise 1 set 3', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 1 set 3', exact: true }),
    ).toBeVisible();
    // Editing a confirmed result clears its tick and requires a new server confirmation.
    await page.getByLabel('Exercise 1 set 3 reps', { exact: true }).fill('7');
    await page.getByRole('button', { name: 'Save exercise 1 set 3', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 1 set 3', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save exercise 1 set 4', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
    const floating = await page
      .getByRole('button', { name: 'Ongoing workout options', exact: true })
      .boundingBox();
    expect(floating && floating.y > 650).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Minimize workout', exact: true })).toHaveCount(
      0,
    );
    for (const colorScheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({
        path: `.codex/artifacts/previews/ongoing-workout-${colorScheme}.png`,
        animations: 'disabled',
      });
    }

    await page.getByRole('button', { name: 'Ongoing workout options', exact: true }).click();
    await expect(page.getByText('Discard this workout?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
    const grip = page.getByTestId('workout-pull-handle');
    await grip.scrollIntoViewIfNeeded();
    const gripBox = await grip.boundingBox();
    expect(gripBox).toBeTruthy();
    await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + 10);
    await page.mouse.down();
    await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + 110, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await signIn(page);
    await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
    await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
    await expect(page.getByLabel('Exercise 1 set 3 reps', { exact: true })).toHaveValue('7');
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 1 set 3', exact: true }),
    ).toBeVisible();
    const restored = await (await fetch(`${api}/api/v1/session-drafts`, { headers })).json();
    expect(restored.started_at).toBe(startedAt);
    expect(restored.client_session_id).toBe(clientId);
    await page.getByRole('button', { name: /^Edit sets for /, expanded: true }).click();
    const finished = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith('/finish'),
    );
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page.getByRole('button', { name: 'Keep routine', exact: true }).click();
    const completed = await finished;
    expect(completed.status()).toBe(200);
    const workout = await completed.json();
    expect(workout.state).toBe('completed');
    expect(workout.exercises[0].sets[2]).toMatchObject({ weight_kg: '102.500000', reps: 7 });
    expect(await (await fetch(`${api}/api/v1/session-drafts`, { headers })).json()).toBeNull();
    const history = await (await fetch(`${api}/api/v1/sessions/${workout.id}`, { headers })).json();
    expect(history.id).toBe(workout.id);
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
    expect(await (await fetch(`${api}/api/v1/session-drafts`, { headers })).json()).toBeNull();
  } finally {
    if (clientId)
      await fetch(`${api}/api/v1/session-drafts/${clientId}`, { method: 'DELETE', headers });
  }
});
