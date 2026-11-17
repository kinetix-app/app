import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
  await page.getByRole('button', { name: `View league information for ${name}` }).click();
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
  await bob.getByRole('button', { name: `View league information for ${name}` }).click();
  await expect(bob.getByText('League Alice', { exact: true })).toBeVisible();
  await expect(bob.getByText('League Bob (you)', { exact: true })).toBeVisible();
  await expect(bob.getByText('Admin', { exact: true })).toBeVisible();
  await expect(bob.getByText('Member', { exact: true })).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Generate invitation' })).toHaveCount(0);
  expect((await request(1, `/leagues/${lid}`, 'PATCH', { name: 'forbidden' })).status).toBe(403);
  expect((await request(1, `/leagues/${lid}/invitations`, 'POST')).status).toBe(403);
  expect((await request(1, `/league-invitations/${token}/accept`, 'POST')).status).toBe(200);
  expect((await request(1, '/league-invitations/invalid')).status).toBe(404);
  // Upload only repository-owned test images; real private storage and member authorization.
  const profileForm = new FormData();
  profileForm.append(
    'file',
    new Blob([readFileSync(path.resolve('assets/images/icon.png'))], { type: 'image/png' }),
    'icon.png',
  );
  const profileUpload = await fetch(`${api}/api/v1/me/profile/picture`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${emails[0]}:${passwords[0]}`).toString('base64')}`,
    },
    body: profileForm,
  });
  expect(profileUpload.status).toBe(200);
  const aliceId = (await profileUpload.json()).id;
  const imagePath = `/api/v1/leagues/${lid}/picture`;
  async function chooseLeagueImage(filename: string, replace = false) {
    const picker = page.waitForEvent('filechooser');
    await page
      .getByRole('button', {
        name: replace ? 'Replace league picture' : 'Choose league picture',
        exact: true,
      })
      .click();
    await (await picker).setFiles(path.resolve('assets/images', filename));
    await expect(page.getByText('New picture · Save to apply')).toBeVisible();
  }
  await chooseLeagueImage('icon.png');
  expect((await request(0, `/leagues/${lid}/picture`)).status).toBe(404);
  const uploadedPicture = page.waitForResponse(
    (response) => response.url().endsWith(imagePath) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save picture', exact: true }).click();
  expect((await uploadedPicture).status()).toBe(200);
  await expect(page.getByText('New picture · Save to apply')).toHaveCount(0);
  const firstPhoto = await request(1, `/leagues/${lid}/picture`);
  expect(firstPhoto.status).toBe(200);
  expect(firstPhoto.headers.get('cache-control')).toContain('no-store');
  const firstBytes = Buffer.from(await firstPhoto.arrayBuffer());
  expect((await request(2, `/leagues/${lid}/picture`)).status).toBe(404);
  expect((await request(1, `/leagues/${lid}/picture`, 'DELETE')).status).toBe(403);
  expect((await fetch(`${api}${imagePath}`)).status).toBe(401);
  const detailB = await (await request(1, `/leagues/${lid}`)).json();
  const alicePhoto = detailB.members.find(
    (member: { user_id: number }) => member.user_id === aliceId,
  ).picture_url;
  expect(alicePhoto).toMatch(new RegExp(`/leagues/${lid}/members/${aliceId}/picture`));
  expect(
    (
      await fetch(`${api}${alicePhoto}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${emails[1]}:${passwords[1]}`).toString('base64')}`,
        },
      })
    ).status,
  ).toBe(200);
  expect((await request(2, `/leagues/${lid}/members/${aliceId}/picture`)).status).toBe(404);
  await chooseLeagueImage('android-icon-background.png', true);
  await page.route(`**${imagePath}`, async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save picture', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save the league picture');
  await expect(page.getByText('New picture · Save to apply')).toBeVisible();
  expect(Buffer.from(await (await request(0, `/leagues/${lid}/picture`)).arrayBuffer())).toEqual(
    firstBytes,
  );
  await page.unroute(`**${imagePath}`);
  const replacedPicture = page.waitForResponse(
    (response) => response.url().endsWith(imagePath) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save picture', exact: true }).click();
  expect((await replacedPicture).status()).toBe(200);
  await expect(page.getByText('New picture · Save to apply')).toHaveCount(0);
  expect(
    Buffer.from(await (await request(0, `/leagues/${lid}/picture`)).arrayBuffer()),
  ).not.toEqual(firstBytes);
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
  await page.getByRole('button', { name: 'Back to league', exact: true }).click();
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
  await expect(page.getByLabel('#1 League Alice: 20 points, you', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'General standings', exact: true }).first().click();
  await expect(page.getByLabel('#1 League Alice: 20 points, you', { exact: true })).toBeVisible();
  await page.reload();
  await signIn(page, 0);
  await page.getByRole('tab', { name: 'League', exact: true }).click();
  await page.getByRole('button', { name: `${name} renamed`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Standings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('img', { name: `${name} renamed league picture`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'League Alice profile picture', exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: '.codex/artifacts/previews/league-standings.png' });
  await page.getByRole('button', { name: `View league information for ${name} renamed` }).click();
  await expect(
    page.getByRole('heading', { name: 'League information', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'League Alice profile picture', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Daily credit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to league', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '.codex/artifacts/previews/league-information.png',
    fullPage: true,
  });
  await page.getByRole('heading', { name: 'Members', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.codex/artifacts/previews/league-members.png' });
  const removedPicture = page.waitForResponse(
    (response) => response.url().endsWith(imagePath) && response.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Remove league picture', exact: true }).click();
  expect((await removedPicture).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: 'Choose league picture', exact: true }),
  ).toBeVisible();
  expect((await request(0, `/leagues/${lid}/picture`)).status).toBe(404);
  expect((await (await request(0, `/leagues/${lid}`)).json()).picture_url).toBeNull();
  await bob.getByRole('button', { name: 'Back to league', exact: true }).click();
  await bob.getByRole('button', { name: 'Back to leagues' }).click();
  await bob.getByRole('button', { name: `${name} renamed`, exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Round result', exact: true })).toBeVisible();
  await bob.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  expect(await (await request(1, `/leagues/${lid}/results/pending`)).json()).toEqual([]);
  await context.close();
});
