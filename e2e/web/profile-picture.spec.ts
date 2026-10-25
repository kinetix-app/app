import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const api = process.env.KINETIX_API_URL ?? 'http://127.0.0.1:18016';
const path = '/api/v1/me/profile/picture';
const email = process.env.KINETIX_E2E_EMAIL;
const password = process.env.KINETIX_E2E_PASSWORD;
function auth(second = false) {
  const user = second ? process.env.KINETIX_E2E_EMAIL_B : email;
  const pass = second ? process.env.KINETIX_E2E_PASSWORD_B : password;
  if (!user || !pass) throw new Error('Isolated acceptance credentials required');
  return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
}
async function choose(page: Page, filename: string, replace = false) {
  const selection = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: replace ? 'Replace picture' : 'Choose picture', exact: true })
    .click();
  await (await selection).setFiles(resolve('assets/images', filename));
  await expect(page.getByRole('button', { name: 'Upload picture', exact: true })).toBeVisible();
}
async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
}

test('private Azure picture upload, failure retry, replace, reopen and removal work through setup', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await choose(page, 'icon.png');
  const upload = page.waitForResponse(
    (response) => response.url().endsWith(path) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Upload picture', exact: true }).click();
  const uploaded = await upload;
  expect(uploaded.status()).toBe(200);
  expect(uploaded.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
  expect((await uploaded.json()).profile.picture_url).toBe(path);
  const first = await fetch(`${api}${path}`, { headers: auth() });
  expect(first.status).toBe(200);
  expect(first.headers.get('content-type')).toContain('image/jpeg');
  expect(first.headers.get('cache-control')).toContain('no-store');
  const firstBytes = Buffer.from(await first.arrayBuffer());
  expect((await fetch(`${api}${path}`)).status).toBe(401);
  expect((await fetch(`${api}${path}`, { headers: auth(true) })).status).toBe(404);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: '.codex/artifacts/previews/profile-wizard-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: '.codex/artifacts/previews/profile-wizard-dark.png' });
  await choose(page, 'android-icon-background.png', true);
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Upload picture', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/upload/i);
  const retained = await fetch(`${api}${path}`, { headers: auth() });
  expect(Buffer.from(await retained.arrayBuffer())).toEqual(firstBytes);
  await page.unroute(`**${path}`);
  const replacement = page.waitForResponse(
    (response) => response.url().endsWith(path) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Upload picture', exact: true }).click();
  expect((await replacement).status()).toBe(200);
  const replaced = await fetch(`${api}${path}`, { headers: auth() });
  expect(Buffer.from(await replaced.arrayBuffer())).not.toEqual(firstBytes);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Acceptance Alice', { exact: true })).toBeVisible();
  await page.reload();
  await signIn(page);
  await expect(page.getByRole('img', { name: 'Profile picture', exact: true })).toBeVisible();
  const remove = page.waitForResponse(
    (response) => response.url().endsWith(path) && response.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Remove picture', exact: true }).click();
  expect((await remove).status()).toBe(200);
  expect((await fetch(`${api}${path}`, { headers: auth() })).status).toBe(404);
  const account = await (await fetch(`${api}/api/v1/auth/me`, { headers: auth() })).json();
  expect(account.profile.picture_url).toBeNull();
  expect(account.profile.display_name).toBe('Acceptance Alice');
  expect(account.onboarding.required).toBe(false);
});
