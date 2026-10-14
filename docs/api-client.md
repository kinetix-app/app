# API client and auth service

Use the shared client from feature API modules:

```ts
import { apiClient } from '@/services/apiClient';

const account = await apiClient.get<Account>('/api/v1/me');
const updated = await apiClient.patch<Account>('/api/v1/me/profile', {
  display_name: 'Alice',
});
```

`get<T>`, `post<T>`, `put<T>`, `patch<T>` and `delete<T>` return `Promise<T>`. JSON bodies and headers are handled by the client. A generic alone describes the expected response without validating it. Pass a Zod schema to validate external JSON and infer the response type:

```ts
import { accountSchema } from '@/features/accounts/schemas';

const account = await apiClient.get('/api/v1/me', { schema: accountSchema });
// account is inferred from the schema; malformed responses throw ZodError.
```

Define feature schemas in `schemas.ts` and derive types with `z.infer<typeof schema>` rather than maintaining separate interfaces. Account reads and updates use this pattern; profile PATCH input is validated too, preserving omitted fields versus explicit null. Use `schema.safeParse(value)` for forms when field errors should be displayed without throwing. Schemas validate structure; the backend remains authoritative for business rules such as valid IANA timezones.

The project reuses its locked Zod package through the supported `zod/v4` entry point. There are no native modules or plugins to configure for schema validation. A 204 response returns no value; use `void` for that contract, or a schema that accepts undefined.

Set `EXPO_PUBLIC_API_URL` to the backend origin, without `/api/v1`. Paths start with `/`, so the client also works with public endpoints such as `/health/live`. HTTP errors throw `ApiError` with a `status`. HTTP requests time out after 15 seconds, accept a caller `signal` and are not retried automatically.

## Clerk

Clerk is the release-build auth mode. Select it explicitly to exercise its screen in a development build:

```dotenv
EXPO_PUBLIC_AUTH_MODE=clerk
```

Once Clerk is connected, register its ordinary token getter:

```ts
import { authService } from '@/services/authService';

// In the session integration, after Clerk has loaded:
authService.setTokenProvider(getToken);

// Alternatively, a session integration can supply an existing bearer token:
authService.setToken(token);

// Clear credentials on logout or an account change:
authService.clear();
```

The request interceptor reads the header for every request. A token provider allows Clerk to renew tokens. `clear()` removes both the stored header and the provider. Clerk and SecureStore own persistent session storage; this service keeps only in-memory state. SDK setup and sign-in UI are still pending.

## Development Basic Auth

Development builds default to Basic when the auth-mode value is blank. They can also explicitly select:

```dotenv
EXPO_PUBLIC_AUTH_MODE=basic
```

The development sign-in screen accepts email/password inputs, supplies credentials at runtime and verifies them by calling `/api/v1/me`:

```ts
authService.setBasicCredentials(username, password);
await apiClient.get<Account>('/api/v1/me');
authService.clear();
```

Sign-in only succeeds after `/api/v1/me` returns a valid account. Failed attempts retain the entered form values and clear the auth header; sign-out clears the header and form. Basic mode is rejected in release builds. Credentials do not belong in `EXPO_PUBLIC_` variables, source code or ordinary persistent storage. The frontend service prepares the header; the backend still needs its development Basic Auth implementation before these requests can authenticate. Restart Metro after changing public environment values.

## Issue and commit scope

- [DEV02 — frontend #6](https://github.com/kinetix-app/app/issues/6): development email/password form, Basic header and sign-out. Requires [DEV01 — backend #7](https://github.com/kinetix-app/app-rest/issues/7).
- [ENV01 — frontend #7](https://github.com/kinetix-app/app/issues/7): production Clerk configuration and methods. Displayed controls remain disabled until the SDK/provider connection is implemented.
- Shared API/auth/schema commits reference both frontend issues. Neither issue is closed by preparatory work.
