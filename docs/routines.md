# Kinetix-012 routine editor

Issue: https://github.com/kinetix-app/app/issues/4

## Investigation and implementation plan

The Routines and NewRoutine design references define an owned routine list, a named
routine form, exercise rows, and an Add exercise action. The ActiveSession reference
provides the set-row layout (kg/repetitions); template editing uses these fields without
session completion controls. Catalogue body-part chips use the exercise API. History and start-session links need
separate API capabilities and are not simulated in this increment.

1. Export the supplied design tokens into standalone frontend runtime files, supporting
   light/dark surfaces, typography, spacing, radii and minimum touch targets.
2. Extend the existing routine API to persist per-slot planned gym sets atomically.
   Derive set numbers from array order. Omitted sets preserve defaults on retained
   exercises; an empty array clears defaults. Completed sessions remain unchanged.
3. Add Zod-validated training API operations and identity-scoped TanStack Query data.
   Paginate routine/catalogue lists and filter catalogue body parts through the API.
4. Build routine list, create/edit form, exercise selector/detail and planned set editor.
   Preserve slot IDs, support removal/reordering and repeated exercises, retain unsaved
   input on failure and confirm before discarding changes.
5. Enter the workspace only after account verification in Basic/Clerk sign-in, discard
   private state on logout/session change and fix the integer account-ID contract.
6. Verify API serialization, save/reopen/edit/set persistence, validation, failure/input
   retention and account cache isolation. Run frontend checks and backend regression tests.

## Runtime contract

All routes use the existing authenticated API client. List responses are paginated
`{items, limit, offset}`; no filter means all selectable gym exercises. Body-part filtering (`body_part`)
matches `body_parts` case-insensitively. Routine create/PATCH selections may include
`sets: [{reps: 8, weight_kg: "80.00"}]`. Weights are nonnegative kilograms with at most
two decimals; repetitions are positive integers. Set order determines set number.
The editor changes saved `default_sets`, never the resolved previous-workout `sets`.

This is template authoring, not session start or performance recording. Fonts use the
platform fallback until the design font binaries are supplied locally. No runtime import
from the design/backend repositories is required.

## Verification

Verified on 23 October 2026 with Node 24.21.0 / pnpm 11.23.0:

- TypeScript, ESLint, Prettier and 72 frontend tests passed.
- Expo Doctor: 21/21 checks passed; Android, iOS and web exports passed.
- Backend regression suite: 146 tests passed with PostgreSQL and Azurite.
- Browser flow against an isolated PostgreSQL test schema: sign in, select three exercises
  from eight, save a routine with planned sets, reopen, change kg, reorder, save and reopen.
  The changed 82.50 kg / 8 repetitions and exercise order persisted.

Native compilation/device execution, physical keyboard behavior and production Clerk
providers were not verified. Rebuild development clients for expo-network. Session-start
integration remains outside Kinetix-012's implemented increment.

The dependency audit reports the existing Expo/tooling advisories in `braces` and
`node-forge` (high), and `uuid` and `decode-uri-component` (moderate). These paths predate
the new query/form/network dependencies; no SDK override was introduced for this feature.

## Catalogue and editor refinements

- The body-part filter modal loads all available body parts through authenticated
  `GET /api/v1/exercises/body-parts`, independently of the current search/page.
- Catalogue and routine searches send `name` after a 300 ms debounce. Search is a literal,
  case-insensitive substring; names combine with any selected body part and reset pagination.
- Exercise pages validate a seven-field summary DTO: id, name, activity_type, body_parts, target_muscles,
  equipments and image_url. Full details load only when the user opens an exercise.
- Routine overview cards use a large image in the left column, with the exercise name
  and live set-count/reps/kg summary in the right column. Tapping the name opens that
  slot’s set editor; tapping the image opens exercise information. Returning keeps edits.
- Set editing follows the ActiveSession set-row layout without session completion or
  muscle labels. Back navigation uses accessible arrow icon buttons.
- Exercise information autoplays `video_url` muted and looping, with themed pause/play,
  replay, mute, progress and fullscreen controls. Images appear only when video is absent
  or unavailable. Expo Video requires rebuilding native development clients.
