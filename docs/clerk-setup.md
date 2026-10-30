# Authentication setup

Tracking: [ENV01 — app#7](https://github.com/kinetix-app/app/issues/7), [DEV02 — app#6](https://github.com/kinetix-app/app/issues/6), [ACC01](https://github.com/kinetix-app/app-rest/issues/1) and [DEV01](https://github.com/kinetix-app/app-rest/issues/7).

## Implemented behavior

| Build/environment  | Frontend                                             | Backend                                                           |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Development        | Basic email/password form by default                 | `APP_ENV=development` defaults to Basic                           |
| Clerk pilot        | Set `EXPO_PUBLIC_AUTH_MODE=clerk`; use `pk_test_...` | Set `AUTH_MODE=clerk`; use the matching development issuer/secret |
| Production release | Clerk; requires `pk_live_...`; rejects Basic         | `APP_ENV=production` defaults to Clerk and rejects Basic          |

`@clerk/expo` provides email-code sign-in and sign-up, Google and Apple OAuth. Google/Apple open the system browser through the SDK's `useSSO()` and return to the app. This implementation does not use the native Google credential picker or native Apple sheet. Email verification supports resend, invalid/expired codes and retry after errors. Provider cancellation returns to sign-in.

Clerk's token cache uses `expo-secure-store` on native platforms. The screen waits for session restoration, then supplies the ordinary `getToken()` to the shared API client, allowing SDK token renewal. `/api/v1/me` must return a valid account before the connected state appears. Account state is mounted per session; logout/account changes cancel outstanding account requests and remove the auth header. No private query cache is introduced. Clerk `signOut()` signs out this device. Previously issued backend JWTs can remain valid until expiration plus clock skew; immediate/all-device revocation is outside this increment.

The email-code screen uses one sign-in-or-sign-up flow: Clerk sends a code without
revealing whether an account exists, then transfers verified new email addresses into
sign-up. After Clerk activates either session, `GET /api/v1/auth/me` resolves the Clerk
identity to an existing local account or provisions one on first access. The initial
account connection runs once per mounted session, or when the user chooses Retry
connection. SDK token-getter changes update the provider used by later API requests
without reloading the account or clearing authentication on each render.

## Development Basic setup

In the backend's ignored `.env`:

```dotenv
APP_ENV=development
AUTH_MODE=basic
BASIC_AUTH_USERS={"your-email@example.test":"choose-your-own-local-password"}
```

Start PostgreSQL, apply migrations and start the backend as described in its README. In this app's ignored `.env` or `.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
EXPO_PUBLIC_AUTH_MODE=basic
```

Use `http://localhost:8000` for an iOS simulator/browser, or a reachable LAN address for a phone. Enter the configured backend credentials in the app. There are no built-in accounts. Wrong credentials keep the user signed out. Basic credentials stay in memory and are cleared on sign-out; an app restart requires signing in again. Restart the API/Metro after environment changes.

## Configure the existing Clerk application

Use the owner's existing application in the [Clerk Dashboard](https://dashboard.clerk.com/); create one only if none exists. Local development keys do not establish that a production instance or providers are ready.

1. Under **User & authentication**, use **Open** access, require email, enable email sign-up/sign-in with **verification codes**, and disable passwords and email verification links. Do not require extra name, username or phone fields for this minimal sign-up form; `signUpIfMissing` is unavailable for invite-only or waitlist access.
2. Enable **Google** and **Apple** social connections. For production, enter the providers' production OAuth credentials in Clerk. Google needs a web OAuth client for this browser flow. Apple needs its web Services ID, Team ID, Key ID and signing key plus the domain/return URL setup Clerk specifies. Use the exact provider callback URL shown by Clerk; it differs from the app callback. Provider secrets remain in Clerk.
3. Enable Clerk's **Native API** and register Android package/namespace and iOS bundle identifier **`cat.udl.kinetix`**. Supply the actual signing certificate fingerprints and Apple Team ID/App ID prefix requested by the dashboard.
4. Register **`kinetix://sso-callback`** as an allowed native/mobile redirect URL. `app.json` sets scheme `kinetix`; `src/app/sso-callback.tsx` returns to the authentication screen on native platforms. The optional browser preview uses its actual origin plus `/sso-callback`, which must also be allowed when used.
5. Match frontend and backend keys to the **same instance**. For a local Clerk pilot:

   ```dotenv
   # Frontend public settings
   EXPO_PUBLIC_AUTH_MODE=clerk
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
   ```

   ```dotenv
   # Backend private settings
   APP_ENV=development
   AUTH_MODE=clerk
   CLERK_ISSUER=https://your-instance.clerk.accounts.dev
   CLERK_SECRET_KEY=sk_test_...
   CLERK_AUTHORIZED_PARTIES=[]
   ```

   Use Clerk's exact Frontend API origin for `CLERK_ISSUER`. Native tokens may omit `azp`; if present, the backend requires its exact value in `CLERK_AUTHORIZED_PARTIES`. Add browser origins for web testing. Use standard session tokens without a custom JWT template. Basic credentials are never accepted in Clerk mode.

6. Rebuild native apps with `pnpm android` / `pnpm ios` after installing the SDK and its SecureStore/browser config plugins. A JavaScript reload cannot add native modules.

## Expo web SSO callback

For `pnpm web`, set `EXPO_PUBLIC_AUTH_MODE=clerk` and the matching Clerk publishable
key. Allow the exact browser origin plus `/sso-callback` in Clerk. Keep the protocol,
host and port consistent throughout the flow: `localhost` and `127.0.0.1` are different
origins. Expo web authentication needs a secure browser context (HTTPS or localhost).

Google/Apple open an authorization popup. The callback completes
`WebBrowser.maybeCompleteAuthSession()` while its original path and query parameters
are intact. Expo returns the result to the opening tab, closes the popup, and the
opening tab activates the Clerk session. Do not redirect the web callback to `/`
before completion or disable Expo's redirect validation. Native continues to use
`kinetix://sso-callback` and the SDK's browser/deep-link flow.

A direct callback visit, closed opener or failed handoff shows a recovery message
and a link to sign-in without displaying provider diagnostics or callback parameters.
For a failed popup, close it and retry in the original tab.

The callback browser regression uses synthetic Expo session state and no provider
credentials; it checks the actual callback message and popup closure, not Google/Apple
account authentication. With a Clerk-enabled web server running, execute:

```sh
KINETIX_FRONTEND_URL=http://localhost:8081 pnpm exec playwright test --config e2e/web/playwright.config.ts sso-callback.spec.ts
```

Separately verify real Google/Apple success, cancellation/retry, account API access
and session restoration after reload. Android acceptance requires an installed
development build on an emulator/device; browser tests do not establish native success.

## Production configuration

Complete the production instance's domain/DNS setup and Google/Apple credentials in Clerk before building the release. Set these values in the release build environment and backend deployment; placeholders below must be replaced:

```dotenv
# Frontend release environment: public values only
EXPO_PUBLIC_AUTH_MODE=clerk
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_API_URL=https://your-api-domain
```

```dotenv
# Backend deployment: keep the secret in its environment/secret manager
APP_ENV=production
AUTH_MODE=clerk
CLERK_ISSUER=https://your-production-clerk-frontend-api
CLERK_SECRET_KEY=sk_live_...
CLERK_AUTHORIZED_PARTIES=[]
BASIC_AUTH_USERS={}
```

The production backend requires the issuer/secret at startup. Database settings and explicit migrations are still required. Use HTTPS for deployed traffic. Register release signing information and verify the provider return URLs against this production instance. Never put the backend secret or Basic passwords in `EXPO_PUBLIC_` variables.

## Verification before shipping

Automated tests verify SDK calls and error handling with mocks, authenticated header renewal/cleanup, Basic sign-in acceptance/failure, and cancellation of stale account requests. Backend tests separately verify real PostgreSQL persistence and account isolation. These do not demonstrate real provider sign-in.

On the agreed Android/iOS devices and with production settings, verify:

- Email sign-up/sign-in, wrong/expired codes, resend failure and recovery.
- Google/Apple success, cancellation and provider failure.
- `/me` provisions once and retains the same UUID after renewal and restart.
- Secure session restoration after app restart and current-device logout.
- Two accounts show separate profiles; no old account response appears after switching.
- Release builds reject Basic and development Clerk keys.

Record results on ENV01 and link ACC01. Profile editing UI, account deletion/linking synchronization, and any change to the offline JWT revocation contract remain separate ACC01 work.

## References

- [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart)
- [Email OTP flow](https://clerk.com/docs/guides/development/custom-flows/authentication/email-sms-otp)
- [SDK OAuth flow](https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections)
- [Backend authentication setup](https://github.com/kinetix-app/app-rest/blob/master/docs/authentication.md)
