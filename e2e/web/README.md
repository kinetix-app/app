# Real workout acceptance

Run against a dedicated backend database whose name ends in `_test`, with `APP_ENV=test` and development Basic authentication. Use two distinct synthetic account credentials from private environment variables. Never point this suite at personal/demo data: it creates completed workouts, which have no public deletion endpoint.

Required variables:

- `KINETIX_FRONTEND_URL` and `KINETIX_API_URL` (defaults `http://127.0.0.1:18017` and `http://127.0.0.1:18016`).
- `KINETIX_E2E_EMAIL`, `KINETIX_E2E_PASSWORD`, `KINETIX_E2E_EMAIL_B`, `KINETIX_E2E_PASSWORD_B`.

Configure the API with both credentials in backend-only `BASIC_AUTH_USERS`, `AUTH_MODE=basic`, and `CORS_ALLOWED_ORIGINS` containing the frontend origin. Configure Expo with `EXPO_PUBLIC_AUTH_MODE=basic` and `EXPO_PUBLIC_API_URL` pointing at this API. Credentials must never use `EXPO_PUBLIC_` names.

From the backend checkout, migrate and seed the synthetic catalogue (replace the frontend path with its checkout location):

```sh
uv run --locked --no-build alembic upgrade head
PYTHONPATH=. uv run --locked --no-build python ../app/e2e/web/seed_catalogue.py
uv run --locked --no-build uvicorn app.main:create_app --factory --host 127.0.0.1 --port 18016
```

From the frontend checkout, start its development browser build:

```sh
pnpm exec expo start --web --port 18017
```

With both servers ready, run:

```sh
pnpm exec playwright install chromium
pnpm exec playwright test --config e2e/web/playwright.config.ts
```

The suite uses one worker and disables traces, screenshots and video to avoid recording sign-in credentials or private workout payloads. Runtime artifacts belong under ignored `.codex/artifacts/e2e`. Tests fail if either identity is missing or both identities are the same. The backend fixture refuses a non-test environment/database, inserts one synthetic catalogue record and does not delete data.

Browser verification establishes browser/API behavior only. Android/iOS acceptance requires an installed development build, a connected device/emulator and Maestro. Bundle exports and browser checks do not establish native behavior or Clerk readiness.

## Onboarding acceptance

`onboarding.spec.ts` requires two distinct synthetic identities in a fresh run-owned
`_test` database. It verifies invalid sign-in, incomplete returning users, explicit
unit selection, profile failure/retry, all four objectives, food logging without a
target, optional target skip/edit/reopen, retained objective context, reload, sign-out
and account isolation. Run it before `home.spec.ts`; the latter reuses the completed
primary profile and the synthetic catalogue described above. This is Basic/browser
acceptance, not real Clerk registration or native acceptance.

## Home navigation regression

`home.spec.ts` covers Home profile/objective navigation and optional nutrition-goal editing, failed save/retry, the shared
bottom bar, existing food-entry navigation, unsaved routine edits across tabs, workout
recording, reload/resume, completed history and theme switching. It needs the primary
private test identity and the same isolated API/catalogue setup. Run it alone with
`pnpm exec playwright test --config e2e/web/playwright.config.ts home.spec.ts`.
The complete workout suite still requires both distinct identities.

## Profile picture acceptance

After onboarding completes for the primary isolated identity, run
`profile-picture.spec.ts` against the same API with configured Azurite storage and a
separate test-owned private profile container. It exercises the actual image picker,
multipart upload, authenticated image retrieval, failed-upload retry, replacement,
direct profile save/reload and removal. Existing-profile edits use one compact form; onboarding retains its guided steps. A second identity and an anonymous request must not
read the primary account's image. Only repository-owned app icons are used as sample
uploads; no personal photo is required. Private storage ACL, content validation and
failure/rollback cases also have backend integration coverage.

## Percentage nutrition-goal acceptance

`nutrition-goals.spec.ts` requires two distinct private synthetic identities and a fresh
run-owned database with `APP_ENV=test` and `DATABASE_URL` ending in `_test`. It prepares
only those test profiles, then signs in through the real form. Run it alone with
`pnpm exec playwright test --config e2e/web/playwright.config.ts nutrition-goals.spec.ts`.
It covers absent targets, compact percentage/gram editing with synchronized sliders/manual inputs and live equivalents, invalid totals, rounded grams,
failed save/retry, create/update, reopen/reload, zero macros, preservation of inconsistent
legacy targets, over-budget warnings/save blocking, one-screen layout at 390×844 and two-account ownership. It uses the existing calorie/gram API; scientific
suggestion integration belongs to [app#74](https://github.com/kinetix-app/app/issues/74).
Browser evidence does not establish Android/iOS acceptance.

## Clerk SSO callback regression

Run `sso-callback.spec.ts` against a Clerk-enabled `pnpm web` development server.
It uses synthetic Expo popup state to verify callback URL preservation, delivery to
the original tab, popup closure and safe direct visits. It requires no backend test
records or provider credentials. See [authentication setup](../../docs/clerk-setup.md#expo-web-sso-callback).
This regression does not verify real Google/Apple sign-in or Android behavior.

## Dedicated Profile acceptance

`profile.spec.ts` requires two private synthetic identities and a run-owned `_test` database with `APP_ENV=test`. It prepares only those accounts and verifies compact Profile navigation, failed profile save/retry, form retention across tabs, persisted edits after reload, prepared Progress, history list/detail/back navigation, two-account isolation and workout logout/resume. `onboarding.spec.ts`, `home.spec.ts` and `profile-picture.spec.ts` exercise the related setup, nutrition and picture journeys using the Profile tab. Run onboarding first against a fresh database. Browser acceptance does not establish native or real Clerk provider acceptance.
