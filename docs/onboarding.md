# Profile, objective and optional nutrition setup

Authenticated Basic and Clerk access reads `GET /api/v1/auth/me`. The backend returns `onboarding.profile_complete`, `objective_selected` and `required`; `GET /api/v1/me` remains compatible. Returning accounts with incomplete profiles or no objective enter setup again. Client routing never substitutes for backend ownership checks.

Complete the guided steps for name and optional photo, age, measurements, then review. Back preserves your entries; each step validates its own inputs. Profile pictures are selected from your image library and uploaded as multipart files to private Azure Blob Storage. No pasted image URL is required. The profile includes weight, height in centimetres and an explicit kg/lb choice. No unit is silently selected. Weight is stored as canonical kg with six decimal places; lb uses the exact 0.45359237 kg conversion. The four distinct objectives are Build muscle, Lose fat, Gain weight and Maintain weight. Profile and objective remain editable from Home.

Saving the profile and objective completes onboarding. Nutrition setup is optional and available from Home or Nutrition. Enter kcal/day and protein, carbohydrate and fat grams/day, with up to two decimal places. There are no preselected calorie amounts or macro percentages. Saved grams reopen exactly, including zero macros. Targets are manual user choices rather than calculated suggestions. Each explicit save records its objective context; later objective changes retain the amounts and show their prior association until reviewed and saved again.

A missing target shows an absent amount (`—`) and permits food logging and daily totals. Only the target API's 404 means absence; network/server failures remain retryable errors. Meals, body measurements, chosen targets and suggestions are separate data.

Physical targets, milestones and weekly-session targets are not implemented by this flow. Scientific suggestions are tracked in [the high-priority Sprint 2 follow-up](https://github.com/kinetix-app/app/issues/74), under [Kinetix-010](https://github.com/kinetix-app/app/issues/13). Formula choice and additional-input requirements await that decision; no extra sensitive fields are inferred.

## Profile photo storage and device setup

Profile photos are optional. JPEG, PNG and WebP uploads are limited to 5 MiB; the backend validates actual image contents and strips metadata while normalizing the stored image to JPEG. Upload failure preserves the previous saved photo and offers retry; removing a photo does not clear the other profile fields.

The app sends multipart field `file` to `POST /api/v1/me/profile/picture` using its shared authenticated client. `GET` at the same path reads the signed-in account's private image; `DELETE` removes it. The app fetches the protected image with its authorization header and uses an in-memory preview, rather than putting session credentials in image URLs. Existing HTTPS image references remain compatible.

Install locked dependencies and rebuild native development clients after adding `expo-image-picker`. The picker uses the image library; camera capture is outside this increment. Browser verification does not establish native picker permissions or gallery behavior.
