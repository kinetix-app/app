# Home and navigation

## Current state

After account verification, `HomeScreen` mounts the private query provider and training
session provider and presents the bottom navigation shell. The default Home tab opens
nutrition-goal setup; saving it moves to Nutrition. The `/nutrition` route uses the same
shell with Nutrition selected first.

The Workout tab opens routines, workout recording and history. The central `+` starts a
blank workout and is disabled while restoration or another session operation is pending,
when local session storage has failed, or when a draft already exists. Nutrition opens the
diary. Visited tabs stay mounted so their local form/scroll state survives tab switches.
Changing account or signing out clears the private feature state.

The tab bar also shows **Progress**, but the control is disabled and labeled as
unavailable. The Home screen is currently a goal-setup entry point, not a general fitness
dashboard.

## Code and evidence

- Routes: `src/app/index.tsx` and `src/app/nutrition/index.tsx`.
- Shell and tab controls: `src/features/home/components/HomeScreen.tsx` and
  `BottomBar.tsx`.
- `src/features/home/test/HomeScreen.test.tsx` covers shell behavior.
- `e2e/web/home.spec.ts` defines browser home-shell acceptance scenarios.
- [Authenticated home interaction notes](../home.md) document cross-feature mounting,
  state retention and acceptance boundaries.

## Remaining gaps

Progress, a general activity dashboard and additional social/community areas are not
implemented in this repository. Browser shell checks do not establish native navigation,
gesture or device behavior.
