# FriendsLeague

The authenticated League tab supports multiple private leagues, creation with an immutable IANA timezone, member lists, admin rename/invitation generation, and explicit authenticated invitation confirmation. Invite links remain reusable for 48 hours; recipients may open them directly or paste the link/token into Join a league. Membership starts at the exact acceptance instant and grants no retroactive credit.

The League tab follows the shared dark screen header, spacing and typography conventions. Leagues use rounded surface cards with role/timezone summaries; creation and joining use shared text fields and distinct primary, positive and neutral actions. Standings use scrollable round chips and exact score rows with the current member identified as **You**. Rules, members and admin controls are grouped into cards, and round results use a bounded, centered dialog.

Selected leagues show the approved fixed rules, current/past round standings, general standings and daily contributions. Integer scores remain exact decimal strings. Only your contributions expose source workout and calculation inputs; another member cannot inspect your body weight or private workout details. The fixed score is confirmed gym volume × elapsed hours / snapshotted profile weight, rounded to an integer with halves up. Each local start day credits only the highest scoring session; equal scores use earliest completion then source ID.

Weeks run Monday 00:00 inclusive through the next Monday 00:00 exclusive in the league timezone, including daylight-saving changes. The first week is partial. General totals retain all rounds including the current round. Historical persistence-only leagues without an agreed timezone/exact membership timestamp require explicit migration; the app shows a calendar error rather than inventing history.

A selected league fetches persisted pending round outcomes oldest first. The dialog identifies every tied lowest-score member (or no losing outcome with fewer than two participants) and shows saved standings. Only pressing **Got it** acknowledges the displayed result for your membership. Failed acknowledgement retains the dialog for retry. Acknowledged results do not automatically return after reopening; crashes or simultaneous devices can display an unacknowledged result again. Closure assigns no penalty and publishes no post.

Penalty pools/roulette, social sharing, editable calendars, dynamic formulas/challenges, leaving/expulsion/transfer/deletion are outside this increment.

## Verification

Focused Jest tests live under `src/features/leagues/test`. Browser acceptance uses `e2e/web/friends-league.spec.ts` against a run-owned `friends_league_*_test` database, three private synthetic identities and the actual Basic login/API. Set the existing E2E variables plus `KINETIX_E2E_EMAIL_OUTSIDER`, `KINETIX_E2E_PASSWORD_OUTSIDER`, `KINETIX_BACKEND_ROOT`, `APP_ENV=test` and `DATABASE_URL`. The fixture only prepares named test leagues and a synthetic exercise. It ages test-owned membership/creation times to exercise scoring and an expired all-zero round without waiting a week; actual sessions, closure and acknowledgements use the real API.

Run `pnpm exec playwright test --config e2e/web/playwright.config.ts friends-league.spec.ts`. Keep credentials, traces and generated artifacts private. Android/iOS evidence remains separate; the browser suite does not prove native behavior or production Clerk providers.

Android flow files are `.maestro/friends-league.yaml`, `friends-league-join.yaml` and `friends-league-result.yaml`. They require an isolated build/emulator, private `MAESTRO_KINETIX_E2E_EMAIL` / `MAESTRO_KINETIX_E2E_PASSWORD`, `MAESTRO_LEAGUE_NAME` and a private invitation for the join flow. Result preparation must use only a named run-owned test league. On 17 November 2026 the APK compiled, installed and launched on Android API 34, but the app failed before login with `RNSModule` / null `FabricUIManager`; these native flows are **not passing acceptance evidence**. The browser journey passes; Android acceptance requires a working base native runtime. No iOS acceptance was performed.
