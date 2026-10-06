# Kinetix — frontend

The Android and iOS client for a university fitness project. The product brings together goals, nutrition, workout/activity tracking, shared training, a social feed, FriendsLeague competitions, reusable community content, exercise-form analysis and an AI personal trainer.

**Current status — 4 October 2026:** the Expo/React Native foundation is initialized with a Kinetix starter screen, navigation, strict TypeScript and public configuration validation. Product features and backend integration are not implemented. Native compilation and device execution still need verification on the team's Android/iOS toolchains.

Android and iOS are the delivery targets. Web-compatible code and browser previews are useful, but complete web support is not currently committed.

## Where this repository fits

| Area                       | Responsibility                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Frontend — this repository | React Native screens, navigation, application state, API integration, runtime design-token exports and app assets                  |
| Backend                    | FastAPI services, PostgreSQL persistence/migrations, authentication/authorization, real-time services and AI/provider integrations |
| Management                 | Product requirements, sprint commitments, designs, authoritative token definitions, architecture and decision records              |

The API and monitoring areas were also named, but their repository mapping/scope remains unresolved. Verified repository and GitHub Project links will be added when supplied. Develop against documented API contracts and a reachable backend URL; no sibling repository checkout is required to install this frontend.

GitHub issues define work and acceptance criteria; the shared GitHub Project tracks planning and current status. Documentation, mock responses and starter screens do not prove that a feature is complete. Initial frontend work supports the Sprint 1 account → goal → gym routine → recorded workout → logged meal journey. The broader product evolves across later sprints.

## React Native in a few minutes

