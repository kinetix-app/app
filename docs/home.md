# Authenticated home and feature organization

After either development Basic sign-in or Clerk account connection, `HomeScreen`
owns the authenticated shell. The server-derived setup gate first requires a complete
profile and selected objective. The default Home tab shows a read-only profile/objective summary with shortcuts into Profile, Workout and Nutrition. Profile owns account editing and sign-out. Numerical nutrition targets are optional; the goal
editor offers Set up later and saving returns to its origin: Profile for a Profile entry, Nutrition for a diary or Home shortcut. The diary's Edit
nutrition goal action opens the editor in the Profile tab; closing it returns to Nutrition. See [onboarding](onboarding.md).

The shared bottom bar uses the former nutrition bar's design and now has accessible,
working controls. Workout opens routines, the shared routine/session editor and
completed history through a shortcut into Profile. History details return to history, then to Profile. The central + starts a blank workout through the existing session
controller; it is disabled during restoration, pending operations, storage failures
or an existing workout. Nutrition retains diary, meal/food/recipe and goal operations.
Profile replaces the previous disabled Progress tab. Its compact grouped rows open profile/picture editing, objective and nutrition-goal editing, training history and a prepared Progress screen. Progress shows the current saved profile weight and clearly marks weight history, measurement recording and strength trends as unavailable; it does not generate historical data.

One account-scoped QueryClient serves all features. The workout provider remains
mounted across tabs, so minimizing and switching tabs preserves the active workout.
The resume panel sits above the bottom bar. Visited tabs retain their forms and scroll
state; hidden tabs are excluded from accessibility. Account changes and logout unmount
all private state and cancel/clear private queries. Profile sign-out runs the session controller’s local cleanup before authentication logout; server drafts remain resumable. Hidden Profile panels do not consume Android back events. `/nutrition` uses the same sign-in
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

The main screens share `ScreenHeader` and `screenContentStyle`, using the Nutrition title typography, theme ink color, 16-unit side padding and 32-unit top padding.

Profile uses the shared tokens in both themes, compact grouped rows, concise copy and accessible touch targets. Home and Profile share the account/objective query cache; saved edits update both. The profile editor shows existing details in a compact single-page form with direct Save; the guided wizard is reserved for onboarding. Editors retain draft input across tab switches and failed saves. Required onboarding remains outside the tab shell.
