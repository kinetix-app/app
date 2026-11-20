# Nutrition

## Current state

The app has a working nutrition diary and goal editor backed by authenticated nutrition
API calls. The diary selects a day from the current seven-day strip, shows calorie and
macro totals against the account's nutrition goal, lists meal items by meal, supports
editing quantities or deleting logged items, and opens food or recipe entry. The date key is a device-local
calendar date sent to the API as a date-only value.

Food entry searches shared and personal foods in pages of 20. Users can create a food,
select a weight in grams and log it to breakfast, lunch, dinner or snacks. Recipe entry
supports creating and browsing recipes, logging servings, and deleting personal catalogue
items. The recipe form searches the same paginated food catalogue and shows a live per-serving
nutrition summary during creation and editing. Food and recipes share one review for the selected
meal and date. If an entry fails to save, the review keeps it available for retry.
The goal editor creates or updates calorie, protein, carbohydrate and fat targets; its
macro split is normalized to 100% and uses 4 kcal/g for protein/carbohydrate and 9 kcal/g
for fat, rounding submitted values to two decimal places.

## API contract used by the app

`src/features/nutrition/api.ts` calls:

- `/api/v1/nutrition-goals/me`, `/api/v1/nutrition-goals`, and
  `PATCH /api/v1/nutrition-goals/me` for nutrition goals.
- `/api/v1/foods` for food search/list/create/delete.
  `GET /api/v1/foods/{id}` provides nutrition data for existing recipe ingredients.
- `/api/v1/recipes` for recipe search/list/create/delete.
- Both catalogue endpoints accept an optional `name` filter, `offset` and `limit`.
  The pickers request 21 rows at a time, display 20 and fetch the next page when
  users scroll near the end. The extra result indicates whether another page exists.
- `/api/v1/nutrition/meal-items` and `/api/v1/nutrition/recipe-items` to log entries,
  `/api/v1/nutrition/meal-items/{id}` to update or delete a diary entry, and
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
- Component tests cover paginated food selection, recipe creation and diary entry editing.

## Remaining gaps

Diary dates use the device's local calendar rather than the profile timezone.
No physical-goal tracking is included. Existing source/API unit tests do not establish
native device or production end-to-end acceptance; record those separately.