- A drag handle reorders cards while retaining stable slots and edited sets. Native uses
  Reanimated/Gesture Handler with long-press drag and accessible reorder actions; the web
  adapter uses pointer capture with mouse/touch, and keyboard arrow alternatives.
- Add actions use positive styling; exercise Remove and Discard use danger styling.
  Set removal uses neutral text and surface colors matching the kg/reps fields. Confirmation is a
  centered, backdrop-covered modal, outside the scrolling content.

Refinements verified on 23 October 2026:

- 79 frontend tests, TypeScript, ESLint and Prettier passed.
- 149 backend tests passed, including PostgreSQL persistence and real Azurite readback.
- Android, iOS and web exports passed after the body-part filter change.
- Browser verification with synthetic exercises confirmed body-part chips combined with
  name search; UPPER LEGS + "press" returned only Leg press. Earlier browser checks
  confirmed drag/save/reopen order, exercise details and centered discard confirmation.
- The application uses `body_part`; legacy muscle API filters remain compatible.

Native gesture behavior still needs device validation; exports establish bundle validity.

Inline video refinement: 83 frontend tests passed, including video preference, missing
video fallback, playback-error fallback and absent media. TypeScript, ESLint, Prettier,
Expo Doctor (21/21) and Android/iOS/web exports passed. Browser playback against the
isolated preview reached readyState 4 with advancing playback time. Native device
playback remains unverified; rebuild development clients for Expo Video.

## Two-view design refinement (24 October 2026)

The routine list follows the Routines reference's compact icon/name/chevron rows.
The routine overview follows NewRoutine's heading, name field, exercise grouping and
Add/Save hierarchy, with the user-requested large image/summary columns. The focused
set editor follows ActiveSession's exercise position/title and kg/reps rows, without
session completion controls. Names open set editing; images open exercise information.
All back actions use accessible arrow buttons. Local form state survives transitions.
Summaries show set count and ranges when weights or repetitions differ between sets.

Exercise information autoplays muted and looping only once the player is ready. The
app-themed controls provide pause/play, replay, mute, progress and fullscreen. Later
buffering must not override a user's pause. Missing/unavailable videos fall back to the
image. Muscle/body-part labels are omitted from the set editor and exercise information.

Verification: 86 frontend tests, TypeScript and ESLint passed. Browser checks at 390 × 844
confirmed both views, changed kg persisted through save/reopen, image fallback, actual
muted autoplay, pause, fullscreen and exercise reordering in both directions. Android,
iOS and web exports passed. Native device playback/gestures remain unverified; the
local simulator tool is unavailable. Browser previews used synthetic test records and
an isolated PostgreSQL test schema, not personal routine data.

Catalogue scrolling fix: search, wrapped body-part chips and exercise results share a
single bounded vertical FlatList. Changing the body part or name scrolls to the top;
filter taps remain enabled with the keyboard open. Browser verification at 390 × 844
reached the last of eight synthetic exercises (scroll offset 1021 of 1021) and selected
WAIST from ten body-part options, returning only the matching exercise. All 87 frontend
tests, TypeScript, ESLint and Prettier passed. Native device scrolling remains unverified.

Multi-filter/infinite-scroll refinement: the Filters action opens a centered checkbox
modal. Save applies its draft selection, Cancel preserves applied filters and Clear
clears the draft. Applied parts appear as removable badges; no selection means all
exercises. The API receives repeated `body_part` parameters, matching any selected part
and combining that selection with name search. Exercise pages load automatically near
the end of the list. Pending requests are guarded; a failed next page keeps existing
results and offers Retry instead of repeatedly fetching. A short page ends pagination.

Verified multi-filter refinement on 24 October 2026: 90 frontend tests and 150 backend
tests passed, as did type/lint checks and Android/iOS/web exports. Browser verification
at 390 × 844 automatically loaded all 44 synthetic exercises across three pages, applied
BACK + CHEST together, then removed BACK through its badge. Native device behavior
remains unverified. The design rules in AGENTS.md reflect the modal/badge interaction.
