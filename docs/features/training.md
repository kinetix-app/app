# Training

## Current state

Training includes authenticated exercise catalogue browsing and detail/media, routine
creation/editing, live workout recording, resumable server drafts and completed history.
Routines hold planned default sets. A workout is a separate activity; its confirmed
weight/repetition values are saved to the server draft as they are ticked and only
confirmed sets are included on finish. The user can keep a source routine unchanged or
replace its exercise order/defaults from the workout at completion.

The catalogue supports name search, multiple body-part filtering, paging and exercise
media. Routine editing supports exercise selection/order and planned sets. Workout start
can use a routine or be blank, only one server draft is active per account, and previous
completed exercise configuration is shown as guidance/placeholders. History loads private
completed sessions. Detailed API, state, retry and unit behavior is in
[routines](../routines.md) and [workouts](../workouts.md).

## Code and evidence

- Feature API/schemas/state: `src/features/training/api.ts`, `schemas.ts`,
  `sessionDraft.ts`, and `sessionStorage.ts`.
- Screens/components: `src/features/training/components/`.
- Focused tests and fixtures: `src/features/training/test/`.
- Real-API browser scenarios: `e2e/web/`; these do not establish native behavior.
- The backend owns catalogue/routine/session persistence and draft completion; see the
  [backend training status](https://github.com/kinetix-app/app-rest/blob/master/docs/features/training.md).

## Remaining gaps

Camera capture/form analysis is a disabled placeholder. Sprint 2 time-, distance- and
combined-measurement formats are not implemented. Native device behavior for gestures,
media playback, storage recovery and real Clerk sessions requires separate verification;
browser/API checks do not prove it.
