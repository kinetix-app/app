# Goals

## Current state

The mobile client implements **nutrition goals only**, through the nutrition feature's
daily calorie and macronutrient editor. It does not have physical-goal, body-measurement,
weight-progress or goal-completion screens or API helpers. The Home tab currently uses
nutrition-goal setup as its initial content; this is not a physical-goal dashboard.

## Code and evidence

- Nutrition goal UI/API is described in [Nutrition](nutrition.md) and implemented by
  `src/features/nutrition/components/NutritionGoalEditor.tsx` and
  `src/features/nutrition/api.ts`.
- The backend currently has model tables for physical goals and body measurements but no
  corresponding API; see the
  [backend goals status](https://github.com/kinetix-app/app-rest/blob/master/docs/features/goals.md).

## Remaining gaps

Physical-goal meaning, target units, progress calculation and completion semantics need
product decisions before a client flow can be implemented. A persisted nutrition goal
must not be presented as evidence that physical-goal tracking exists.
