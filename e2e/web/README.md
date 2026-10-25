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
