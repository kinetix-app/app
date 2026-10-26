# Authenticated home and feature organization

After either development Basic sign-in or Clerk account connection, `HomeScreen`
owns the authenticated shell. The server-derived setup gate first requires a complete
profile and selected objective. The default Home tab then shows profile and objective
information with editing actions. Numerical nutrition targets are optional; the goal
editor offers Set up later and saving opens the Nutrition diary. The diary's Edit
nutrition goal action opens the editor within Home. See [onboarding](onboarding.md).

The shared bottom bar uses the former nutrition bar's design and now has accessible,
working controls. Workout opens routines, the shared routine/session editor and
completed history. The central + starts a blank workout through the existing session
controller; it is disabled during restoration, pending operations, storage failures
or an existing workout. Nutrition retains diary, meal/food/recipe and goal operations.
Progress remains disabled because that feature is not implemented.

One account-scoped QueryClient serves all features. The workout provider remains
mounted across tabs, so minimizing and switching tabs preserves the active workout.
The resume panel sits above the bottom bar. Visited tabs retain their forms and scroll
state; hidden tabs are excluded from accessibility. Account changes and logout unmount
all private state and cancel/clear private queries. `/nutrition` uses the same sign-in
and shell, initially selecting Nutrition; it does not render an unauthenticated diary.

Feature screens, UI components, platform variants and local styles belong in
`src/features/<feature>/components/`. Tests, fixtures and mocks belong in the feature's
`test/` folder. API operations, schemas and non-UI domain/storage helpers stay at the
feature root. Feature `index.ts` files expose the components/controllers consumed by
the Home shell. Shared account-cache lifecycle belongs in `src/providers/`.

Browser acceptance uses `e2e/web/home.spec.ts` with the existing Playwright runner and
private Basic test credentials, against an isolated test database. Native acceptance
requires Maestro and a run-owned development build/device. Browser results alone do
not establish native gesture, keyboard or provider behavior.

The three main screens share `ScreenHeader` and `screenContentStyle`, using the Nutrition title typography, theme ink color, 16-unit side padding and 32-unit top padding.
