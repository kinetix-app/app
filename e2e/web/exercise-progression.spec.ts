import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import tokens from '../../src/theme/design-tokens.json';

test.use({ actionTimeout: 10000 });
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
function color(name: string, theme: 'dark' | 'light') {
  const token = tokens.color.tokens.find((value) => value.name === name);
  if (!token) throw new Error(`Missing ${name} token`);
  const hex = typeof token.value === 'string' ? token.value : token.value[theme];
  return `rgb(${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
}

test('confirmed final sets advance exercise cards and the floating panel uses primary colors', async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(email && password, 'Private integration profile is required').toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  const catalogue = await (await request('/exercises?name=Acceptance%20press')).json();
  const exerciseId = catalogue.items[0].id;
  const seed = await request('/sessions', 'POST', {
    client_session_id: randomUUID(),
    started_at: new Date(Date.now() - 60000).toISOString(),
    ended_at: new Date().toISOString(),
    exercises: [
      {
        exercise_id: exerciseId,
        sets: [1, 2].map(() => ({ reps: 8, weight: { value: '80', unit: 'kg' } })),
      },
    ],
  });
  expect(seed.status).toBe(201);
  const name = `Progress ${randomUUID().slice(0, 6)}`;
  expect(
    (
      await request('/routines', 'POST', {
        name,
        exercises: [1, 2].map(() => ({
          exercise_id: exerciseId,
          sets: [{ reps: 8, weight_kg: '80.00' }],
        })),
      })
    ).status,
  ).toBe(201);
  let id: string | undefined;
  try {
    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /^Sign in/ }).click();
    await page.getByLabel('Search routines', { exact: true }).fill(name);
    await page.getByRole('button', { name: `Start ${name}`, exact: true }).click();
    const cards = page.getByRole('button', { name: 'Edit sets for Acceptance press', exact: true });
    await expect(cards).toHaveCount(2);
    await cards.first().click();
    id = (await (await request('/session-drafts')).json()).client_session_id;
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveAttribute(
      'placeholder',
      '80.00',
    );
    await page.getByLabel('Exercise 1 set 2 kg', { exact: true }).fill('85');
    await page.getByRole('button', { name: 'Save exercise 1 set 1', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 1 set 1', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Exercise 1 set 1 kg', { exact: true })).toHaveValue('80.00');
    await expect(page.getByLabel('Exercise 1 set 1 reps', { exact: true })).toHaveValue('8');
    const persisted = await (await request('/session-drafts')).json();
    expect(persisted.exercises[0].sets[0]).toMatchObject({
      completed: true,
      reps: 8,
      weight: { unit: 'kg' },
    });
    expect(Number(persisted.exercises[0].sets[0].weight.value)).toBe(80);
    await expect(cards.first()).toHaveAttribute('aria-expanded', 'true');
    let fail = true;
    await page.route('**/api/v1/session-drafts/*', async (route) => {
      if (fail && route.request().method() === 'PUT') {
        fail = false;
        await route.abort('failed');
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Save exercise 1 set 2', exact: true }).click();
    await expect(
      page.getByText(
        'Could not save the workout. Your changes are retained. Retry the tick or Sync workout.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Exercise 1 set 2 kg', { exact: true })).toHaveValue('85');
    await expect(page.getByLabel('Exercise 1 set 2 reps', { exact: true })).toHaveValue('8');
    await expect(cards.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(cards.last()).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Save exercise 1 set 2', exact: true }).click();
    await expect(cards.last()).toHaveAttribute('aria-expanded', 'true');
    await expect(cards.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Exercise 2 set 1 kg', { exact: true })).toHaveValue('');
    await cards.first().click();
    await page.getByRole('button', { name: 'Unsave exercise 1 set 2', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Save exercise 1 set 2', exact: true }),
    ).toBeVisible();
    await expect(cards.first()).toHaveAttribute('aria-expanded', 'true');
    await cards.last().click();
    for (let i = 1; i <= 2; i++) {
      await page.getByLabel(`Exercise 2 set ${i} kg`, { exact: true }).fill('90');
      await page.getByLabel(`Exercise 2 set ${i} reps`, { exact: true }).fill('6');
      await page.getByRole('button', { name: `Save exercise 2 set ${i}`, exact: true }).click();
      if (i === 1) {
        await expect(
          page.getByRole('button', { name: 'Unsave exercise 2 set 1', exact: true }),
        ).toBeVisible();
      }
    }
    await expect(cards.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(cards.last()).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Save exercise 1 set 2', exact: true }).click();
    await expect(cards.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(cards.last()).toHaveAttribute('aria-expanded', 'false');
    await page.reload();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /^Sign in/ }).click();
    await expect(cards).toHaveCount(2);
    await cards.first().click();
    await expect(
      page.getByRole('button', { name: 'Unsave exercise 1 set 2', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Exercise 1 set 2 kg', { exact: true })).toHaveValue('85');
    await cards.first().click();
    await page.getByRole('button', { name: 'Minimize workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Minimize workout', exact: true })).toHaveCount(
      0,
    );
    for (const theme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.getByTestId('ongoing-workout-card')).toHaveCSS(
        'background-color',
        color('brand', theme),
      );
      await expect(page.getByText('Workout ongoing', { exact: true })).toHaveCSS(
        'color',
        color('on-brand', theme),
      );
      await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toHaveCSS(
        'background-color',
        color('on-brand', theme),
      );
      await page.screenshot({
        path: `.codex/artifacts/previews/primary-session-${theme}.png`,
        animations: 'disabled',
      });
    }
    await page.getByRole('button', { name: 'Ongoing workout options', exact: true }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  } finally {
    if (id) await request(`/session-drafts/${id}`, 'DELETE');
  }
});
