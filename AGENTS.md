# Frontend repository instructions

These instructions apply to this React Native frontend repository. Read [README.md](README.md), the relevant GitHub issue and any more specific instructions before editing. Follow direct user instructions and document material changes to these conventions.

## Purpose and current state

Build the Android/iOS client for goals, nutrition, gym/running/cycling/walking tracking, live shared training, social feed, FriendsLeague, reusable meals/exercises/penalties, exercise-form analysis and AI coaching. Web is an optional extension, not a committed feature-parity target. Do not reintroduce professional trainer/services businesses, payments or sponsored leagues from abandoned concepts.

Kinetix was initialized on 4 October 2026 with Expo SDK 57, Router, strict TypeScript, a starter screen and public configuration tests. Feature flows, backend integration and native device validation remain outstanding. Inspect actual implementation before claiming a feature is complete.

## Repository boundaries and sources of truth

- Put runtime code/assets and consumed token exports here. Management owns requirements, designs, authoritative tokens and architecture/decision records. Backend owns FastAPI, migrations, permissions and AI/provider integrations.
- Keep this checkout independently installable. Do not import runtime files from sibling checkouts, add cross-repository relative documentation links, or require private coordination instructions or host-specific paths.
- This file contains shared frontend practices only. Keep credentials, private workspace context and local agent/tool settings out of published content. Preserve this explicitly requested file during scaffold integration; do not replace it with generated tool configuration.
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

## State, navigation and API behavior

- Keep transient state local; derive values instead of duplicating them. Use a small context for session/preferences. Add a global client store only for a demonstrated need.
- Use TanStack Query for server data once integrated. Include identity/filters in keys, tune retries/freshness, wire native focus/connectivity, and cancel/clear private queries on logout/account change. Do not duplicate server records in another global store.
- Use React Hook Form/Zod for substantial forms. Validate finite values, units and domain limits; a keyboard type is not validation. Show field errors and retain input after failed saves.
- Layouts own navigation/providers. Route parameters carry identifiers/harmless filters, not credentials or personal records. Handle session restoration before redirecting; client guards never replace backend permissions.
- Use one shared request client with authorization, cancellation/timeouts and consistent errors. Feature API modules own operations; screens/routes do not construct ad hoc requests. Do not blindly retry mutations without an agreed idempotency contract.
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

- Keep the PR workflow in `.github/workflows/ci.yml` aligned with the package scripts and pinned Node/pnpm configuration. Preserve the stable `Frontend checks` job name used by branch protection. Use commit-pinned actions, read-only permissions and no application secrets; do not suppress failed required checks or introduce filters that prevent them from reporting.

- Inspect available scripts first. Once configured, run type/lint/format checks and targeted tests appropriate to the change. Use Jest/`jest-expo` and React Native Testing Library for meaningful behavior, not trivial scaffold assertions or large snapshots.
- Check affected native flows, especially permissions/media/lifecycle. Bundling and mocked tests do not prove native compilation, device execution or backend integration.
- Report checks actually run, results, platforms/devices tested and blockers. Never report unavailable/skipped checks as passed. A starter screen does not fulfill the sprint foundation's second-developer setup and backend save/read demonstration.
- Keep README versions, prerequisites, commands, environment setup and troubleshooting aligned with actual files. Label planned behavior/examples clearly. Write documentation in English; keep relative links within this repository.
- Keep changes reviewable and tied to their issue. Explain resulting behavior and validation; preserve unrelated work and seek the product owner's decision for changes to required behavior.
