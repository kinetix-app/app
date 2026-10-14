# Clerk setup — frontend issue #7

Tracking: [ENV01 — app#7](https://github.com/kinetix-app/app/issues/7). Related backend: [ACC01](https://github.com/kinetix-app/app-rest/issues/1), delivered in [backend PR #6](https://github.com/kinetix-app/app-rest/pull/6).

## Native identifiers

| Configuration               | Value             |
| --------------------------- | ----------------- |
| Android package / namespace | `cat.udl.kinetix` |
| iOS bundle identifier       | `cat.udl.kinetix` |
| App display name            | `Kinetix`         |
| Expo URL scheme             | `kinetix`         |

These identifiers are set in `app.json`. Register Android and iOS as separate native applications in Clerk. The Apple Team ID/App ID prefix and Android certificate fingerprints come from the actual signing configuration; the package identifier alone is insufficient. Rebuild native apps after configuration/plugin changes.

## CLI setup first

Use the repository's pinned toolchain. Inspect source auth dependencies, routes and session handling before initialization; do not read existing environment files. There is currently no frontend authentication provider to migrate.

```sh
npx -y clerk@latest init
```

Let the CLI detect Expo and pnpm. In supported agent environments, it can provision a claimable development application and write temporary keys. Relay the environment filename and claim instruction it prints without exposing keys. Some Expo setup may still require the manual quickstart. Do not claim an application or select an existing application on the owner's behalf. To link a particular existing app, Eloi supplies its application ID; otherwise the CLI's default accountless flow applies when supported.

After SDK wiring and visible native sign-in/sign-up/user controls are present:

```sh
npx -y clerk@latest doctor
pnpm start
```

Eloi should make the first real test account. Claiming temporary applications with `npx -y clerk@latest auth login`, choosing sign-in methods and running `npx -y clerk@latest deploy` for production are subsequent owner actions. Temporary development keys are not production credentials. Email OTP, Google and Apple are the agreed methods; organizations are outside this increment.

The initialization attempt in this session failed while downloading the CLI: `getaddrinfo ENOTFOUND registry.npmjs.org`. It did not provision a Clerk application or generate keys. No existing environment files were inspected. Retry once registry access and the pinned Node toolchain are available.

## Actions for Eloi

1. **Clerk access and environments.** Create/select the Kinetix Clerk application and give implementers dashboard access. The pilot uses its development instance. Issue #7 also owns a separate production instance, its required domain/DNS setup, production provider credentials and release settings. Do not switch a pilot backend to a production issuer without switching its keys and the app's publishable key together.
2. **Enable the Native API** under Clerk's Native applications settings. Register `cat.udl.kinetix` for both platforms. For Android, provide the actual SHA-256 signing-certificate fingerprint; for iOS, provide the App ID prefix/Team ID and bundle identifier. Register the certificates used by both local development and release builds when applicable.
3. **Enable Email OTP.** Enable email sign-in/sign-up with verification codes. Disable passwords and verification links for the intended passwordless flow. Keep required profile fields compatible with minimal sign-up; the backend's local display name/timezone can initially be null.
4. **Google credentials.** Create Google Cloud OAuth clients for Web, Android (`cat.udl.kinetix` plus its signing certificate's SHA-1) and iOS (`cat.udl.kinetix`). Enable Google in Clerk with custom credentials. Put the Web client ID and client secret in Clerk; use Clerk's exact redirect URI. Provide the public Web/iOS/Android client IDs and iOS reversed-client URL scheme for app configuration. The Google secret belongs in Clerk, never `EXPO_PUBLIC_` configuration. Add the required consent-screen test users during development.
5. **Apple credentials.** Register an Apple App ID for `cat.udl.kinetix`, enable Sign in with Apple and configure the Apple connection in Clerk. Supply the Team ID/App ID prefix. Browser/Android Apple flows require additional Apple web configuration; the initial native Apple target is iOS. Validate on a signed physical iOS device.
6. **Local environment.** Use the temporary keys written by `clerk init` when supported, or set the existing application’s public key. Set a reachable backend origin in the ignored environment file (for manual setup, `.env.local`). Development uses `pk_test_...`; production uses `pk_live_...`. No secret keys are needed in this repository.

   ```dotenv
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
   ```

   The API URL is the origin without `/api/v1`. `10.0.2.2` reaches the host from the Android emulator. Use a device-reachable host address for physical devices and HTTPS for production.

7. **Matching backend.** In the backend's ignored environment, configure the same instance's `CLERK_ISSUER` and `CLERK_SECRET_KEY`, apply migrations and start the API. Set actual authorized-party values if tokens contain `azp`; the native token contract allows it to be absent. Use ordinary Clerk session tokens (`getToken()`), without a custom JWT template.
8. **Production.** Complete Clerk's production domain/DNS requirements, register release signing certificates, configure production provider credentials and use production keys in both app and backend. Confirm session lifetime/logout expectations. Release builds must contain no demo identities or development Basic Auth credentials. Never send secret keys in issue comments or commit them.

Dashboard access and provider account credentials should be shared through the team's secure channel. Public publishable keys, native identifiers, Team ID and certificate fingerprints are sufficient for app-side configuration; do not send Apple private keys or Google client secrets to the app developer.

## Implementation started

Branch: `feature/env01-clerk-authentication`.

- `app.json` defines the native identifiers.
- `src/config/environment.ts` reads optional public Clerk configuration and rejects secret-key input without echoing the input in errors.
- `src/services/apiClient.ts` accepts a session's token getter, requests a fresh token for each operation, cancels requests on disposal/caller abort/timeout, and returns safe status-based errors. It stores no bearer tokens and does not retry profile writes.
- `src/features/accounts/api.ts` validates the backend account response and defines `GET /api/v1/me` and `PATCH /api/v1/me/profile`. PATCH preserves omitted versus explicit null fields.

These modules are groundwork. They are not yet connected to the starter screen or a Clerk session. Sign-in is not implemented yet. No private server-state cache is introduced in this increment.

## Next implementation steps

With the pinned Node 24.21.0/pnpm 11.23.0 toolchain and registry access:

1. Retry `npx -y clerk@latest init`; inspect what it installed/configured. Complete missing compatible SDK/native dependencies using `pnpm exec expo install ... --pnpm`, review peer dependencies and commit `package.json` with the generated lockfile. Clerk's current 4.x documentation uses `@clerk/expo`; do not copy obsolete `@clerk/clerk-expo` imports. Verify Expo 57 compatibility against the installed package rather than stale Core 3 examples.
2. Add `ClerkProvider` and the SDK token cache backed by `expo-secure-store`, then implement Email OTP and native Google/Apple sign-in with their config plugins. Missing configuration should show a setup state; never fall back to a demo identity. Handle pending sessions, provider cancellation, invalid/expired codes and resend failures.
3. Once Clerk restoration finishes, create an API client for that session using the ordinary SDK `getToken()`. Dispose it when the session changes. Keep identity/session values in TanStack Query keys, cancel and clear private queries on account changes, and wire native focus/connectivity.
4. Add account/profile screens with loading/error states, retained form values after failed saves and current-device logout. Client guards do not replace backend token verification.
5. Run the frontend CI commands and native builds, then demonstrate real provider sign-in, session restoration, logout and two-account isolation. Record production and pilot results separately on issue #7 and link related ACC01 evidence.

No Clerk SDK packages were installed in this session: registry access is unavailable, and the available Node runtime does not satisfy the pinned version. The existing manifest/lockfile remains consistent. GitHub CI on the pinned toolchain passed dependency installation, TypeScript, lint, formatting and all 36 Jest tests. Expo Doctor failed on eight existing Expo patch-version mismatches; bundling did not run and SonarCloud was skipped. See [the CI run](https://github.com/kinetix-app/app/actions/runs/38609997118). Align dependencies using Expo tooling when registry access is available. Native/provider validation remains pending.

## References

- [Clerk CLI](https://clerk.com/docs/cli)
- [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart)
- [Native Google sign-in](https://clerk.com/docs/expo/guides/configure/auth-strategies/sign-in-with-google)
- [Native Apple sign-in](https://clerk.com/docs/expo/guides/configure/auth-strategies/sign-in-with-apple)
- [Expo's Clerk integration guide](https://docs.expo.dev/guides/using-clerk/)
- [Backend authentication setup](https://github.com/kinetix-app/app-rest/blob/master/docs/authentication.md)
