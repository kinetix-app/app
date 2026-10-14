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

Clerk is the default auth mode:

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

Development builds can explicitly select:

```dotenv
EXPO_PUBLIC_AUTH_MODE=basic
```

A future development sign-in screen supplies credentials at runtime:

```ts
authService.setBasicCredentials(username, password);
await apiClient.get<Account>('/api/v1/me');
authService.clear();
```

Basic mode is rejected in release builds. Credentials do not belong in `EXPO_PUBLIC_` variables, source code or ordinary persistent storage. The frontend service prepares the header; the backend still needs its development Basic Auth implementation before these requests can authenticate. Restart Metro after changing public environment values.
