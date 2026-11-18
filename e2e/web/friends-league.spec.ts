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
  const description = 'A friendly weekly challenge for consistent lifters.';
  await page.getByLabel('League description', { exact: true }).fill(description);
  async function chooseLeagueImage(filename: string, replace = false) {
    const picker = page.waitForEvent('filechooser');
    await page
      .getByRole('button', {
        name: replace ? 'Replace league picture' : 'Choose league picture',
        exact: true,
      })
      .click();
    await (await picker).setFiles(path.resolve('assets/images', filename));
    await expect(
      page.getByRole('button', { name: 'Replace league picture', exact: true }),
    ).toBeVisible();
  }
  const timezone = 'Europe/Paris';
  await page.getByRole('button', { name: /^Timezone:/ }).click();
  await page.getByLabel('Search timezones').fill('Paris');
  const timezoneOption = page.getByRole('button', { name: timezone, exact: true });
  await expect(timezoneOption).toBeVisible();
  await timezoneOption.click();
  await expect(
    page.getByRole('button', { name: `Timezone: ${timezone}`, exact: true }),
  ).toBeVisible();
  await chooseLeagueImage('icon.png');
  await page.screenshot({
    path: '.codex/artifacts/previews/league-create.png',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Create league', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const lid = (await (await request(0, '/leagues')).json()).find(
    (item: { name: string }) => item.name === name,
  ).id;
  expect((await request(2, `/leagues/${lid}`)).status).toBe(404);
  await page.getByRole('button', { name: `View league information for ${name}` }).click();
  const imagePath = `/api/v1/leagues/${lid}/picture`;
  const configPath = `/api/v1/leagues/${lid}/configuration`;
  expect((await (await request(0, `/leagues/${lid}`)).json()).timezone).toBe(timezone);
  await expect(page.getByRole('tab', { name: 'League', exact: true })).toHaveCount(0);
  await expect(page.getByRole('img', { name: `${name} league picture` })).toBeVisible();

  await page.getByRole('button', { name: 'Generate invitation' }).click();
  await expect(page.getByRole('heading', { name: 'Invitation link', exact: true })).toBeVisible();
  const linkText = page.getByText(/league-invitation\//).first();
  const link = (await linkText.textContent())?.trim();
  expect(Boolean(link)).toBe(true);
  const token = link!.split('/').pop()!;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await linkText.click();
  await expect(page.getByText('Link copied', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      async (expected) => (await navigator.clipboard.readText()) === expected,
      link,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.codex/artifacts/previews/league-share-invitation.png',
    mask: [linkText],
    maskColor: '#1d2720',
    animations: 'disabled',
  });
  await page.evaluate((expected) => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        document.documentElement.dataset.expectedInvitationShared = String(data.url === expected);
      },
    });
  }, link);
  await page.getByRole('button', { name: 'Share invitation', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-expected-invitation-shared', 'true');
  await page.getByRole('button', { name: 'Close invitation link', exact: true }).click();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bob = await context.newPage();
  await signIn(bob, 1, `/league-invitation/${token}`);
  await expect(bob.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(bob.getByText(description, { exact: true })).toBeVisible();
  await expect(bob.getByText('Members', { exact: true })).toBeVisible();
  await expect(bob.getByText('1', { exact: true })).toBeVisible();
  const preview = await (await request(1, `/league-invitations/${token}`)).json();
  const created = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(preview.created_at));
  await expect(bob.getByText(created, { exact: true })).toBeVisible();
  await expect(bob.getByRole('img', { name: `${name} league picture`, exact: true })).toBeVisible();
  await bob.screenshot({ path: '.codex/artifacts/previews/league-invitation.png' });
  expect(
    (await (await request(1, '/leagues')).json()).some((item: { id: number }) => item.id === lid),
  ).toBe(false);
  await expect(bob.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  await bob.getByRole('button', { name: 'Close invitation', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Your leagues', exact: true })).toBeVisible();
  await bob.getByRole('button', { name: 'Join a league', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Join a league', exact: true })).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Close join a league', exact: true })).toBeVisible();
  await bob.getByLabel('Invitation link or token').fill(token);
  await bob.getByRole('button', { name: 'Preview invitation' }).click();
  await expect(bob.getByRole('heading', { name, exact: true })).toBeVisible();
  await bob.getByRole('button', { name: 'Join league' }).click();
  await bob.getByRole('button', { name: 'Back to leagues', exact: true }).click();
  await bob.getByRole('button', { name: 'Join a league', exact: true }).click();
  await bob.getByLabel('Invitation link or token').fill(token);
  await bob.getByRole('button', { name: 'Preview invitation' }).click();
  await expect(
    bob.getByText('You’re already a member of this league.', { exact: true }),
  ).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Join league', exact: true })).toHaveCount(0);
  await bob.screenshot({
    path: '.codex/artifacts/previews/league-already-member.png',
    animations: 'disabled',
  });
  await bob.getByRole('button', { name: 'Open league', exact: true }).click();

  await bob.getByRole('button', { name: `View league information for ${name}` }).click();
  await expect(bob.getByText('League Alice', { exact: true })).toBeVisible();
  await expect(bob.getByText('League Bob (you)', { exact: true })).toBeVisible();
  await expect(bob.getByText('Admin', { exact: true })).toBeVisible();
  await expect(bob.getByText('Member', { exact: true })).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Generate invitation' })).toHaveCount(0);
  await expect(
    bob.getByRole('button', { name: 'Change role for League Alice', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to league', exact: true }).click();
  await page
    .getByRole('button', { name: `View league information for ${name}`, exact: true })
    .click();
  const roleControl = page.getByRole('button', { name: 'Change role for League Bob', exact: true });
  await expect(roleControl).toBeVisible();
  await roleControl.click();
  await page.getByRole('button', { name: 'Make admin', exact: true }).click();
  await expect
    .poll(async () => (await (await request(1, `/leagues/${lid}`)).json()).role)
    .toBe('admin');
  await page.getByRole('button', { name: 'Change role for League Bob', exact: true }).click();
  await page.getByRole('button', { name: 'Make member', exact: true }).click();
  await expect
    .poll(async () => (await (await request(1, `/leagues/${lid}`)).json()).role)
    .toBe('member');
  await page.getByRole('button', { name: 'About score', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dismiss rule tip', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss rule tip', exact: true }).click();

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
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit league', exact: true }).click();
  await page.getByLabel('League name', { exact: true }).fill(`${name} renamed`);
  await page.getByLabel('League description', { exact: true }).fill('Ready for another week.');
  await chooseLeagueImage('android-icon-background.png', true);
  await page.screenshot({
    path: '.codex/artifacts/previews/league-edit.png',
    animations: 'disabled',
  });
  await page.route(`**${configPath}`, async (route) => {
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Please try again');
  expect((await (await request(0, `/leagues/${lid}`)).json()).name).toBe(name);
  expect(Buffer.from(await (await request(0, `/leagues/${lid}/picture`)).arrayBuffer())).toEqual(
    firstBytes,
  );
  await page.unroute(`**${configPath}`);
  const updated = page.waitForResponse((response) => response.url().endsWith(configPath));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await updated).status()).toBe(200);
  await expect(page.getByRole('heading', { name: `${name} renamed`, exact: true })).toBeVisible();
  await expect(page.getByText('Ready for another week.', { exact: true })).toBeVisible();
  expect(
    Buffer.from(await (await request(0, `/leagues/${lid}/picture`)).arrayBuffer()),
  ).not.toEqual(firstBytes);
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
  await expect(page.getByRole('tab', { name: 'League', exact: true })).toBeVisible();
  const aliceCard = page.getByRole('button', { name: `${name} renamed`, exact: true });
  await expect(aliceCard.getByText('#1 this week', { exact: true })).toBeVisible();
  await expect(aliceCard.getByText('2 members', { exact: true })).toBeVisible();
  await expect(
    aliceCard.getByRole('img', { name: `${name} renamed league picture`, exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '.codex/artifacts/previews/league-list.png' });
  await aliceCard.click();
  await expect(page.getByRole('heading', { name: 'Round result', exact: true })).toBeVisible();
  const pendingA = await (await request(0, `/leagues/${lid}/results/pending`)).json();
  expect(pendingA).toHaveLength(1);
  expect(pendingA[0].loser_user_ids).toHaveLength(2);
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  expect(await (await request(0, `/leagues/${lid}/results/pending`)).json()).toEqual([]);
  expect(await (await request(1, `/leagues/${lid}/results/pending`)).json()).toHaveLength(1);
  await expect(page.getByLabel('#1 League Alice: 20 points, you', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select round: Current round', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Current round', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Close select round', exact: true }).click();
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Select round:/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Points breakdown', exact: true }).click();
  await expect(page.getByText(/Workout #/)).toBeVisible();
  await expect(page.getByText(/Body weight/)).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'League Alice profile picture', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '.codex/artifacts/previews/league-points-breakdown.png',
    animations: 'disabled',
  });
  await page.getByRole('tab', { name: 'Rankings', exact: true }).click();

  await expect(page.getByLabel('#1 League Alice: 20 points, you', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '#1 League Alice: 20 points, you', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Score history' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'League', exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Workout #/)).toBeVisible();
  await expect(page.getByText(/Body weight/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to standings' }).click();
  await expect(page.getByRole('tab', { name: 'General', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.reload();
  await signIn(page, 0);
  await page.getByRole('tab', { name: 'League', exact: true }).click();
  const reloadedCard = page.getByRole('button', { name: `${name} renamed`, exact: true });
  await expect(reloadedCard.getByText('#1 this week', { exact: true })).toBeVisible();
  await expect(reloadedCard.getByText('2 members', { exact: true })).toBeVisible();
  await reloadedCard.click();
  await expect(page.getByRole('heading', { name: 'Standings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Select round: Current round', exact: true }).click();
  const catalog = await (await request(0, `/leagues/${lid}/standings/rounds`)).json();
  const past = catalog.rounds.find(
    (round: { id: number }) => round.id !== catalog.current_round_id,
  );
  const emptyContributions = await request(
    0,
    `/leagues/${lid}/standings/contributions?round_id=${past.id}`,
  );
  expect(emptyContributions.status).toBe(200);
  expect(await emptyContributions.json()).toEqual({ items: [], next_offset: null });
  const generalContributions = await request(0, `/leagues/${lid}/standings/contributions`);
  expect(generalContributions.status).toBe(200);
  expect((await generalContributions.json()).items).toHaveLength(1);
  const formatRound = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  const historicalRound = `${formatRound.format(new Date(past.start_at))} – ${formatRound.format(new Date(Date.parse(past.end_at) - 1))}`;
  await page.getByRole('button', { name: historicalRound, exact: true }).click();
  await page.getByRole('tab', { name: 'Points breakdown', exact: true }).click();
  await expect(
    page.getByText('No credited workouts in this period.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await expect(page.getByText(/^Workout #/)).toBeVisible();
  await page.getByRole('tab', { name: 'Round', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Select round: ${historicalRound}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No credited workouts in this period.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: `Select round: ${historicalRound}`, exact: true }).click();
  await page.getByRole('button', { name: 'Current round', exact: true }).click();
  await page.getByRole('tab', { name: 'Rankings', exact: true }).click();

  await expect(
    page.getByRole('img', { name: `${name} renamed league picture`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'League Alice profile picture', exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: '.codex/artifacts/previews/league-standings.png' });
  await page.getByRole('button', { name: `View league information for ${name} renamed` }).click();
  await expect(page.getByRole('tab', { name: 'League', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Edit league', exact: true }).click();
  await page.getByRole('button', { name: 'Remove league picture', exact: true }).click();
  expect((await request(0, `/leagues/${lid}/picture`)).status).toBe(200);
  const removedPicture = page.waitForResponse((response) => response.url().endsWith(configPath));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await removedPicture).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Edit league', exact: true })).toBeVisible();
  expect((await request(0, `/leagues/${lid}/picture`)).status).toBe(404);
  expect((await (await request(0, `/leagues/${lid}`)).json()).picture_url).toBeNull();
  await bob.getByRole('button', { name: 'Back to league', exact: true }).click();
  await bob.getByRole('button', { name: 'Back to leagues' }).click();
  const bobCard = bob.getByRole('button', { name: `${name} renamed`, exact: true });
  await expect(bobCard.getByText('#2 this week', { exact: true })).toBeVisible();
  await expect(bobCard.getByText('2 members', { exact: true })).toBeVisible();
  await bobCard.click();
  await expect(bob.getByRole('heading', { name: 'Round result', exact: true })).toBeVisible();
  await bob.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Round result', exact: true })).toHaveCount(0);
  expect(await (await request(1, `/leagues/${lid}/results/pending`)).json()).toEqual([]);
  await bob.getByRole('button', { name: '#1 League Alice: 20 points', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Score history' })).toBeVisible();
  await expect(bob.getByText(/^Workout #/)).toBeVisible();
  await expect(bob.getByText(/Body weight/)).toHaveCount(0);
  await bob.screenshot({
    path: '.codex/artifacts/previews/league-score-history.png',
    animations: 'disabled',
  });
  await context.close();
});
