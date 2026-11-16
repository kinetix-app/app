import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
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
test('exercise detail tabs show paginated session history', async ({ page }) => {
  test.setTimeout(90000);
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Requires a run-owned test database');
  const oldDraft = await (await request('/session-drafts')).json();
  if (oldDraft)
    expect((await request(`/session-drafts/${oldDraft.client_session_id}`, 'DELETE')).status).toBe(
      204,
    );
  const endedAt = new Date().toISOString();
  const startedAt = new Date(Date.now() - 60000).toISOString();
  const catalogue = await (await request('/exercises?name=Acceptance%20press')).json();
  const id = catalogue.items[0].id;
  for (let i = 0; i < 21; i++) {
    const response = await request('/sessions', 'POST', {
      client_session_id: randomUUID(),
      started_at: startedAt,
      ended_at: endedAt,
      exercises: [{ exercise_id: id, sets: [{ reps: 12, weight: { value: '40', unit: 'kg' } }] }],
    });
    expect(response.status).toBe(201);
  }
  const name = `History ${randomUUID().slice(0, 6)}`;
  expect(
    (await request('/routines', 'POST', { name, exercises: [{ exercise_id: id }] })).status,
  ).toBe(201);
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  if (
    await page
      .getByLabel('Name', { exact: true })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByLabel('Name', { exact: true }).fill('Acceptance User');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Age (years)', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('radio', { name: 'Metric', exact: true }).click();
    await page.getByLabel('Height (cm)', { exact: true }).fill('170');
    await page.getByLabel('Weight', { exact: true }).fill('70');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByRole('radio', { name: 'Build muscle', exact: true }).click();
    await page.getByRole('button', { name: 'Save objective', exact: true }).click();
  }
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByLabel('Search routines', { exact: true }).fill(name);
  await page.getByRole('button', { name: `Routine actions for ${name}`, exact: true }).click();
  await page.getByRole('button', { name: `Train ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Details for Acceptance press', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Instructions' })).toBeVisible();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('1 · 12 reps · 40.00 kg').first()).toBeVisible();
  const localDate = await page.evaluate((instant) => new Date(instant).toLocaleString(), endedAt);
  await expect(page.getByText(localDate).first()).toBeVisible();
  await expect(page.getByText('Load more history')).toBeVisible();
  await page.getByText('Load more history').click();
  await expect.poll(() => page.getByText('1 · 12 reps · 40.00 kg').count()).toBeGreaterThan(20);
  await page.getByRole('tab', { name: 'Evolution' }).click();
  await expect(
    page.getByRole('tab', { name: 'Estimated strength (1RM)', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Weight', exact: true }).click();
  const account = await (await request('/me')).json();
  const unit = account.profile.measurement_system === 'imperial' ? 'lb' : 'kg';
  const evolution = await (await request(`/exercises/${id}/evolution?weight_unit=${unit}`)).json();
  const latest = evolution.days.at(-1);
  await expect(
    page.getByRole('button', { name: `${latest.date}, ${latest.weight} ${unit}`, exact: true }),
  ).toBeVisible();
  const draft = await (await request('/session-drafts')).json();
  if (draft)
    expect((await request(`/session-drafts/${draft.client_session_id}`, 'DELETE')).status).toBe(
      204,
    );
});
