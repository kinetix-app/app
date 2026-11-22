import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const identities = [
  {
    email: process.env.KINETIX_E2E_EMAIL ?? '',
    password: process.env.KINETIX_E2E_PASSWORD ?? '',
    name: 'Workout Alice',
  },
  {
    email: process.env.KINETIX_E2E_EMAIL_B ?? '',
    password: process.env.KINETIX_E2E_PASSWORD_B ?? '',
    name: 'Workout Bob',
  },
];
const [owner, peer] = identities;

function request(path: string, identity = owner, method = 'GET', body?: unknown) {
  const multipart = body instanceof FormData;
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${identity.email}:${identity.password}`).toString('base64')}`,
      ...(multipart ? {} : { 'Content-Type': 'application/json' }),
    },
    body: multipart ? body : body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(page: Page, identity = owner) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(identity.email);
  await page.getByLabel('Password', { exact: true }).fill(identity.password);
  const authenticated = page.waitForResponse((response) => response.url().endsWith('/auth/me'));
  await page.getByRole('button', { name: /^Sign in/ }).click();
  expect((await authenticated).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Open profile' })).toBeVisible();
}

async function expectWorkoutAuthor(page: Page) {
  const author = page.getByTestId('workout-detail-author');
  await expect(author.getByText(owner.name, { exact: true })).toBeVisible();
  await expect(author).toContainText(/·\s+\d{1,2}:\d{2}/);
  const picture = author.locator('img');
  await expect(picture).toHaveCount(1);
  await expect
    .poll(() => picture.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
}

test('reopens the same completed workout from private screens and an authorized post', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Requires a run-owned test database');
  if (identities.some(({ email, password }) => !email || !password) || owner.email === peer.email)
    throw new Error('Requires two distinct private test identities');

  const userIds = [];
  for (const identity of identities) {
    const account = await request('/me', identity);
    expect(account.status).toBe(200);
    userIds.push((await account.json()).id as number);
    expect(
      (
        await request('/me/profile', identity, 'PATCH', {
          display_name: identity.name,
          age: 30,
          weight_kg: '75',
          height_cm: '170',
          timezone: 'UTC',
          measurement_system: 'metric',
        })
      ).status,
    ).toBe(200);
    expect(
      (await request('/me/objective', identity, 'PUT', { objective: 'maintain_weight' })).status,
    ).toBe(200);
  }
  const [ownerId, peerId] = userIds;
  const picture = new FormData();
  const png = new Uint8Array(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZl0AAAAASUVORK5CYII=',
      'base64',
    ),
  );
  picture.append('file', new Blob([png], { type: 'image/png' }), 'workout-author.png');
  expect((await request('/me/profile/picture', owner, 'POST', picture)).status).toBe(200);
  expect((await request('/friends/requests', owner, 'POST', { user_id: peerId })).status).toBe(200);
  expect((await request(`/friends/requests/${ownerId}/accept`, peer, 'POST')).status).toBe(200);

  const leagueName = `Workout review ${randomUUID().slice(0, 8)}`;
  const league = await request('/leagues', owner, 'POST', { name: leagueName, timezone: 'UTC' });
  expect(league.status).toBe(201);
  const { id: leagueId } = await league.json();
  const invitation = await request(`/leagues/${leagueId}/invitations`, owner, 'POST');
  expect(invitation.status).toBe(201);
  const { token } = await invitation.json();
  expect((await request(`/league-invitations/${token}/accept`, peer, 'POST')).status).toBe(200);

  const catalogue = await request('/exercises?name=Acceptance%20press');
  expect(catalogue.status).toBe(200);
  const { items } = await catalogue.json();
  const routineName = `Detail press ${randomUUID().slice(0, 8)}`;
  const renamedRoutine = `${routineName} renamed`;
  const routine = await request('/routines', owner, 'POST', {
    name: routineName,
    exercises: [{ exercise_id: items[0].id, sets: [{ reps: 8, weight_kg: '42.50' }] }],
  });
  expect(routine.status).toBe(201);
  const { id: routineId } = await routine.json();
  const blank = await request('/sessions', owner, 'POST', {
    client_session_id: randomUUID(),
    started_at: new Date(Date.now() - 90000).toISOString(),
    ended_at: new Date(Date.now() - 60000).toISOString(),
    exercises: [],
  });
  expect(blank.status).toBe(201);
  const { id: blankId } = await blank.json();

  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  async function startRoutine(name: string) {
    await page.getByRole('button', { name: `Routine actions for ${name}` }).click();
    await page.getByRole('button', { name: `Train ${name}` }).click();
  }
  await startRoutine(routineName);
  const slot = page.getByRole('button', { name: 'Edit sets for Acceptance press' });
  await expect(slot).toBeVisible();
  if ((await slot.getAttribute('aria-expanded')) !== 'true') await slot.click();
  await page.getByLabel('Exercise 1 set 1 kg', { exact: true }).fill('42.5');
  await page.getByLabel('Exercise 1 set 1 reps', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
  const finish = page.waitForResponse((response) => response.url().endsWith('/finish'));
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Keep routine', exact: true }).click();
  expect((await finish).status()).toBe(200);
  const { id: sessionId, title } = await (await finish).json();
  expect(title).toBe(routineName);
  expect(
    (await request(`/routines/${routineId}`, owner, 'PATCH', { name: renamedRoutine })).status,
  ).toBe(200);
  const viewSaved = page.getByRole('button', { name: 'View workout', exact: true });
  const viewSession = page.getByRole('button', { name: `View workout ${sessionId}`, exact: true });
  const historyWorkout = page.getByTestId(`history-workout-${sessionId}`);
  const privateSet = page
    .getByRole('table', { name: 'Strength sets' })
    .getByRole('cell', { name: '42.50', exact: true });
  const shareWorkout = page.getByRole('button', { name: 'Share to feed', exact: true });
  const workoutDetail = page.getByRole('heading', { name: 'Workout detail', exact: true });
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible();
  await expect(shareWorkout).toHaveCount(0);
  await viewSaved.click();
  await expect(privateSet).toBeVisible();
  await expect(page.getByRole('heading', { name: routineName, exact: true })).toBeVisible();
  await expect(workoutDetail).toBeVisible();
  await expect(page.getByText('Duration', { exact: true })).toBeVisible();
  await expect(shareWorkout).toBeVisible();
  await page.getByRole('button', { name: 'Back to workout saved' }).click();
  await expect(shareWorkout).toHaveCount(0);
  await viewSaved.click();
  await shareWorkout.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('');
  await page.getByLabel('Caption', { exact: true }).fill('An acceptance workout');
  await page.getByLabel('Description', { exact: true }).fill('Three screens share this result.');
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(workoutDetail).toBeVisible();
  await expect(privateSet).toBeVisible();
  await expect(shareWorkout).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to new post' }).click();
  await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('An acceptance workout');
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
    'Three screens share this result.',
  );
  const posted = page.waitForResponse(
    (response) => response.url().endsWith('/posts') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  expect((await posted).status()).toBe(201);
  expect(await (await posted).json()).toMatchObject({
    caption: 'An acceptance workout',
    description: 'Three screens share this result.',
    workout: { title: routineName },
  });

  await page.reload();
  await signIn(page);
  await page.getByRole('button', { name: 'Open profile' }).click();
  await page.getByRole('button', { name: 'Training history' }).click();
  await expect(page.getByRole('heading', { name: 'Workout history', exact: true })).toBeVisible();
  await expect(workoutDetail).toHaveCount(0);
  await expect(historyWorkout.getByText(routineName, { exact: true })).toBeVisible();
  const blankWorkout = page.getByTestId(`history-workout-${blankId}`);
  await expect(blankWorkout.getByText('Training session', { exact: true })).toBeVisible();
  await expect(historyWorkout.getByText('340 kg', { exact: true })).toBeVisible();
  await expect(historyWorkout.getByText('Acceptance press', { exact: true })).toHaveCount(0);
  await expect(historyWorkout.getByText('Exercises', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Share.*to feed/i })).toHaveCount(0);
  const privateRoute = `**/api/v1/sessions/${sessionId}?weight_unit=kg`;
  await page.route(privateRoute, (route) => route.abort());
  await historyWorkout.click();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await page.unroute(privateRoute);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(privateSet).toBeVisible();
  await expect(workoutDetail).toBeVisible();
  await expect(page.getByTestId('workout-detail-primary-metrics')).toContainText(
    /Duration.*Volume.*340 kg.*Exercises/s,
  );
  await expect(page.getByTestId('workout-detail-secondary-metrics')).toContainText(
    /Sets.*Reps.*8/s,
  );
  await expect(page.getByLabel('Image of Acceptance press')).toBeVisible();
  await expectWorkoutAuthor(page);
  await expect(shareWorkout).toBeVisible();
  await page.getByRole('button', { name: 'Back to history' }).click();
  await expect(historyWorkout).toBeVisible();

  await page.getByRole('tab', { name: 'League', exact: true }).click();
  await page.getByRole('button', { name: leagueName, exact: true }).click();
  await page.getByRole('button', { name: /Workout Alice: .* points, you/ }).click();
  await viewSession.click();
  await expect(privateSet).toBeVisible();
  await page.getByRole('button', { name: 'Back to score history' }).click();
  await expect(viewSession).toBeVisible();
  await page.getByRole('button', { name: 'Back to standings' }).click();
  await page.getByRole('button', { name: 'Back to leagues' }).click();
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await startRoutine(renamedRoutine);
  await page.getByRole('button', { name: 'Details for Acceptance press', exact: true }).click();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await viewSession.click();
  await expect(privateSet).toBeVisible();
  await page.getByRole('button', { name: 'Back to exercise history' }).click();
  await expect(viewSession).toBeVisible();

  const peerPage = await browser.newPage();
  try {
    await peerPage.setViewportSize({ width: 320, height: 740 });
    await signIn(peerPage, peer);
    const postWorkout = peerPage.getByRole('button', { name: 'See Workout Alice’s workout' });
    await expect(peerPage.getByText('An acceptance workout', { exact: true })).toBeVisible();
    await expect(
      peerPage.getByText('Three screens share this result.', { exact: true }),
    ).toBeVisible();
    await expect(postWorkout.getByText(routineName, { exact: true })).toBeVisible();
    await expect(postWorkout.getByText('340 kg', { exact: true })).toBeVisible();
    await expect(postWorkout.getByText('Acceptance press', { exact: true })).toHaveCount(0);
    await postWorkout.click();
    await expect(
      peerPage.getByRole('heading', { name: 'Workout detail', exact: true }),
    ).toBeVisible();
    await expect(peerPage.getByRole('heading', { name: routineName, exact: true })).toBeVisible();
    const strength = peerPage.getByRole('table', { name: 'Strength sets' });
    await expect(strength.getByRole('columnheader', { name: 'Weight (kg)' })).toBeVisible();
    const set = strength.getByRole('row').nth(1);
    await expect(set.getByRole('cell')).toHaveText(['1', '42.50', '8']);
    await expect(peerPage.getByTestId('workout-detail-primary-metrics')).toContainText(
      /Duration.*Volume.*340 kg.*Exercises/s,
    );
    await expect(peerPage.getByTestId('workout-detail-secondary-metrics')).toContainText(
      /Sets.*Reps.*8/s,
    );
    await expectWorkoutAuthor(peerPage);
    const image = peerPage.getByLabel('Image of Acceptance press');
    await expect(image).toBeVisible();
    const imageBox = await image.boundingBox();
    const setBox = await strength.boundingBox();
    expect(imageBox!.x + imageBox!.width).toBeLessThan(setBox!.x);
    await expect(peerPage.getByRole('button', { name: /Share.*to feed/i })).toHaveCount(0);
    await peerPage.getByRole('button', { name: 'Back to feed' }).click();
    await peerPage.getByRole('tab', { name: 'League', exact: true }).click();
    await peerPage.getByRole('button', { name: leagueName, exact: true }).click();
    await peerPage.getByRole('button', { name: /Workout Alice: .* points/ }).click();
    await expect(peerPage.getByText(`Workout #${sessionId}`, { exact: true })).toBeVisible();
    await expect(peerPage.getByRole('button', { name: `View workout ${sessionId}` })).toHaveCount(
      0,
    );
    expect((await request(`/sessions/${sessionId}`, peer)).status).toBe(404);
  } finally {
    await peerPage.close();
  }
});
