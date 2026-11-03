import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const email = process.env.KINETIX_E2E_EMAIL ?? '';
const password = process.env.KINETIX_E2E_PASSWORD ?? '';
const headers = {
  Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
  'Content-Type': 'application/json',
};

async function clearTestDraft() {
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Use a run-owned isolated test database');
  const response = await fetch(`${api}/api/v1/session-drafts`, { headers });
  expect(response.status).toBe(200);
  const draft = await response.json();
  if (draft)
    expect(
      (
        await fetch(`${api}/api/v1/session-drafts/${draft.client_session_id}`, {
          method: 'DELETE',
          headers,
        })
      ).status,
    ).toBe(204);
}
test.beforeEach(clearTestDraft);
test.afterEach(clearTestDraft);

test('saved routine actions edit, start fresh details, retry and preserve a resumed workout', async ({
  page,
}) => {
  expect(email && password, 'Private test credentials are required').toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  const catalogue = await fetch(`${api}/api/v1/exercises?name=Acceptance%20press`, { headers });
  expect(catalogue.status).toBe(200);
  const exerciseId = (await catalogue.json()).items[0].id;
  const name = `Routine actions ${randomUUID()}`;
  const created = await fetch(`${api}/api/v1/routines`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      exercises: [
        { exercise_id: exerciseId, sets: [{ reps: 5, weight_kg: '20.00' }] },
        { exercise_id: exerciseId, sets: [{ reps: 6, weight_kg: '30.00' }] },
      ],
    }),
  });
  expect(created.status).toBe(201);
  const routine = await created.json();
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const me = page.waitForResponse((value) => value.url().endsWith('/api/v1/auth/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await me).status()).toBe(200);
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByLabel('Search routines', { exact: true }).fill(name);
  const edit = page.getByRole('button', { name: `Edit ${name}`, exact: true });
  const start = page.getByRole('button', { name: `Train ${name}`, exact: true });
  const actions = page.getByRole('button', { name: `Routine actions for ${name}`, exact: true });
  await expect(edit).toBeVisible();
  await expect(start).toHaveCount(0);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({
      path: `.codex/artifacts/previews/routine-card-menu-${colorScheme}.png`,
    });
    await actions.click();
    await expect(start).toBeVisible();
    await expect(page.getByText('Routine options', { exact: true })).toHaveCount(0);
    for (const control of [edit, start]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
    await page.screenshot({ path: `.codex/artifacts/previews/routine-actions-${colorScheme}.png` });
    await expect(start).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(start).toHaveCount(0);
    await expect(actions).toBeFocused();
  }
  await actions.click();
  await page.getByTestId('routine-actions-backdrop').click({ position: { x: 8, y: 8 } });
  await expect(start).toHaveCount(0);
  await actions.click();
  await edit.click();
  await expect(page.getByLabel('Routine name', { exact: true })).toHaveValue(name);
  await expect(
    page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Back to routines', exact: true }).click();

  const path = `**/api/v1/routines/${routine.id}*`;
  await page.route(path, (route) => route.abort('failed'));
  await actions.click();
  await start.click();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minimize workout', exact: true })).toHaveCount(0);
  await page.unroute(path);
  const detail = page.waitForResponse(
    (value) => new URL(value.url()).pathname === `/api/v1/routines/${routine.id}`,
  );
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  expect((await detail).status()).toBe(200);
  const slots = page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true });
  await expect(slots).toHaveCount(2);
  await slots.first().click();
  await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Exercise 1 set 1 reps', { exact: true })).toHaveValue('');
  await page.getByLabel('Exercise 1 set 1 kg', { exact: true }).fill('42');
  await page.getByLabel('Exercise 1 set 1 reps', { exact: true }).fill('9');
  await page.getByRole('button', { name: /^Edit sets for /, expanded: true }).click();
  await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
  await page.route(path, (route) => route.abort('failed'));
  await actions.click();
  await expect(start).toBeDisabled();
  await expect(page.getByRole('button', { name: `Delete ${name}`, exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Close routine actions', exact: true }).click();
  const resume = page.getByRole('button', { name: 'Resume workout', exact: true });
  await expect(resume).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(resume).toHaveCSS('border-width', '1px');
  expect(await resume.evaluate((element) => getComputedStyle(element).borderColor)).toBe(
    await page
      .getByRole('button', { name: 'Start workout', exact: true })
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  );
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(slots).toHaveCount(2);
  await slots.first().click();
  await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('42');
  await expect(page.getByLabel('Exercise 1 set 1 reps', { exact: true })).toHaveValue('9');
  await page.getByRole('button', { name: /^Edit sets for /, expanded: true }).click();
  await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
  await page.reload();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await slots.first().click();
  await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('42');
  await expect(page.getByLabel('Exercise 1 set 1 reps', { exact: true })).toHaveValue('9');
  await page.getByRole('button', { name: /^Edit sets for /, expanded: true }).click();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
});
