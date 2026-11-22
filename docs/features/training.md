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

## Completed workout details

| Where to open                          | Action                                                                |
| -------------------------------------- | --------------------------------------------------------------------- |
| Profile → Training history             | Tap a completed workout card.                                         |
| Workout saved                          | Tap **View workout** after finishing a session.                       |
| Feed → New post                        | Select a workout and tap **View workout**. Back returns to the draft. |
| Exercise details → History             | Tap **View workout** on an entry to see the full session.             |
| League → Rankings → Your score history | Tap **View workout** on a credited workout.                           |
| Feed post                              | Tap the workout on a post you can see.                                |

Training history opens on a paginated list of completed sessions grouped by local
completion month. History and Feed use the same summary card for workout duration,
lifting volume and exercise count.
Training History and Feed cards open the same **Workout detail** component.
History opens the detail above the list, so Back returns to the same place.
The card and detail use the workout's saved title. The API captures the routine
name at completion or uses **Training session** for a standalone workout.
Workout detail leads with the title and the athlete's avatar and name. The
completion date and time appear below the name. Duration, volume and exercise
count appear above sets and reps in the session card, with dividers between metrics.
Each exercise has its own card with an image beside the set table. The table uses
dividers between sets. Strength rows align weight and reps. Cardio rows align
distance and time. Missing values appear as a dash.
The only **Share to feed** action is inside Workout detail, reached from Training
History or Workout saved. The post composer retains its optional caption and
description when returning from a workout's detail. Feed shows the post text
separately from its workout attachment.

The private detail uses the owner’s session endpoint. Feed uses the post endpoint
and includes its server-provided lifting volume and repetitions. The browser scenario in
[`workout-detail.spec.ts`](../../e2e/web/workout-detail.spec.ts) exercises these
entry points and checks access from a second account.

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
