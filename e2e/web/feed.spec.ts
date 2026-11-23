import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { minimizeWorkout } from './workout-controls';

test.use({ actionTimeout: 10000 });

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const owner = {
  email: process.env.KINETIX_E2E_EMAIL ?? '',
  password: process.env.KINETIX_E2E_PASSWORD ?? '',
  name: 'Feed owner',
};
const viewer = {
  email: process.env.KINETIX_E2E_EMAIL_B ?? '',
  password: process.env.KINETIX_E2E_PASSWORD_B ?? '',
  name: 'Feed viewer',
};

function request(identity: typeof owner, path: string, method = 'GET', body?: unknown) {
  const credential = Buffer.from(`${identity.email}:${identity.password}`).toString('base64');
  return fetch(`${api}/api/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${credential}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(page: Page, identity: typeof owner) {
  const email = page.getByLabel('Email', { exact: true });
  const profile = page.getByRole('button', { name: 'Open profile' });
  await email.or(profile).first().waitFor({ state: 'visible' });
  if (await email.isVisible()) {
    await email.fill(identity.email);
    await page.getByLabel('Password', { exact: true }).fill(identity.password);
    await page.getByRole('button', { name: /^Sign in/ }).click();
  }
  await expect(profile).toBeVisible();
}

async function setupAccount(identity: typeof owner): Promise<number> {
  const account = await request(identity, '/me');
  expect(account.status).toBe(200);
  expect(
    (
      await request(identity, '/me/profile', 'PATCH', {
        display_name: identity.name,
        age: 30,
        sex: 'female',
        activity_level: 'moderate',
        weight_kg: '75',
        height_cm: '170',
        timezone: 'UTC',
        measurement_system: 'metric',
      })
    ).status,
  ).toBe(200);
  expect(
    (await request(identity, '/me/objective', 'PUT', { objective: 'maintain_weight' })).status,
  ).toBe(200);
  return (await account.json()).id;
}

test('compose, perform and comment through the authenticated feed', async ({ page, browser }) => {
  test.setTimeout(120000);
  if (process.env.APP_ENV !== 'test' || !process.env.DATABASE_URL?.endsWith('_test'))
    throw new Error('Feed acceptance requires a run-owned test database');
  if (
    !owner.email ||
    !viewer.email ||
    !owner.password ||
    !viewer.password ||
    owner.email === viewer.email
  )
    throw new Error('Feed acceptance requires two distinct private test identities');

  const [ownerId, viewerId] = await Promise.all([setupAccount(owner), setupAccount(viewer)]);
  const previousDraft = await request(viewer, '/session-drafts');
  expect(previousDraft.status).toBe(200);
  const previous = (await previousDraft.json()) as { client_session_id: string } | null;
  if (previous)
    expect(
      (await request(viewer, `/session-drafts/${previous.client_session_id}`, 'DELETE')).status,
    ).toBe(204);
  expect((await request(owner, '/friends/requests', 'POST', { user_id: viewerId })).status).toBe(
    200,
  );
  expect((await request(viewer, `/friends/requests/${ownerId}/accept`, 'POST')).status).toBe(200);
  const catalogue = await request(owner, '/exercises?name=Acceptance%20press');
  expect(catalogue.status).toBe(200);
  const { items } = await catalogue.json();
  const exerciseId = items[0].id as number;
  const source = await request(owner, '/sessions', 'POST', {
    client_session_id: randomUUID(),
    started_at: '2026-11-09T16:00:00Z',
    ended_at: '2026-11-09T16:45:00Z',
    exercises: [{ exercise_id: exerciseId, sets: [{ reps: 8, weight_kg: '42.50' }] }],
  });
  expect(source.status).toBe(201);
  const workout = (await source.json()) as { id: number; title: string };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await signIn(page, owner);
  await page.getByRole('button', { name: 'New post' }).click();
  await expect(page.getByRole('tab', { name: 'Feed', exact: true })).toHaveCount(0);
  const caption = page.getByLabel('Caption', { exact: true });
  await caption.fill('Discard this text');
  await page.getByRole('button', { name: 'Back to feed' }).click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(caption).toHaveValue('Discard this text');
  await page.getByRole('button', { name: 'Back to feed' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Feed', exact: true })).toBeVisible();

  const headline = `Shared feed workout ${randomUUID().slice(0, 8)}`;
  const description = `Press sets for ${headline}.`;
  await page.getByRole('button', { name: 'New post' }).click();
  const picker = page.getByRole('button', { name: 'Workout to share: No workout', exact: true });
  await picker.click();
  await page
    .getByTestId('post-workout-menu')
    .getByRole('button', { name: workout.title, exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Preview workout' }).click();
  await expect(page.getByRole('heading', { name: workout.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to new post' }).click();
  await caption.fill(headline);
  await page.getByLabel('Description', { exact: true }).fill(description);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add photos' }).click();
  await (await chooser).setFiles('assets/images/icon.png');
  await expect(page.getByLabel('Selected photo 1')).toBeVisible();
  const posted = page.waitForResponse(
    (response) => response.url().endsWith('/posts') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  expect((await posted).status()).toBe(201);
  const { id: postId, workout: attached } = await (await posted).json();
  expect(attached.session_id).toBe(workout.id);
  const ownerPost = page.getByTestId(`post-${postId}`);
  await ownerPost.getByRole('button', { name: 'Post options' }).click();
  await expect(page.getByRole('button', { name: 'Edit post · Coming soon' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Perform again' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const peer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await peer.goto('/');
    await signIn(peer, viewer);
    const peerPost = peer.getByTestId(`post-${postId}`);
    await peerPost.getByRole('button', { name: 'Post options' }).click();
    await expect(peer.getByRole('button', { name: 'Delete post' })).toHaveCount(0);
    await peer.getByRole('button', { name: 'Perform workout' }).click();
    await expect(peer.getByTestId('workout-modal-surface')).toBeVisible();
    await expect(peer.getByText(/Acceptance press/).first()).toBeVisible();
    const draft = await request(viewer, '/session-drafts');
    expect(draft.status).toBe(200);
    expect(await draft.json()).toMatchObject({
      routine_id: null,
      name: workout.title,
      exercises: [{ exercise_id: exerciseId, sets: [{ completed: false }] }],
    });
    await minimizeWorkout(peer);
    await peer.reload();
    await signIn(peer, viewer);
    await expect(peer.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
    await peerPost.getByRole('button', { name: 'Post options' }).click();
    await peer.getByRole('button', { name: 'Resume active workout' }).click();
    await expect(peer.getByTestId('workout-modal-surface')).toBeVisible();
    await peer.getByRole('button', { name: 'Edit sets for Acceptance press' }).click();
    await expect(peer.getByPlaceholder('42.50')).toHaveValue('');
    await expect(peer.getByPlaceholder('8')).toHaveValue('');
    await minimizeWorkout(peer);
    await peer.getByRole('button', { name: 'Ongoing workout options' }).click();
    await peer.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(peer.getByTestId('ongoing-workout-card')).toHaveCount(0);

    const comments = peerPost.getByRole('button', { name: /Comments on post/ });
    await comments.click();
    const context = peerPost.filter({ visible: true });
    await expect(context.getByRole('heading', { name: headline })).toBeVisible();
    await expect(context.getByText(description)).toBeVisible();
    await expect(context.getByLabel('Photo 1 of 1 by Feed owner')).toBeVisible();
    const send = peer.getByRole('button', { name: 'Send comment' });
    await expect(send).toBeDisabled();
    const comment = `Nice workout ${randomUUID().slice(0, 8)}`;
    await peer.getByLabel('Write a comment').fill(comment);
    await send.click();
    await expect(peer.getByText(comment, { exact: true })).toBeVisible();
    await peer.getByRole('button', { name: 'Back to feed' }).click();
    await comments.click();
    await expect(peer.getByText(comment, { exact: true })).toBeVisible();

    expect((await request(owner, `/friends/${viewerId}`, 'DELETE')).status).toBe(204);
    expect((await request(viewer, `/posts/${postId}/workout-template`)).status).toBe(404);
    expect((await request(viewer, `/posts/${postId}/comments`)).status).toBe(404);
    await peer.getByLabel('Write a comment').fill('This comment must be rejected');
    await send.click();
    await expect(peer.getByText('This post is no longer available.')).toBeVisible();
    await expect(send).toHaveCount(0);
  } finally {
    await peer.close();
  }

  await ownerPost.getByRole('button', { name: 'Post options' }).click();
  await page.getByRole('button', { name: 'Delete post' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(ownerPost).toHaveCount(0);
  expect((await request(owner, `/posts/${postId}/workout-template`)).status).toBe(404);
});
