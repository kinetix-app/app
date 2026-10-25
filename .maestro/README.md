# Native workout acceptance

`workout.yaml` is a real native smoke flow for an isolated run-owned Android emulator or iOS simulator. It is not execution evidence until Maestro completes it on an installed development build. Configure that build against the same dedicated `_test` API described in `e2e/web/README.md`, seed the synthetic catalogue and supply private `MAESTRO_KINETIX_E2E_EMAIL` / `MAESTRO_KINETIX_E2E_PASSWORD` environment variables.

Do not run against an existing personal installation or clear its data. Use a clean, run-owned emulator/simulator and keep Maestro output private: native test artifacts may include sign-in screen content. Supply credentials through environment variables, never command-line literal values or committed YAML. Do not upload raw artifacts.

```sh
MAESTRO_KINETIX_E2E_EMAIL="$KINETIX_E2E_EMAIL" MAESTRO_KINETIX_E2E_PASSWORD="$KINETIX_E2E_PASSWORD" maestro test .maestro/workout.yaml
```

The native flow checks sign-in, blank start, lb/repetition keyboard input, minimize/resume, Finish and history navigation. Independent API assertions and failure/retry/account-isolation evidence live in the browser suite. A browser run, bundle export or native flow file alone does not prove Android/iOS acceptance.

Maestro CLI imports shell variables with the `MAESTRO_` prefix; see [Maestro parameters and constants](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants).
