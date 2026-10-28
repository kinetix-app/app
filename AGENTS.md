# Frontend repository instructions

These instructions apply to this React Native frontend repository. Read [README.md](README.md), the relevant GitHub issue and any more specific instructions before editing. Follow direct user instructions and document material changes to these conventions.

## Purpose and current state

Build the Android/iOS client for goals, nutrition, gym/running/cycling/walking tracking, live shared training, social feed, FriendsLeague, reusable meals/exercises/penalties, exercise-form analysis and AI coaching. Web is an optional extension, not a committed feature-parity target. Do not reintroduce professional trainer/services businesses, payments or sponsored leagues from abandoned concepts.

Kinetix was initialized on 4 October 2026 with Expo SDK 57, Router, strict TypeScript, a starter screen and public configuration tests. Authentication now includes development Basic sign-in and Clerk email OTP/Google/Apple OAuth with secure session storage and account API integration. Production provider configuration and native device validation remain outstanding. The training workspace now supports routine create/read/edit, catalogue filtering/details and planned kg/repetition sets. TanStack Query and React Hook Form are integrated; standalone Kinetix light/dark design tokens live under `src/theme/`. Session start/recording remain separate work. Inspect actual implementation before claiming a feature is complete.

## Repository boundaries and sources of truth

- Put runtime code/assets and consumed token exports here. Management owns requirements, designs, authoritative tokens and architecture/decision records. Backend owns FastAPI, migrations, permissions and AI/provider integrations.
- Keep this checkout independently installable. Do not import runtime files from sibling checkouts, add cross-repository relative documentation links, or require private coordination instructions or host-specific paths.
- This file contains shared frontend practices only. Keep credentials, private workspace context and local agent/tool settings out of published content. Preserve this explicitly requested file during scaffold integration; do not replace it with generated tool configuration.
- Whenever starting frontend Clerk authentication work, assign [frontend Clerk issue #7](https://github.com/kinetix-app/app/issues/7) to `Elcris1` and set its Status to In Progress in [Project 7](https://github.com/orgs/kinetix-app/projects/7). Record work and setup actions on that issue; link related backend work to [ACC01](https://github.com/kinetix-app/app-rest/issues/1).
- Android package/namespace and iOS bundle identifier are `cat.udl.kinetix`; the Expo URL scheme is `kinetix`.
- GitHub issues and the configured Project define tasks/current status. Use verified issue URLs or full repository-qualified references. Repository/Project mapping is pending; do not invent URLs or claim publication. Local verification checklists are not a second task board.

## Foundation and dependencies

- Use Expo's stable TypeScript/Router foundation, development builds and Continuous Native Generation. Pin its supported React/React Native pair and compatible toolchain. The validated baseline is Node 24.21.0 and pnpm 11.23.0; version pins live in repository configuration.
- Commit only `pnpm-lock.yaml`; install clean checkouts with `pnpm install --frozen-lockfile`. Use `pnpm exec expo install <package> --pnpm` for SDK/native packages. Keep additions small, justified and compatible with the SDK, New Architecture and affected platforms.
- Keep `nodeLinker: hoisted` in `pnpm-workspace.yaml`, matching Expo's template. This is a standalone application, not a cross-repository workspace. Review dependency install scripts before adding explicit `allowBuilds` entries; do not permit all dependency scripts or bypass install failures.
- Rebuild after native dependency/configuration changes. Expo Go and browser previews do not replace development-build validation.
- Express native changes through app configuration/config plugins. Ignore generated native directories only while all customizations are reproducible. Do not hand-edit disposable native projects or regenerate over unpreserved work.
- Add cloud build/deployment configuration within authorized scope; Expo does not require EAS. Do not introduce state/styling/analytics frameworks or on-device ML without a concrete requirement.

## Structure and TypeScript

- Use `src/app/` only for thin routes and `_layout.tsx`. Screens, logic, tests and utilities live outside it. Create directories when code needs them.
- Group screens, hooks, schemas, feature components and API operations in `src/features/<feature>/`. Put reusable UI in `src/components/`, shared clients/adapters in `src/services/`, providers in `src/providers/`, runtime tokens in `src/theme/` and public configuration in `src/config/`.
- Keep UI primitives independent of feature services. Avoid circular feature imports, speculative abstractions and duplicate domain logic.
- Enable TypeScript `strict`, extend `expo/tsconfig.base`, and use `@/` for `src` once configured. Treat external input as `unknown`; validate critical boundaries. Avoid unchecked `any`, assertions that hide contract errors and broad lint suppressions.
- Use functional components/Hooks. Use PascalCase component names/files, camelCase functions/hooks, lowercase feature directories, `.tsx` for JSX and `.ts` for logic. Route names follow Router semantics. Prefer named exports except framework-required defaults. Colocate meaningful `*.test.ts(x)` files outside routes.
- Use Expo ESLint/Hooks rules and Prettier. Keep unrelated cleanup out of functional changes.

## Design rules for every UI change

These rules apply when creating, editing or reviewing screens and components. Read
[src/theme/design-tokens.json](src/theme/design-tokens.json), including its token usage
notes, and [src/theme/tokens.ts](src/theme/tokens.ts) before design work. For training
flows, also read [docs/routines.md](docs/routines.md). Keep these instructions updated
when the user approves a new convention; direct user instructions take precedence.

### Design source and tokens

- Management owns the design references and authoritative design system. Follow the supplied screen references for layout, hierarchy and interaction, with the user-approved refinements below. Keep the consumed token export in this repository; building the app must not require another checkout or a network font import.
- Use `usePalette`, `spacing`, `radii`, `sizes` and `textStyles` from `src/theme/tokens.ts`. Reuse shared UI primitives. Prefer existing semantic tokens over literal colors, arbitrary spacing, radii or typography. Introduce a new token only for a demonstrated design need and document its intended use.
- Support light and dark themes. Use `surface-100` for screens, `surface-200` for cards/sheets and `surface-300` for fields and neutral chips. Use `ink` for primary text, `ink-muted` for supporting text and `line-strong` for control boundaries. Decorative `line` dividers must not be the sole control boundary.
- Pair `brand` backgrounds with `on-brand`, and `brand-soft` backgrounds with `brand-ink`. Use `danger`, `success`, `warning` and `info` for their semantic states, with text or icons rather than color alone. Nutrition macro colors require written labels.
- Use token typography for screen/section/card headings, body copy, labels and captions. Captions must not carry essential information. Limit hero headings/metrics to their intended hierarchy; use tabular numerals for comparable metrics. The design specifies Bricolage Grotesque/Figtree, but platform fallback remains intentional until font binaries are supplied and bundled.
- Follow the token spacing scale (4, 8, 12, 16, 20, 24, 32, 40, 48), radius scale (8, 12, 20, 28 and pill), minimum 44-unit touch targets and 52-unit regular controls. Respect safe areas, text scaling and keyboard visibility. Use theme-specific shadows: dark cards separate through surfaces, while dialogs/popovers use the pop elevation treatment.

### Actions, dialogs and feedback

- Use an accessible arrow icon button for back navigation, including routine, set editor and exercise details. Do not replace it with a full-width text Back button.
- Keep visible action names short and simple: Add, Remove, Save, Cancel, Discard, Back, Done. Give icon-only or repeated actions explicit accessible labels identifying their target.
- Add actions use the positive treatment (`brand-soft` / `brand-ink`). Removing an exercise and discarding a draft use danger styling. **Removing an individual set is neutral**: use the same `ink` and `surface-300` colors as the kg/reps fields, without a danger outline. Save retains the primary treatment; ordinary navigation/cancel actions are neutral.
- Confirm discarding unsaved routine edits in a centered modal with a `scrim` backdrop. Keep editing and Discard are explicit choices. The confirmation must float above the screen, never render as inline content at the bottom. Hide underlying content from accessibility while the confirmation is active and support platform back/dismiss behavior.
- Provide visible loading, empty, error and disabled/pending states. Keep entered form values after a failed save, show validation beside its field and prevent duplicate submissions.
- Preserve accessible names/roles, selected/disabled state and keyboard interaction. Focus indicators use the focus token with a 2-unit ring and 2-unit offset where supported; control/focus boundaries should meet the design's 3:1 contrast requirement. Do not rely on color alone for errors, selection or completion.

### Exercise catalogue and routine editing

- Exercise catalogue screens use one bounded vertical list, with search and active filter badges in its scrollable header. A Filters button opens a centered, scrollable checkbox modal for multiple body parts. Save applies the draft selection; Cancel leaves current filters unchanged. Active badges wrap and tapping their close action removes that part immediately. Changing search/filter resets the list to the top. Keep taps usable while the keyboard is open.
- Fetch the next exercise page automatically near the bottom, without a More button. Guard concurrent fetches, stop after a short page and retain existing results on page-fetch failure with an explicit Retry action.
- Filter exercises with **body-part** multi-selection (match any selected part), showing All body parts when empty; do not substitute granular target-muscle filters. Load available body parts from the authenticated catalogue options endpoint independently of the current page/search. Combine the selected body part with debounced name search and reset pagination when either changes.
- Routine editing has two views: the overview uses two columns with a large exercise image on the left and the exercise name plus quick set-count/kg/reps summary on the right. Tapping the name opens that slot’s focused set editor; returning retains draft values. The set editor contains no muscle/body-part text. Images open full exercise information on demand; catalogue titles may also open that information.
- Exercise information uses **muted, looping autoplay video** with app-colored play/pause, replay, mute, progress and fullscreen controls. Show the image only when video is absent or unavailable. Keep media bounded and release playback resources when closing. Listing/overview thumbnails remain images.
- Reorder exercises by dragging their cards, with a clear drag handle and accessible/keyboard alternatives. The moving card must stay **above every neighboring card in both directions**, including when dragging down. Raise the actual list cell's stacking layer on web, not only its inner card; preserve native elevation/stacking behavior. Release/cancel must clear the active layer and restore controls.
- Reordering preserves stable exercise-slot IDs and unsaved set values. Keep kg/reps units explicit. Edit planned/default sets separately from completed workout results; keep routine templates separate from session start/history.

### Design verification

- Inspect the affected screen and interaction in the available runtime, including both themes and relevant keyboard/modal/drag/media states where feasible. For drag changes check both upward and downward movement; for details check video preference and image fallback.
- Run checks appropriate to the change and report what was actually verified. Mocked tests and platform exports do not establish native device behavior. Rebuild development clients after native module changes and state any unavailable device checks.
- These are required implementation conventions, not a claim that every existing screen already conforms. Keep changes scoped to the requested work and report material inconsistencies instead of silently copying them into new screens.

## State, navigation and API behavior

- Keep transient state local; derive values instead of duplicating them. Use a small context for session/preferences. Add a global client store only for a demonstrated need.
- Use TanStack Query for server data once integrated. Include identity/filters in keys, tune retries/freshness, wire native focus/connectivity, and cancel/clear private queries on logout/account change. Do not duplicate server records in another global store.
- Use React Hook Form/Zod for substantial forms. Validate finite values, units and domain limits; a keyboard type is not validation. Show field errors and retain input after failed saves.
- Layouts own navigation/providers. Route parameters carry identifiers/harmless filters, not credentials or personal records. Handle session restoration before redirecting; client guards never replace backend permissions.
- Use the shared generic `apiClient` for HTTP requests. `authService` supplies the Authorization header: Clerk bearer tokens in release builds, with runtime Basic email/password credentials in development builds by default. Explicit `clerk` mode can exercise Clerk in development; release builds reject Basic mode. Keep credentials in memory; let Clerk/SecureStore own durable session storage. Feature API modules own operations; screens/routes do not construct ad hoc requests. Do not blindly retry mutations without an agreed idempotency contract.
- Define runtime response/input schemas with Zod in each feature’s `schemas.ts` and infer TypeScript types from them. Pass `{ schema }` to API requests for validation and return-type inference; plain generics do not validate external data.
- Implement agreed backend contracts. Keep generated types/client or reproducible generation local to this repository; generation is not runtime validation. Do not invent authentication, pagination or error schemas.
- Show loading, empty, pending, success and failure states where relevant. Do not show an optimistic write as persisted before confirmation. Offline writes/draft recovery need agreed behavior, not an implicit promise from query caching.

## Domain and platform rules

- Keep units explicit: nutrition grams, gym kilograms, activity minutes and kilometres. Distinguish user-local day dates from timestamp instants; display times in the user's timezone.
- Deterministic application/backend logic owns totals, scores and progress comparisons. AI explains/proposes; it never replaces measured records or authoritative calculations.
- Keep routine templates, completed activities and shared membership distinct. Posts/leagues refer to existing activity identity; avoid duplicate records/scores. Saved market copies retain provenance and remain separate from public originals.
- Put real-time management behind a service. Agree transport, authorization, revisions and reconnect/resynchronization with backend; clean up listeners/connections. Completion status alone does not demonstrate live training data.
- Put storage/media capabilities behind platform adapters. Use SecureStore for native session credentials; ordinary AsyncStorage is not token storage. Web authentication needs its own agreed contract.
- Keep provider secrets and AI access in backend. `EXPO_PUBLIC_` values are public. Do not log credentials, private fitness records or videos; clear private session/cache data on logout.
- Management owns design tokens; keep standalone runtime exports here. Use React Native primitives/StyleSheet initially, accessible labels/roles, text scaling, safe areas and deliberate keyboard handling. Template colors/navigation are not approved design.
- Use virtualized/paginated lists, stable IDs and bounded media. Profile release performance before speculative optimization.
- Add camera/picker/playback with the consuming increment. Handle permission denial/cancellation, upload/processing errors and agreed temporary-file cleanup. Pose output or mocked feedback does not establish a working form checker.

## Verification and documentation

- Keep the workflow in `.github/workflows/ci.yml` aligned with the package scripts, `sonar-project.properties` and pinned Node/pnpm configuration. Preserve the stable `Frontend checks` job name used by branch protection. The SonarCloud job consumes the uploaded LCOV report and the `SONAR_TOKEN` secret, enforces the project's configured quality gate with a 300-second timeout and is skipped for fork pull requests. Use commit-pinned actions and read-only permissions; do not suppress failed required checks or introduce filters that prevent them from reporting.

- Inspect available scripts first. Once configured, run type/lint/format checks and targeted tests appropriate to the change. Use Jest/`jest-expo` and React Native Testing Library for meaningful behavior, not trivial scaffold assertions or large snapshots.
- Check affected native flows, especially permissions/media/lifecycle. Bundling and mocked tests do not prove native compilation, device execution or backend integration.
- Report checks actually run, results, platforms/devices tested and blockers. Never report unavailable/skipped checks as passed. A starter screen does not fulfill the sprint foundation's second-developer setup and backend save/read demonstration.
- Keep README versions, prerequisites, commands, environment setup and troubleshooting aligned with actual files. Label planned behavior/examples clearly. Write documentation in English; keep relative links within this repository.
- Keep changes reviewable and tied to their issue. Explain resulting behavior and validation; preserve unrelated work and seek the product owner's decision for changes to required behavior.
