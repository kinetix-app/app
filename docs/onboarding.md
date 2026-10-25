# Profile, objective and optional nutrition setup

Authenticated Basic and Clerk access reads `GET /api/v1/auth/me`. The backend returns `onboarding.profile_complete`, `objective_selected` and `required`; `GET /api/v1/me` remains compatible. Returning accounts with incomplete profiles or no objective enter setup again. Client routing never substitutes for backend ownership checks.

Complete the profile with name, age, weight, height in centimetres and an explicit kg/lb choice. No unit is silently selected. The optional picture accepts an HTTPS image URL or empty input; image upload is not included. Weight is stored as canonical kg with six decimal places; lb uses the exact 0.45359237 kg conversion. The four distinct objectives are Build muscle, Lose fat, Gain weight and Maintain weight. Profile and objective remain editable from Home.

Saving the profile and objective completes onboarding. Nutrition setup is optional and available from Home or Nutrition. Enter kcal/day and protein, carbohydrate and fat grams/day, with up to two decimal places. There are no preselected calorie amounts or macro percentages. Saved grams reopen exactly, including zero macros. Targets are manual user choices rather than calculated suggestions. Each explicit save records its objective context; later objective changes retain the amounts and show their prior association until reviewed and saved again.

A missing target shows an absent amount (`—`) and permits food logging and daily totals. Only the target API's 404 means absence; network/server failures remain retryable errors. Meals, body measurements, chosen targets and suggestions are separate data.

Physical targets, milestones and weekly-session targets are not implemented by this flow. Scientific suggestions are tracked in [the high-priority Sprint 2 follow-up](https://github.com/kinetix-app/app/issues/74), under [Kinetix-010](https://github.com/kinetix-app/app/issues/13). Formula choice and additional-input requirements await that decision; no extra sensitive fields are inferred.
