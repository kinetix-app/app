import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

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
async function signIn(page: Page, second = false) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(credentials[second ? 1 : 0][0]!);
  await page.getByLabel('Password', { exact: true }).fill(credentials[second ? 1 : 0][1]!);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toBeVisible();
}
const profileTab = (page: Page) => page.getByRole('tab', { name: 'Profile', exact: true });
async function signOut(page: Page) {
  await profileTab(page).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
}

test('private Profile edits persist, history and Progress navigate correctly, and logout isolates accounts and server drafts', async ({
  page,
}) => {
  test.setTimeout(120000);
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Use a run-owned isolated test database and APP_ENV=test');
  for (const second of [false, true]) {
    const previousDraft = await (await request('/session-drafts', 'GET', undefined, second)).json();
    if (previousDraft)
      expect(
        (
          await request(
            `/session-drafts/${previousDraft.client_session_id}`,
            'DELETE',
            undefined,
            second,
          )
        ).status,
      ).toBe(204);
    expect((await request('/auth/me', 'GET', undefined, second)).status).toBe(200);
    expect(
      (
        await request(
          '/me/profile',
          'PATCH',
          {
            display_name: second ? 'Acceptance Bob' : 'Acceptance Alice',
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
  const catalogue = await (await request('/exercises?name=Acceptance%20press')).json();
  const completedResponse = await request('/sessions', 'POST', {
    client_session_id: randomUUID(),
    started_at: '2026-10-31T10:00:00Z',
    ended_at: '2026-10-31T10:30:00Z',
    exercises: [
      {
        exercise_id: catalogue.items[0].id,
        sets: [{ reps: 8, weight: { value: '30', unit: 'kg' } }],
      },
    ],
  });
  expect(completedResponse.status).toBe(201);
  const completed = await completedResponse.json();
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toHaveCount(0);
  await profileTab(page).click();
  await expect(page.getByRole('tablist')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Maintain weight', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({ path: `.codex/artifacts/previews/profile-86-${colorScheme}.png` });
  }
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Acceptance Alice updated');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await profileTab(page).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Acceptance Alice updated');
  await page.getByRole('radio', { name: 'Imperial', exact: true }).click();
  await page.route('**/api/v1/me/profile', (route) =>
    route.request().method() === 'PATCH' ? route.abort('failed') : route.continue(),
  );
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save your profile');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Acceptance Alice updated');
  await page.unroute('**/api/v1/me/profile');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toBeVisible();
  const saved = await (await request('/auth/me')).json();
  expect(saved.profile).toMatchObject({
    display_name: 'Acceptance Alice updated',
    measurement_system: 'imperial',
    weight_kg: '70.000000',
  });
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
  await expect(
    page.getByText('Acceptance Alice updated', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.reload();
  await signIn(page);
  await profileTab(page).click();
  await expect(
    page.getByText('Acceptance Alice updated', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('154.32 lb', { exact: true })).toBeVisible();
  await expect(page.getByText('Measurement recording is not available yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to profile', exact: true }).click();
  await page.getByRole('button', { name: 'Training history', exact: true }).click();
  await page.getByRole('button', { name: `View workout ${completed.id}`, exact: true }).click();
  await expect(page.getByText('1. Acceptance press', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to history', exact: true }).click();
  await page.getByRole('button', { name: 'Back to profile', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
  const draft = await (await request('/session-drafts')).json();
  await signOut(page);
  await signIn(page, true);
  await profileTab(page).click();
  await expect(
    page.getByText('Acceptance Bob', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText('Acceptance Alice updated', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Training history', exact: true }).click();
  await expect(page.getByText('No completed workouts yet.', { exact: true })).toBeVisible();
  expect((await request(`/sessions/${completed.id}`, 'GET', undefined, true)).status).toBe(404);
  await page.getByRole('button', { name: 'Back to profile', exact: true }).click();
  await signOut(page);
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  expect((await (await request('/session-drafts')).json()).client_session_id).toBe(
    draft.client_session_id,
  );
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  // Leave the shared synthetic identity ready for the photo regression.
  expect((await request('/me/profile', 'PATCH', { display_name: 'Acceptance Alice' })).status).toBe(
    200,
  );
});
