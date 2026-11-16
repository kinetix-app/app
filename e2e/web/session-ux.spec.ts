import { expect, test, type Page } from '@playwright/test';
import { minimizeWorkout } from './workout-controls';

test.use({ actionTimeout: 10000 });

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const users = ['', '_B'].map((suffix) => ({
  email: process.env[`KINETIX_E2E_EMAIL${suffix}`],
  password: process.env[`KINETIX_E2E_PASSWORD${suffix}`],
}));
async function request(path: string, method = 'GET', body?: unknown, second = false) {
  const user = users[second ? 1 : 0];
  if (!user.email || !user.password || users[0].email === users[1].email)
    throw new Error('Two private test identities required');
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${user.email}:${user.password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(users[0].email!);
  await page.getByLabel('Password', { exact: true }).fill(users[0].password!);
  const me = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await me).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
}
async function sync(page: Page) {
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' && response.url().includes('/session-drafts/'),
  );
  await page.getByRole('button', { name: 'Sync workout', exact: true }).click();
  expect((await saved).status()).toBe(200);
}
async function dragCard(page: Page, name: string, target: string, fromTitle = false) {
  const card = page.getByLabel(`Reorder ${name}`, { exact: true });
  await card.scrollIntoViewIfNeeded();
  const from = await (
    fromTitle ? page.getByRole('button', { name: `Edit sets for ${name}`, exact: true }) : card
  ).boundingBox();
  const to = await page.getByLabel(`Reorder ${target}`, { exact: true }).boundingBox();
  if (!from || !to) throw new Error('Missing drag cards');
  await page.mouse.move(from.x + 5, from.y + from.height / 2);
  await page.mouse.down();
  // A normal mouse drag starts on movement, without a long-press pause.
  await page.mouse.move(from.x + 5, from.y + from.height / 2 + (to.y > from.y ? 12 : -12));
  await expect(card).toHaveAttribute('aria-disabled', 'true');
  await page.mouse.move(to.x + 5, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(card).not.toHaveAttribute('aria-disabled', 'true');
}

test('session selection, set menus and whole-card reordering persist through sync, reload and finish', async ({
  page,
}) => {
  test.setTimeout(120000);
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Use an isolated run-owned test database');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const second of [false, true]) {
    expect((await request('/auth/me', 'GET', undefined, second)).status).toBe(200);
    expect(
      (
        await request(
          '/me/profile',
          'PATCH',
          {
            display_name: 'Session UX acceptance',
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
  const names = ['Acceptance press', 'Acceptance row', 'Acceptance squat'];
  if (!names.every((name) => catalogue.some((item: { name: string }) => item.name === name)))
    throw new Error('Seed the three synthetic Acceptance exercises in the isolated catalogue');
  const staleDraft = await (await request('/session-drafts')).json();
  if (staleDraft)
    expect(
      (await request(`/session-drafts/${staleDraft.client_session_id}`, 'DELETE')).status,
    ).toBe(204);
  await signIn(page);
  // Both entry points must use the same editor controls and persist their own data.
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  const routineName = `Shared editor ${Date.now()}`;
  await page.getByRole('button', { name: /^(New routine|Create routine)$/ }).click();
  await expect(page.getByRole('tablist', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByLabel('Routine name', { exact: true }).fill(routineName);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  for (const name of names.slice(0, 2))
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Add exercises (2)', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Close exercise picker', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
  await page.getByRole('button', { name: 'Add set to exercise 1', exact: true }).click();
  await page.getByRole('button', { name: 'Add set to exercise 1', exact: true }).click();
  await page.getByLabel('Exercise 1 set 2 kg', { exact: true }).fill('60');
  await page.getByLabel('Exercise 1 set 2 reps', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Actions for exercise 1 set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Remove set', exact: true }).click();
  await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('60');
  await expect(page.getByText('8 reps · 60 kg', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.codex/artifacts/previews/shared-routine-editor.png' });
  await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
  await dragCard(page, 'Acceptance row', 'Acceptance press');
  await dragCard(page, 'Acceptance row', 'Acceptance press', true);
  await page.getByRole('button', { name: 'Actions for Acceptance row', exact: true }).click();
  await page.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  const routineSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/routines') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  expect((await routineSaved).status()).toBe(201);
  await page.reload();
  await signIn(page);
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByRole('button', { name: `Edit ${routineName}`, exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
  await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('60.00');
  await expect(page.getByLabel('Exercise 1 set 1 reps', { exact: true })).toHaveValue('8');
  await expect(page.getByRole('button', { name: /^Edit sets for/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Back to routines', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByText('Add exercises to record your workout.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minimize workout', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  for (const name of names)
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Deselect Acceptance squat', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('row');
  await expect(
    page.getByRole('button', { name: 'Select Acceptance press', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add exercises (2)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear exercise search', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Deselect Acceptance press', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('exercise-selection-action')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({
      path: `.codex/artifacts/previews/session-ux-picker-${colorScheme}.png`,
    });
  }
  const rowId = catalogue.find((item: { name: string }) => item.name === 'Acceptance row').id;
  await page.route(
    `**/exercises/${rowId}/last-configuration?*`,
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Add exercises (2)', exact: true }).click();
  await expect(
    page.getByText('Could not add all exercises. Your remaining selection is kept. Try again.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Deselect Acceptance row', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add exercises (1)', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Close exercise picker', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Edit sets for/ })).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit sets for Acceptance row', exact: true }).click();
  await dragCard(page, 'Acceptance row', 'Acceptance press');
  await sync(page);
  let draft = await (await request('/session-drafts')).json();
  expect(draft.exercises.map((slot: { exercise_id: number }) => slot.exercise_id)).toEqual([
    rowId,
    catalogue.find((item: { name: string }) => item.name === 'Acceptance press').id,
  ]);
  await dragCard(page, 'Acceptance row', 'Acceptance press', true);
  await sync(page);
  draft = await (await request('/session-drafts')).json();
  expect(draft.exercises[1].exercise_id).toBe(rowId);
  await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
  await page.getByLabel('Exercise 1 set 1 kg', { exact: true }).fill('42.5');
  await page.getByLabel('Exercise 1 set 1 reps', { exact: true }).fill('8');
  const addedSetNumber = (await page.getByLabel(/^Exercise 1 set \d+ kg$/).count()) + 1;
  await page.getByRole('button', { name: 'Add set to exercise 1', exact: true }).click();
  await page
    .getByRole('button', { name: `Actions for exercise 1 set ${addedSetNumber}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove set', exact: true }).click();
  await expect(page.getByLabel(`Exercise 1 set ${addedSetNumber} kg`, { exact: true })).toHaveCount(
    0,
  );
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({
      path: `.codex/artifacts/previews/session-ux-editor-${colorScheme}.png`,
    });
  }
  const setSaved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' && response.url().includes('/session-drafts/'),
  );
  await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
  expect((await setSaved).status()).toBe(200);
  await page.getByRole('button', { name: 'Actions for Acceptance row', exact: true }).click();
  await page.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  await sync(page);
  draft = await (await request('/session-drafts')).json();
  expect(draft.exercises).toHaveLength(1);
  expect(draft.exercises[0].sets[0]).toMatchObject({
    weight: { value: '42.5', unit: 'kg' },
    reps: 8,
    completed: true,
  });
  expect(await (await request('/session-drafts', 'GET', undefined, true)).json()).toBeNull();
  await minimizeWorkout(page);
  await page.screenshot({ path: '.codex/artifacts/previews/floating-session-panel.png' });
  await page.reload();
  await signIn(page);
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }).click();
  await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('42.5');
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByTestId('workout-pull-handle')).toHaveCount(0);
  expect(await (await request('/session-drafts')).json()).toBeNull();
  const history = await (await request('/sessions?weight_unit=kg')).json();
  expect(history.items[0].exercises).toHaveLength(1);
  expect(history.items[0].exercises[0].sets).toHaveLength(1);
  expect(
    (await (await request('/sessions?weight_unit=kg', 'GET', undefined, true)).json()).items,
  ).toHaveLength(0);
});
