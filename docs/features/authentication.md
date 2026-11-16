# Authentication

## Current state

Authentication is implemented in the app shell. The root route shows the auth screen;
`/nutrition` uses the same authentication flow and opens the Nutrition tab after sign-in.
The screen chooses the development form only when the app is a development build and
`EXPO_PUBLIC_AUTH_MODE` selects Basic. Other configurations load Clerk authentication.

- **Development Basic:** username/password are kept in the in-memory auth service and
  sent to `GET /api/v1/me` to verify the session. The backend must have a local Basic
  allowlist entry. Sign-out clears the Authorization header.
- **Clerk:** email OTP and Google/Apple OAuth are wired through Clerk. Native session
  credentials use SecureStore; the app restores the session, supplies the SDK token
  provider to API requests, checks `/api/v1/me`, and signs out through Clerk.
- **Request handling:** changing or clearing auth invalidates pending token-provider
  results so a late token cannot be attached after logout. API requests use the shared
  `apiClient` and do not persist credentials in public Expo configuration.

## Code and evidence

- `src/features/auth/components/AuthenticationScreen.tsx` selects the adapter UI.
- `src/features/auth/components/DevelopmentSignInScreen.tsx` and
  `ClerkAuthentication.tsx` / `ClerkSignInScreen.tsx` implement the flows.
- `src/services/authService.ts` owns the Authorization header; authentication behavior
  tests are in `src/features/auth/test/` and `src/services/authService.test.ts`.
- [Clerk setup and outstanding owner actions](../clerk-setup.md) records required
  dashboard configuration and release checks.

## Remaining gaps

Production Clerk keys/provider credentials and real provider sign-in have not been
verified here. Native device execution, session restoration on a real device and release
signing/distribution also need separate evidence. The backend does not currently promise
immediate revocation of already issued JWTs after local sign-out; see the
[backend authentication runbook](https://github.com/kinetix-app/app-rest/blob/master/docs/authentication.md).
