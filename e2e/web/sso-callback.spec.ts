import { expect, test } from '@playwright/test';

// Exercises the real callback and Expo's message/URL validation, with synthetic
// session state. This does not establish Google/Apple provider acceptance.
test('returns the intact callback to the original tab before closing the popup', async ({
  page,
}) => {
  await page.goto('/sso-callback');
  const callback = new URL('/sso-callback?rotating_token_nonce=synthetic-test-nonce', page.url())
    .href;
  await page.evaluate((url) => {
    const handle = 'synthetic-sso-test';
    localStorage.setItem('ExpoWebBrowserRedirectHandle', handle);
    const redirect = new URL(url);
    localStorage.setItem(
      `ExpoWebBrowser_RedirectUrl_${handle}`,
      `${redirect.host}${redirect.pathname}`.toLowerCase(),
    );
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin || event.data?.expoSender !== handle) return;
      document.title =
        new URL(event.data.url).searchParams.get('rotating_token_nonce') ?? 'missing';
      (event.source as Window | null)?.close();
    });
  }, callback);
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate((url) => window.open(url, '_blank'), callback);
  const popup = await popupPromise;
  await expect(page).toHaveTitle('synthetic-test-nonce');
  await expect.poll(() => popup.isClosed()).toBe(true);
});

test('direct callback visits offer a safe sign-in link', async ({ page }) => {
  await page.goto('/sso-callback?rotating_token_nonce=synthetic-test-nonce');
  await expect(page.getByRole('alert')).toContainText('Close this window');
  await expect(page).toHaveURL(/\/sso-callback\?/);
  await expect(page.getByRole('link', { name: 'Return to sign-in' })).toHaveAttribute('href', '/');
});

test('rejects a mismatched redirect without navigating or revealing SDK diagnostics', async ({
  page,
}) => {
  await page.goto('/sso-callback');
  await page.evaluate(() => {
    localStorage.setItem('ExpoWebBrowserRedirectHandle', 'synthetic-mismatch');
    localStorage.setItem(
      'ExpoWebBrowser_RedirectUrl_synthetic-mismatch',
      'different.invalid/callback',
    );
  });
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate(() =>
    window.open('/sso-callback?rotating_token_nonce=synthetic-test-nonce', '_blank'),
  );
  const popup = await popupPromise;
  await expect(popup.getByRole('alert')).toContainText('Close this window');
  await expect(popup).toHaveURL(/\/sso-callback\?/);
  await expect(popup.locator('body')).not.toContainText('different.invalid');
  await expect(popup.getByRole('link', { name: 'Return to sign-in' })).toBeVisible();
});
