# Mobile feature status

Reviewed against the app source on 25 October 2026. These pages describe what this
repository currently implements; issue status, design intent and API schema alone do not
prove delivery. Update the relevant page when feature behavior changes.

| Feature                             | Current state                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Authentication](authentication.md) | Development Basic and Clerk sign-in/session flows are implemented; release-provider and native acceptance still need verification.                          |
| [Accounts](accounts.md)             | Users view and edit their profile, picture and objective after sign-in.                                                                                     |
| [Home](home.md)                     | The authenticated shell connects Feed, Workout, Nutrition, League and Profile. Progress opens from Profile.                                                 |
| [Goals](goals.md)                   | Profile Progress records body measurements, charts history and manages a weight target for the selected objective. Nutrition targets have their own editor. |
| [Nutrition](nutrition.md)           | Diary, food/recipe entry and nutrition-goal screens consume backend APIs.                                                                                   |
| [Training](training.md)             | Routine, exercise catalogue, workout drafts and completed-history flows are implemented.                                                                    |

Detailed interaction contracts live in [home](../home.md), [routines](../routines.md),
[workouts](../workouts.md), and [Clerk setup](../clerk-setup.md). The backend owns
authorization, persistence and authoritative calculations; its implementation status is
documented in the [backend feature index](https://github.com/kinetix-app/app-rest/blob/master/docs/features/README.md).

## Status terminology

- **Implemented** means code in this repository wires the described user flow and API
  operation. It does not imply every target platform or provider has been accepted.
- **Partial** means only the listed slice exists; the page names the missing behavior.
- **Not implemented** means no usable client flow/API consumer exists here, even if a
  backend table, design, placeholder or disabled control exists.

Browser, mocked and unit checks are evidence for their own layer only. Native device,
production identity-provider and live backend behavior must be recorded separately when
verified.
