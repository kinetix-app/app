# Nutrition

## Current state

The app has a working nutrition diary and goal editor backed by authenticated nutrition
API calls. The diary selects a day from the current seven-day strip, shows calorie and
macro totals against the account's nutrition goal, lists meal items by meal, supports
deleting logged items, and opens food or recipe entry. The date key is a device-local
calendar date sent to the API as a date-only value.

Food entry can search/list the signed-in user's foods, create a food, select a gram
quantity and log it to breakfast/lunch/dinner/snack. Recipe entry can create recipes from
owned food ingredients, browse recipes, log servings and delete unused recipes or foods.
The goal editor creates or updates calorie, protein, carbohydrate and fat targets; its
macro split is normalized to 100% and uses 4 kcal/g for protein/carbohydrate and 9 kcal/g
for fat, rounding submitted values to two decimal places.

## API contract used by the app

`src/features/nutrition/api.ts` calls:

- `/api/v1/nutrition-goals/me`, `/api/v1/nutrition-goals`, and
  `PATCH /api/v1/nutrition-goals/me` for nutrition goals.
- `/api/v1/foods` for private food search/list/create/delete.
- `/api/v1/recipes` for recipe list/create/delete.
- `/api/v1/nutrition/meal-items` and `/api/v1/nutrition/recipe-items` to log entries,
  `/api/v1/nutrition/meal-items/{id}` to delete a diary entry, and
  `/api/v1/nutrition/days/{date}` to load totals and entries.

Responses and inputs are validated with Zod. Query keys include the account for private
goal/day data; food and recipe results are served through the account-scoped private
query client. The backend remains authoritative for ownership and persistence. See the
[backend nutrition status](https://github.com/kinetix-app/app-rest/blob/master/docs/features/nutrition.md).

## Code and evidence

- Screens: `src/features/nutrition/components/NutritionDiaryScreen.tsx`,
  `AddFoodScreen.tsx`, and `NutritionGoalEditor.tsx`.
- API/schema: `src/features/nutrition/api.ts` and `schemas.ts`.
- API-boundary tests: `src/features/nutrition/test/api.test.ts`.
- There are currently no nutrition screen-specific component tests in this feature.

## Remaining gaps

The app has no user-facing food edit flow or food database beyond the signed-in user's
own records. Diary dates use the device's local calendar rather than the profile timezone.
No physical-goal tracking is included. Existing source/API unit tests do not establish
native device or production end-to-end acceptance; record those separately.
