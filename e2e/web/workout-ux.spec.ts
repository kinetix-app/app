import { selectExercise, minimizeWorkout } from './workout-controls';
import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.use({ actionTimeout: 10000 });

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const credentials = [
  [process.env.KINETIX_E2E_EMAIL, process.env.KINETIX_E2E_PASSWORD],
  [process.env.KINETIX_E2E_EMAIL_B, process.env.KINETIX_E2E_PASSWORD_B],
];
function headers(second = false) {
  const [email, password] = credentials[second ? 1 : 0];
  if (!email || !password || credentials[0][0] === credentials[1][0])
    throw new Error('Two private test identities required');
  return {
    Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
    'Content-Type': 'application/json',
  };
}
async function request(path: string, method = 'GET', body?: unknown, second = false) {
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: headers(second),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function signIn(page: Page, second = false) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(credentials[second ? 1 : 0][0]!);
  await page.getByLabel('Password', { exact: true }).fill(credentials[second ? 1 : 0][1]!);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workouts', exact: true })).toBeVisible();
}
async function chooseCover(page: Page, label: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: label, exact: true }).click();
  await (await chooser).setFiles('assets/images/icon.png');
}

test('compact routine workspace saves notes and private covers, retries without duplicates and updates last training', async ({
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
            display_name: 'Workout acceptance',
            age: 30,
            height_cm: '170.00',
            weight_kg: '70.000000',
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
  await signIn(page);
  const isEmpty = (await (await request('/routines')).json()).items.length === 0;
  if (isEmpty)
    await expect(page.getByText('Build your first routine', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'History', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toHaveCount(1);
  await page
    .getByRole('button', { name: isEmpty ? 'Create routine' : 'New routine', exact: true })
    .click();
  const name = `Upper body ${randomUUID().slice(0, 8)}`;
  const notes =
    'Control the lowering phase. Keep your shoulders steady. Rest 90 seconds between sets. '
      .repeat(4)
      .trim();
  await page.getByLabel('Routine name', { exact: true }).fill(name);
  await expect(page.getByLabel('Routine notes', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add routine notes', exact: true }).click();
  await page.getByLabel('Routine notes', { exact: true }).fill(notes);
  await expect(page.getByRole('button', { name: 'Start routine', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Acceptance press');
  await selectExercise(page, 'Acceptance press');
  await expect(page.getByRole('button', { name: 'Add routine cover', exact: true })).toHaveCount(0);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const saveBox = await page
      .getByRole('button', { name: 'Save routine', exact: true })
      .boundingBox();
    expect(saveBox!.y).toBeLessThan(100);
    expect(saveBox!.x).toBeGreaterThan(300);
    await page.screenshot({
      path: `.codex/artifacts/previews/workout-94-editor-${colorScheme}.png`,
    });
  }
  let createRequests = 0;
  let picturePosts = 0;
  page.on('request', (value) => {
    if (new URL(value.url()).pathname === '/api/v1/routines' && value.method() === 'POST')
      createRequests++;
    if (
      /\/api\/v1\/routines\/\d+\/picture$/.test(new URL(value.url()).pathname) &&
      value.method() === 'POST'
    )
      picturePosts++;
  });
  const picturePath = /\/api\/v1\/routines\/\d+\/picture(?:\?.*)?$/;
  const createPath = '**/api/v1/routines';
  await page.route(createPath, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Image storage unavailable' }),
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText(/Routine details saved/)).toHaveCount(0);
  await expect(page.getByLabel('Routine name', { exact: true })).toHaveValue(name);
  await expect(page.getByLabel('Routine cover', { exact: true })).toHaveCount(0);
  expect(
    (await (await request(`/routines?name=${encodeURIComponent(name)}`)).json()).items,
  ).toHaveLength(0);
  await page.unroute(createPath);
  await page.route(picturePath, (route) =>
    route.request().method() === 'GET' ? route.abort('failed') : route.continue(),
  );
  const created = page.waitForResponse(
    (value) =>
      value.request().method() === 'POST' && new URL(value.url()).pathname === '/api/v1/routines',
  );
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  const createResponse = await created;
  expect(createResponse.status()).toBe(201);
  expect((await createResponse.json()).image_url).toBeNull();
  const createRequest = createResponse.request();
  expect(createRequest.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  const body = createRequest.postDataBuffer();
  expect(Boolean(body?.includes(Buffer.from('name="content"')))).toBe(true);
  expect(Boolean(body?.includes(Buffer.from('name="file"')))).toBe(false);
  await page.getByLabel('Search routines', { exact: true }).fill(name);
  await expect(page.getByRole('button', { name: /^Routine actions for / })).toHaveCount(1);
  const edit = page.getByRole('button', { name: `Edit ${name}`, exact: true });
  const actions = page.getByRole('button', { name: `Routine actions for ${name}`, exact: true });
  const start = page.getByRole('button', { name: `Start ${name}`, exact: true });
  await expect(edit).toBeVisible();
  expect(createRequests).toBe(2);
  expect(picturePosts).toBe(0);
  await actions.click();
  // Choosing the file immediately posts it through the cover endpoint.
  await page.route(
    picturePath,
    (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.fallback(),
    { times: 1 },
  );
  await chooseCover(page, `Add cover for ${name}`);
  await expect(page.getByText('Could not update the cover. Try again.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry cover upload', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Close routine actions', exact: true }),
  ).toHaveCount(0);
  expect(picturePosts).toBe(2);

  await expect(page.getByText('1 exercise', { exact: true })).toBeVisible();
  await expect(page.getByText('Not trained yet', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry routine cover', exact: true }),
  ).toBeVisible();
  await expect(page.locator('button button')).toHaveCount(0);
  await page.unroute(picturePath);
  await page.getByRole('button', { name: 'Retry routine cover', exact: true }).click();
  await expect(page.getByLabel('Routine cover', { exact: true })).toBeVisible();
  await expect(edit).toBeVisible();
  const list = await (await request(`/routines?name=${encodeURIComponent(name)}`)).json();
  expect(list.items).toHaveLength(1);
  const routine = list.items[0];
  expect(routine.notes).toBe(notes);
  expect(routine.exercise_count).toBe(1);
  expect(routine.last_performed_at).toBeNull();
  expect((await request(`/routines/${routine.id}/picture`, 'GET', undefined, true)).status).toBe(
    404,
  );
  expect((await fetch(`${api}/api/v1/routines/${routine.id}/picture`)).status).toBe(401);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const control of [edit, actions]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
    await page.screenshot({ path: `.codex/artifacts/previews/workout-94-list-${colorScheme}.png` });
  }
  await page.reload();
  await signIn(page);
  await page.getByLabel('Search routines', { exact: true }).fill(name);
  await expect(page.getByRole('button', { name: /^Routine actions for / })).toHaveCount(1);
  await expect(page.getByLabel('Routine cover', { exact: true })).toBeVisible();
  await actions.click();
  await chooseCover(page, `Change cover for ${name}`);
  await expect(
    page.getByRole('button', { name: 'Close routine actions', exact: true }),
  ).toHaveCount(0);
  expect(picturePosts).toBe(3);
  await edit.click();
  await expect(page.getByLabel('Routine notes', { exact: true })).toHaveValue(notes);
  await page.getByLabel('Routine notes', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Remove routine cover', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(edit).toBeVisible();
  await actions.click();
  await page.getByRole('button', { name: `Remove cover for ${name}`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Add cover for ${name}`, exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Close routine actions', exact: true }).click();
  await expect(page.getByLabel('Routine cover', { exact: true })).toHaveCount(0);
  const cleared = await (await request(`/routines/${routine.id}`)).json();
  expect(cleared.notes).toBeNull();
  expect(cleared.image_url).toBeNull();
  await start.click();
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeEnabled();
  await minimizeWorkout(page);
  await expect(start).toBeDisabled();
  await expect(page.getByText('1 exercise', { exact: true })).toBeVisible();
  await expect(page.getByText('Not trained yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  const finished = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/finish'),
  );
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Keep routine', exact: true }).click();
  await expect(page.getByLabel(/^Last trained /)).toBeVisible();
  const performed = await (await request(`/routines/${routine.id}`)).json();
  expect(performed.last_performed_at).not.toBeNull();
  const completed = await (await finished).json();
  await actions.click();
  await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Delete routine?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep routine', exact: true }).click();
  expect((await request(`/routines/${routine.id}`)).status).toBe(200);
  await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
  const deletePath = `**/api/v1/routines/${routine.id}`;
  await page.route(deletePath, (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'unavailable' }),
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: `Confirm delete ${name}`, exact: true }).click();
  await expect(
    page.getByText('Could not delete the routine. Try again.', { exact: true }),
  ).toBeVisible();
  expect((await request(`/routines/${routine.id}`)).status).toBe(200);
  await page.unroute(deletePath);
  const deleted = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      new URL(response.url()).pathname === `/api/v1/routines/${routine.id}`,
  );
  await page.getByRole('button', { name: `Confirm delete ${name}`, exact: true }).click();
  expect((await deleted).status()).toBe(204);
  await expect(page.getByRole('heading', { name: 'Delete routine?', exact: true })).toHaveCount(0);
  await expect(actions).toHaveCount(0);
  expect((await request(`/routines/${routine.id}`)).status).toBe(404);
  const history = await request(`/sessions/${completed.id}`);
  expect(history.status).toBe(200);
  expect((await history.json()).routine_id).toBe(routine.id);

  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page, true);
  await expect(page.getByText('Build your first routine', { exact: true })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});