Most application work is written in **TypeScript**, not Java or Swift. **React** describes screens as components: functions that return UI. Props supply inputs; state holds values that change; Hooks such as `useState` let components use state. Updating state causes React to render the relevant UI again. [React quick start](https://react.dev/learn)

**React Native** renders platform UI from components such as `View`, `Text`, `TextInput` and `Pressable`. Shared mobile screens use these instead of HTML tags, and styles are JavaScript objects rather than ordinary browser stylesheets. A `.tsx` file combines TypeScript with JSX, the markup-like syntax for components. [Core components](https://reactnative.dev/docs/intro-react-native-components)

| Tool              | What it does here                                                                    |
| ----------------- | ------------------------------------------------------------------------------------ |
| Expo              | React Native framework with project tooling and device libraries                     |
| Expo Router       | Turns files in `src/app/` into routes; `_layout.tsx` configures navigation/providers |
| Metro             | Bundles JavaScript/TypeScript and serves it during development                       |
| Development build | Our own installed native app, containing the native libraries our project uses       |
| CNG / Prebuild    | Generates Android/iOS projects from app configuration and config plugins             |
| pnpm / lockfile   | Installs dependencies reproducibly; the lockfile records resolved versions           |

The installed development app supplies native capabilities, while Metro supplies development JavaScript. Most screen changes use Fast Refresh. Adding a native library or changing native permissions/configuration needs a new native build. Expo Go is an optional learning tool with a fixed native runtime; use our development build for integration. [Development builds](https://docs.expo.dev/develop/development-builds/faq/)

## Development prerequisites

Everyone needs Git, **Node 24.21.0 LTS**, **pnpm 11.23.0**, an editor with TypeScript support, and access to this repository. Node is pinned in `.node-version`/`.nvmrc`; pnpm is pinned in `package.json`. Install pnpm using its [official installation guide](https://pnpm.io/installation), then check the versions below. The application uses Expo SDK 57, React 19.2.3 and React Native 0.86.3; keep their versions aligned. [Expo system requirements](https://docs.expo.dev/get-started/create-a-project/)

pnpm reuses a shared dependency store across installations. We use the hoisted dependency layout generated by Expo's pnpm template, configured in `pnpm-workspace.yaml`, to keep native tooling setup familiar. This file configures this single application; it does not join other repositories into a workspace. Use pnpm consistently and commit only `pnpm-lock.yaml`. [Expo package-manager support](https://docs.expo.dev/more/create-expo/)

| Target                             | Additional local requirements                                                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android on Linux, Windows or macOS | Android Studio, SDK Platform 36, Build Tools 36.0.0, NDK 27.1.12297006, SDK environment configuration, JDK 17, and an emulator or physical device               |
| Android physical device            | USB debugging/device authorization for the initial local installation, or the agreed team distribution method; network access to Metro and the development API  |
| iOS local build                    | macOS, a supported Xcode version and its command-line tools, and CocoaPods for native dependency installation; an iOS simulator or signed physical-device build |
| iOS from another operating system  | An agreed Mac/cloud build and installation route; cloud build access and signing are not configured yet                                                         |
| Optional browser preview           | A modern browser and compatible web dependencies; native-only APIs still need native testing                                                                    |

Use the [React Native environment guide](https://reactnative.dev/docs/set-up-your-environment) and [Expo environment guide](https://docs.expo.dev/get-started/set-up-your-environment/) for platform-specific installation. The generated baseline targets Android API 24+ (Android 7+) and iOS 16.4+. Confirm the team's demo devices meet these minimums; generated project settings remain the source of truth after SDK upgrades. On Windows, use one supported shell/toolchain consistently; avoid mixing Windows and WSL installations.

Check `node --version` and `pnpm --version`; for local Android builds also check `java -version` and `adb devices`. The emulator/device should appear as authorized. Tool installation alone is not proof that the project builds.

## First setup

Clone this repository and use the existing app; do not run `create-expo-app` inside it. No Expo account or cloud service is required for a local build.

1. Open a terminal in this repository's root, where `package.json` lives. Switch to the pinned Node version using your preferred version manager.
2. Run `pnpm install --frozen-lockfile` to install dependencies from `pnpm-lock.yaml`. A missing/outdated lockfile must be fixed rather than bypassed.
3. Optionally copy `.env.example` to `.env.local`. Leave `EXPO_PUBLIC_API_URL` blank for the standalone starter screen; set it to the agreed backend URL when integrating an API. The app rejects malformed/non-HTTP URLs and URLs containing credentials, query strings or fragments. Keep local environment files untracked.
4. Start an Android emulator or connect/authorize a physical device. On macOS, choose an iOS simulator or arrange device signing.
5. Build/install the development app using `pnpm android` or, on macOS, `pnpm ios`. Keep Metro running; for later JavaScript-only sessions use the start script.
6. Check that the Kinetix starter screen loads, then verify a documented backend flow once implemented. Report the platform/device and actual result.

The following commands are configured:

| Command                          | Expected purpose                                                  |
| -------------------------------- | ----------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Install the committed dependency tree                             |
| `pnpm start`                     | Start Metro for the development build (`expo start --dev-client`) |
| `pnpm android`                   | Build/install/run Android (`expo run:android`)                    |
| `pnpm ios`                       | Build/install/run iOS on macOS (`expo run:ios`)                   |
| `pnpm web`                       | Optional browser preview (`expo start --web`)                     |
| `pnpm typecheck`                 | Check TypeScript without emitting files                           |
| `pnpm lint`                      | Check code with the project's Expo ESLint configuration           |
| `pnpm format:check`              | Check Prettier formatting                                         |
| `pnpm test`                      | Run the public configuration boundary tests                       |

The platform run commands generate native projects, install native dependencies and can start Metro themselves. Reuse an existing server instead of starting competing sessions. `pnpm start` connects to an already installed development build; `pnpm web` provides the optional browser preview without Android/iOS tools.

Also use `pnpm run doctor` for Expo compatibility checks, `pnpm export --platform all` to bundle Android/iOS and export static web pages, and `pnpm format` to apply formatting. Exporting bundles does not compile or install a native app.

### Native configuration and app identity

`app.json` defines the display name **Kinetix**, slug/scheme `kinetix` and provisional Android/iOS identifiers `com.example.kinetix`. Choose owned release identifiers before signing/distribution. Expo template icons and neutral starter styles are placeholders, not approved branding or design tokens.

Android/iOS directories are generated and ignored under Continuous Native Generation. Make reproducible native changes through app configuration/config plugins. After such a change, rebuild with the platform command. If regenerated native projects are necessary, use `pnpm exec expo prebuild --clean`; it replaces generated directories, so first preserve any manual native work. Never treat unrecorded native edits as durable application source. [CNG guide](https://docs.expo.dev/workflow/continuous-native-generation/)

### Connecting to the backend

`localhost` on a phone refers to the phone. For the standard Android Emulator, `10.0.2.2` reaches the development computer's loopback interface. A physical device generally needs the computer's reachable LAN address, with the backend listening on an appropriate interface and the firewall allowing that development connection. Confirm the team's API port rather than guessing it. [Android Emulator networking](https://developer.android.com/studio/run/emulator-networking)

Use HTTPS for deployed APIs. A local HTTP setup may need platform-specific configuration; do not weaken production transport settings. Browser previews additionally need the backend's explicit CORS configuration. Metro connectivity and API connectivity are separate: loading the UI does not prove the API is reachable. [React Native security](https://reactnative.dev/docs/security), [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)

`EXPO_PUBLIC_` configuration is visible in the compiled app. Use it only for public values such as the API URL. AI/provider keys and service credentials belong in the backend. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)

## Where to put code

`src/app/`, `src/features/home/` and `src/config/` are implemented. Add the other directories below only when consuming code needs them:

| Location                  | Contents                                                            |
| ------------------------- | ------------------------------------------------------------------- |
| `src/app/`                | Thin route files and navigation layouts; no general utilities/tests |
| `src/features/<feature>/` | Feature screens, components, hooks, schemas and API operations      |
| `src/components/`         | Reusable UI primitives shared by features                           |
| `src/providers/`          | Session, query and theme composition                                |
| `src/services/api/`       | Shared request client, errors and contract types                    |
| `src/services/storage/`   | Platform-specific storage adapters                                  |
| `src/theme/`              | Standalone runtime exports of agreed design tokens                  |
| `src/config/`             | Public configuration and validation                                 |
| `src/test/`               | Shared test setup and fixtures                                      |
| `assets/`                 | Fonts and images used by the running app                            |

A goal route, for example, delegates to `GoalScreen` in the goals feature. That screen uses a feature hook/API operation through the shared request client. Saving returns authoritative backend data, and affected cached queries are updated or invalidated. Keep request construction and domain calculations out of route files.

Use local React state for transient UI, TanStack Query for server data when integrated, and React Hook Form/Zod for substantial forms. These packages are part of the accepted approach but are not installed yet. Start with React Native primitives and StyleSheet; design tokens come from management. Keep platform differences behind adapters so optional web support remains practical.

## Your first contribution

1. Read the relevant GitHub issue/acceptance criteria and [AGENTS.md](AGENTS.md). Confirm the API contract and design; do not invent unresolved product behavior.
2. Make a small change in the appropriate feature. Component filenames use PascalCase; hooks/functions use camelCase; route filenames follow Expo Router notation.
3. Check loading, empty, success and failure states where relevant. Validate input, preserve it after failed saves, and use accessible labels/roles with keyboard and safe-area handling.
4. Run available type/lint/format checks and meaningful tests. Exercise the flow on the affected native platform; browser/Jest results do not establish native behavior.
5. Open a reviewable change linked to its repository-qualified issue. State what changed, checks actually run, device/platform evidence and remaining limitations. Include the lockfile when changing dependencies.

Install SDK/native packages with `pnpm exec expo install <package> --pnpm` to select compatible versions. Add libraries for a concrete feature; check native architecture/platform support, run Expo Doctor, and rebuild when native code changes. Do not independently upgrade React or React Native. [Dependency compatibility](https://docs.expo.dev/guides/new-architecture/)

## Common setup problems

| Symptom                                 | First checks                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `package.json` missing / script missing | Current terminal directory and actual files/scripts; run commands from this repository root                        |
| App cannot connect to Metro             | Development build installed, Metro running, reachable address/network and no conflicting server                    |
| UI loads but API requests fail          | API URL, backend availability, device-versus-computer localhost, network/firewall; browser CORS if applicable      |
| Native module missing                   | Compatible package version and fresh development build; JavaScript reload cannot add native code                   |
| Android build fails                     | Pinned Node, JDK/SDK configuration, required build tools and first actionable build error                          |
| iOS build unavailable                   | Local builds need macOS/Xcode; use the agreed alternate route rather than treating web preview as iOS verification |
| Old values after an environment change  | Fully reload the app; check intended local environment values without sharing secrets                              |

Use cache-clearing or dependency reinstallation only when the error justifies it. Preserve uncommitted work and diagnose the first failure before changing tool versions.

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every pull request and on pushes to `master`, using Node from `.node-version` and pnpm from `package.json`. It has two jobs:

- **Frontend checks:** checks out GitHub's merge commit on Ubuntu 24.04, restores the pnpm store, installs with `--frozen-lockfile`, then runs TypeScript, ESLint, Prettier, Jest with coverage, Expo Doctor and Android/iOS/web export. The job stops on failure and uploads the Jest LCOV report. Coverage appears in the test logs and has no percentage threshold yet.
- **SonarCloud:** uploads the analysis and coverage report to SonarCloud. This check is advisory: it reports the quality gate without failing the build because `sonar.qualitygate.wait` is not set.

The workflow uses commit-pinned actions, a read-only repository token and no persisted checkout credentials. A newer commit cancels the previous run for the same PR; each job has a timeout. No branch/path filters are used, so the required check can run for every PR.

Once the workflow has run on GitHub, configure branch protection/rulesets to require **Frontend checks** and a teammate's review. Creating this workflow does not configure repository protection. Read the failed step's logs, reproduce its command from this repository root and push the fix; keep CI commands aligned with local development scripts.

This workflow verifies code, tests and bundling. Native compilation/device testing, API integration and release signing/distribution require their own verification. On 4 October 2026, actionlint validated the workflow and all run commands passed in a clean temporary checkout with the pinned toolchain. Its first GitHub-hosted run is still pending.

### SonarCloud setup

CI-based analysis needs a SonarCloud project bound to the GitHub repository and a repository secret:

1. In the SonarCloud organization `kinetix-app`, import `kinetix-app/app`, then disable **Automatic Analysis** so CI-based analysis with coverage is used.
2. Confirm `sonar.projectKey` in [sonar-project.properties](sonar-project.properties) matches the imported project (`kinetix-frontend`) and the `-Dsonar.organization` value in the workflow matches (`kinetix-app`).
3. Create a personal access token and store it as the `SONAR_TOKEN` repository secret.

Pull requests from forks do not receive repository secrets, so the SonarCloud job is skipped for fork pull requests; the **Frontend checks** job still runs. The scanner needs full history, so the SonarCloud job checks out with `fetch-depth: 0` and downloads the coverage artifact produced by **Frontend checks**. Pull-request runs are analyzed in the pull-request context, and pushes to `master` update the project's main branch.

## Verification and known limits

Verified on 4 October 2026 with Node 24.21.0 and pnpm 11.23.0 on Linux:

| Check                                                                | Result                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| Clean `pnpm install --frozen-lockfile`                               | Passed with the committed build-script configuration |
| TypeScript, ESLint and Prettier                                      | Passed                                               |
| `pnpm test`                                                          | 11 configuration tests passed                        |
| `pnpm run doctor`                                                    | 21/21 Expo checks passed                             |
| `pnpm export --platform all`                                         | Android/iOS bundles and static web export passed     |
| `pnpm exec expo prebuild --clean --no-install`                       | Android/iOS project generation passed                |
| Exported home page in a browser                                      | Kinetix starter screen loaded                        |
| Native compile/device run, backend save/read, second developer setup | Not verified                                         |

These checks do not establish native compilation, device behavior or backend integration. A second developer must still follow this README on a clean clone and demonstrate the agreed API save/read flow for the sprint foundation commitment. The verification host lacks Android SDK/device tools and macOS/Xcode.

The dependency audit currently reports upstream advisories involving `braces`, `node-forge`, `decode-uri-component` and `uuid`, in the SDK dependency tree (including Router URL parsing and development/build tooling). Track compatible fixes and reassess before release; do not force an audit fix that changes the Expo SDK or bypass version compatibility. Run `pnpm audit` after dependency changes. Third-party template asset licensing is recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

pnpm requires an explicit decision for dependencies with install scripts. If installation reports an unreviewed build, inspect the dependency/script and update the repository's `allowBuilds` configuration as part of a reviewed change. Do not enable every dependency script to suppress the error.

## Learn just enough to start

Read [React quick start](https://react.dev/learn) for components, props, state, events and Hooks, then [React Native core components](https://reactnative.dev/docs/intro-react-native-components) for mobile equivalents. Follow with [Expo Router core concepts](https://docs.expo.dev/router/basics/core-concepts/) and the development-build guide linked above. Practice with a small local screen before camera or real-time work; keep exercises separate from claims of delivered features.

The full scope and research rationale live in management. Until verified cross-repository links are available, this README and `AGENTS.md` provide standalone frontend onboarding and coding guidance.
