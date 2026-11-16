# Frontend implementation conventions

These are the detailed rules summarized in [AGENTS.md](../AGENTS.md). Read the sections relevant to the implementation or review, including dependency, configuration, CI and testing changes.

## Repository boundaries and sources of truth

- Put runtime code/assets and consumed token exports here. Management owns requirements, designs, authoritative tokens and architecture/decision records. Backend owns FastAPI, migrations, permissions and AI/provider integrations.
- Keep this checkout independently installable. Do not import runtime files from sibling checkouts, add cross-repository relative documentation links, or require private coordination instructions or host-specific paths.
- Published frontend guidance contains shared practices only. Keep credentials, private workspace context and local agent/tool settings out of published content. Preserve `AGENTS.md` during scaffold integration; do not replace it with generated tool configuration.
- Whenever starting frontend Clerk authentication work, assign [frontend Clerk issue #7](https://github.com/kinetix-app/app/issues/7) to `Elcris1` and set its Status to In Progress in [Project 7](https://github.com/orgs/kinetix-app/projects/7). Record work and setup actions on that issue; link related backend work to [ACC01](https://github.com/kinetix-app/app-rest/issues/1).
- Android package/namespace and iOS bundle identifier are `cat.udl.kinetix`; the Expo URL scheme is `kinetix`.
- GitHub issues and the configured Project define tasks/current status. Use verified issue URLs or full repository-qualified references. Do not invent repository/Project URLs or claim unverified publication. Local verification checklists are not a second task board.

## Foundation and dependencies

- Use Expo's stable TypeScript/Router foundation, development builds and Continuous Native Generation. Pin its supported React/React Native pair and compatible toolchain. Version pins live in repository configuration; use the README setup commands.
- Commit only `pnpm-lock.yaml`; install clean checkouts with `pnpm install --frozen-lockfile`. Use `pnpm exec expo install <package> --pnpm` for SDK/native packages. Keep additions small, justified and compatible with the SDK, New Architecture and affected platforms.
- Keep `nodeLinker: hoisted` in `pnpm-workspace.yaml`, matching Expo's template. This is a standalone application, not a cross-repository workspace. Review dependency install scripts before adding explicit `allowBuilds` entries; do not permit all dependency scripts or bypass install failures.
- Rebuild after native dependency/configuration changes. Expo Go and browser previews do not replace development-build validation.
- Express native changes through app configuration/config plugins. Ignore generated native directories only while all customizations are reproducible. Do not hand-edit disposable native projects or regenerate over unpreserved work.
- Add cloud build/deployment configuration within authorized scope; Expo does not require EAS. Do not introduce state/styling/analytics frameworks or on-device ML without a concrete requirement.

## Structure and TypeScript

- Use `src/app/` only for thin routes and `_layout.tsx`. Screens, logic, tests and utilities live outside it. Create directories when code needs them.
- Group each feature under `src/features/<feature>/`. Put all feature components, including screen compositions, in `components/`; put feature tests, fixtures and mocks in `test/` (singular). Put reusable UI in `src/components/`, shared clients/adapters in `src/services/`, providers in `src/providers/`, runtime tokens in `src/theme/` and public configuration in `src/config/`.
- Existing features may still use a flat layout. Apply these conventions to new files; migrate existing files with an affected feature or a dedicated organization task, preserving imports/platform variants. Do not mix repository-wide moves into unrelated changes.
- Use focused `api.ts` and `schemas.ts` modules. Add `hooks/`, `queryKeys.ts` or an `index.ts` public entry point only when needed; do not create empty scaffolding. Keep platform variants beside the default component. Cross-feature imports use deliberate public entry points rather than private files. Promote UI to `src/components/` when actual reuse warrants it.
- Keep UI primitives independent of feature services. Avoid circular feature imports, speculative abstractions and duplicate domain logic.
- Enable TypeScript `strict`, extend `expo/tsconfig.base`, and use `@/` for `src` once configured. Treat external input as `unknown`; validate critical boundaries. Avoid unchecked `any`, assertions that hide contract errors and broad lint suppressions.
- Use functional components/Hooks. Use PascalCase component names/files, camelCase functions/hooks, lowercase feature directories, `.tsx` for JSX and `.ts` for logic. Route names follow Router semantics. Prefer named exports except framework-required defaults. Put meaningful `*.test.ts(x)` files in the feature’s `test/` directory; keep shared test infrastructure in `src/test/`.
- Use Expo ESLint/Hooks rules and Prettier. Keep unrelated cleanup out of functional changes.

## State, navigation and API behavior

- Keep transient state local; derive values instead of duplicating them. Use a small context for session/preferences. Add a global client store only for a demonstrated need.
- Use TanStack Query for server data. Include identity/filters in keys, tune retries/freshness, wire native focus/connectivity, and cancel/clear private queries on logout/account change. Do not duplicate server records in another global store.
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

## Real application acceptance testing

- Use Jest/`jest-expo` and React Native Testing Library for focused behavior checks. Use Playwright for browser E2E and Maestro for native Android/iOS E2E when those targets are affected. These are runner conventions, not a claim that either runner is installed or configured; inspect available tooling. Establish new runner/CI configuration only when explicitly included in the task; otherwise report the missing prerequisite and leave live acceptance blocked.
- Verify full-stack acceptance through the real sign-in screen, authenticated API and persisted data. Use the user-authorized development account from private local configuration. Never commit its credentials, copy them into examples or expose them in logs, traces, screenshots or reports. Missing credentials are a setup blocker, not permission to invent an account.
- Save, reopen and reload changed records against the real backend. Use mocks for focused unit/error cases or temporary work while an agreed endpoint is unavailable; mocked acceptance cannot establish delivered integration.
- One assigned acceptance owner (the coordinator or a selected verifier) owns the acceptance environment. A separate verifier is optional. Coordinate ports, migrations, accounts and test records with the orchestrator; isolate concurrent runs. Create identifiable test-owned records, clean up only those records and preserve existing account data. Use a second account for permission/isolation cases when applicable.
- Record scenarios, commands, backend/environment, platforms and actual results. Browser evidence does not establish native behavior; report unavailable native checks and other blockers explicitly.

## Local SonarQube

Use [the local verification runbook](../README.md#local-verification-with-sonarqube) for private configuration, full `pnpm verify` or focused `pnpm sonar:local` execution, and the findings report. The frontend owns these Node/Compose commands; do not run the backend’s uv scanner against it. Compare issue keys only after the new submitted task has finished. Findings are evidence, not permission to expand scope into unrelated refactors or suppressions. Preserve existing required CI checks and distinguish a completed analysis from its quality gate result.
