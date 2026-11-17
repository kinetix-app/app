import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const api = process.env.KINETIX_API_URL!;
const emails = [
  process.env.KINETIX_E2E_EMAIL!,
  process.env.KINETIX_E2E_EMAIL_B!,
  process.env.KINETIX_E2E_EMAIL_OUTSIDER!,
];
const passwords = [
  process.env.KINETIX_E2E_PASSWORD!,
  process.env.KINETIX_E2E_PASSWORD_B!,
  process.env.KINETIX_E2E_PASSWORD_OUTSIDER!,
];
async function request(index: number, route: string, method = 'GET', body?: unknown) {
  return fetch(`${api}/api/v1${route}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${emails[index]}:${passwords[index]}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function signIn(page: Page, index: number, route = '/') {
  await page.goto(route);
  await page.getByLabel('Email', { exact: true }).fill(emails[index]);
  await page.getByLabel('Password', { exact: true }).fill(passwords[index]);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('tab', { name: 'League', exact: true })).toBeVisible({
    timeout: 30000,
  });
}
function prepare(lid?: number, history = false) {
  if (!process.env.KINETIX_BACKEND_ROOT) throw new Error('Set KINETIX_BACKEND_ROOT');
  execFileSync(
    'uv',
    [
      'run',
      '--locked',
      '--no-build',
      'python',
      path.resolve('e2e/web/league_fixture.py'),
      ...(lid ? [String(lid), ...(history ? ['history'] : [])] : []),
    ],
    {
      cwd: process.env.KINETIX_BACKEND_ROOT,
      env: { ...process.env, PYTHONPATH: process.env.KINETIX_BACKEND_ROOT },
      stdio: 'pipe',
    },
  );
}

test('private league create/join, persisted scoring, isolation and independent saved-result acknowledgement', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  if (
    process.env.APP_ENV !== 'test' ||
    !process.env.DATABASE_URL?.split('/').pop()?.startsWith('friends_league_') ||
    !process.env.DATABASE_URL.endsWith('_test') ||
    new Set(emails).size !== 3 ||
    passwords.some((value) => !value)
  )
    throw new Error('Three isolated identities and a run-owned _test database required');
  await page.setViewportSize({ width: 390, height: 844 });
  prepare();
  for (let i = 0; i < 3; i++) {
    expect((await request(i, '/auth/me')).status).toBe(200);
    expect(
      (
        await request(i, '/me/profile', 'PATCH', {
          display_name: ['League Alice', 'League Bob', 'League Outsider'][i],
          age: 30,
          height_cm: '170',
          weight_kg: '80',
          measurement_system: 'metric',
          timezone: 'Europe/Madrid',
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(i, '/me/objective', 'PUT', { objective: 'maintain_weight' })).status,
    ).toBe(200);
  }
  const name = `Acceptance league ${randomUUID().slice(0, 8)}`;
  await signIn(page, 0);
  await page.getByRole('tab', { name: 'League', exact: true }).click();
  await page.getByRole('button', { name: 'Create league', exact: true }).click();
  await page.getByLabel('League name', { exact: true }).fill(name);
  await page.getByLabel('IANA timezone').fill('Europe/Madrid');
  await page.getByRole('button', { name: 'Create league', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const lid = (await (await request(0, '/leagues')).json()).find(
    (item: { name: string }) => item.name === name,
  ).id;
  expect((await request(2, `/leagues/${lid}`)).status).toBe(404);
  await page.getByRole('button', { name: 'Generate invitation' }).click();
  const link = await page
    .getByText(/league-invitation\//)
    .first()
    .textContent();
  expect(link).toBeTruthy();
  const token = link!.trim().split('/').pop()!;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bob = await context.newPage();
  await signIn(bob, 1, `/league-invitation/${token}`);
  await expect(bob.getByLabel('Invitation link or token')).toHaveValue(token);
  await bob.getByRole('button', { name: 'Preview invitation' }).click();
  await expect(bob.getByText(`Join ${name}?`, { exact: true })).toBeVisible();
  expect(
    (await (await request(1, '/leagues')).json()).some((item: { id: number }) => item.id === lid),
  ).toBe(false);
  await bob.getByRole('button', { name: 'Confirm joining' }).click();
  await expect(bob.getByText('League Alice · admin', { exact: true })).toBeVisible();
  await expect(bob.getByText('League Bob · member', { exact: true })).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Generate invitation' })).toHaveCount(0);
  expect((await request(1, `/leagues/${lid}`, 'PATCH', { name: 'forbidden' })).status).toBe(403);
  expect((await request(1, `/leagues/${lid}/invitations`, 'POST')).status).toBe(403);
  expect((await request(1, `/league-invitations/${token}/accept`, 'POST')).status).toBe(200);
  expect((await request(1, '/league-invitations/invalid')).status).toBe(404);
  await page.getByLabel('New league name').fill(`${name} renamed`);
  await page.getByRole('button', { name: 'Rename league' }).click();
  await expect(page.getByRole('heading', { name: `${name} renamed`, exact: true })).toBeVisible();
  // Historical membership/creation fixture only: real scoring still uses completed-session API.
  prepare(lid);
  const catalogue = await (await request(0, '/exercises?name=League%20acceptance%20press')).json();
  const exerciseId = catalogue.items[0].id;
  const ended = new Date();
  const started = new Date(ended.getTime() - 3600000);
  const session = (reps: number) => ({
    client_session_id: randomUUID(),
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    exercises: [{ exercise_id: exerciseId, sets: [{ reps, weight_kg: '80' }] }],
  });
  const high = session(20);
  for (const payload of [session(10), session(5), high, high])
    expect([200, 201]).toContain((await request(0, '/sessions', 'POST', payload)).status);
  const standings = await (await request(0, `/leagues/${lid}/standings`)).json();
  expect(
    standings.general.find((row: { display_name: string }) => row.display_name === 'League Alice')
      .score,
  ).toBe('20');
  expect(
    standings.general.find((row: { display_name: string }) => row.display_name === 'League Bob')
      .score,
  ).toBe('0');
  const other = await (await request(1, `/leagues/${lid}/standings`)).json();
  expect(
    other.rounds
      .flatMap((round: { contributions: unknown[] }) => round.contributions)
      .every((entry: { calculation?: unknown }) => !entry.calculation),
  ).toBe(true);
  // Reopen, display persisted closed all-zero round, and acknowledge as A only.
  prepare(lid, true);
  await page.getByRole('button', { name: 'Back to leagues' }).click();
  await page.getByRole('button', { name: `${name} renamed`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Round result', exact: true })).toBeVisible();
  const pendingA = await (await request(0, `/leagues/${lid}/results/pending`)).json();
  expect(pendingA).toHaveLength(1);
  expect(pendingA[0].loser_user_ids).toHaveLength(2);
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  expect(await (await request(0, `/leagues/${lid}/results/pending`)).json()).toEqual([]);
  expect(await (await request(1, `/leagues/${lid}/results/pending`)).json()).toHaveLength(1);
  await expect(page.getByText('#1 League Alice: 20 points', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'General standings', exact: true }).first().click();
  await expect(page.getByText('#1 League Alice: 20 points', { exact: true })).toBeVisible();
  await page.reload();
  await signIn(page, 0);
  await page.getByRole('tab', { name: 'League', exact: true }).click();
  await page.getByRole('button', { name: `${name} renamed`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Standings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  await bob.getByRole('button', { name: 'Back to leagues' }).click();
  await bob.getByRole('button', { name: `${name} renamed`, exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Round result', exact: true })).toBeVisible();
  await bob.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  expect(await (await request(1, `/leagues/${lid}/results/pending`)).json()).toEqual([]);
  await context.close();
});
