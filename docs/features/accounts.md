# Accounts

## Current state

The app validates the authenticated account returned by `GET /api/v1/me` before showing
private screens. The account ID is numeric and scopes private query state. When the
account changes, `HomeScreen` remounts under the new ID and the private query provider
cancels requests and clears cached data on unmount/logout.

The account feature exports validated `getAccount` and `updateProfile` API helpers. The
profile PATCH schema supports omitted values versus explicit `null`, but no screen calls
`updateProfile`: profile editing is not part of the current UI. Account provisioning and
ownership authorization are backend responsibilities.

## Code and evidence

- `src/features/accounts/api.ts` and `schemas.ts` define the client contract.
- `src/features/accounts/test/api.test.ts` covers the helper and payload validation.
- `src/features/auth/` uses `getAccount` during sign-in.
- `src/features/home/components/HomeScreen.tsx` scopes private app state to the account.
- The backend owns `GET /api/v1/me`, `PATCH /api/v1/me/profile`, account provisioning
  and persisted profile values; see the
  [backend account status](https://github.com/kinetix-app/app-rest/blob/master/docs/features/accounts.md).

## Remaining gaps

There is no profile view/edit flow, account deletion flow or account-linking UI. Do not
assume that having an API helper means a user-facing profile feature is complete.
