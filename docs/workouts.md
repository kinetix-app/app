# Workout drafts and completed history

Saved routines offer Edit and Start actions. The routine template and workout use the
same exercise cards, inline expanded set editor and numbered weight/repetition fields. Tap an
exercise name to expand or collapse its sets; there is no separate Done action; tap its image to read exercise information. Routine
changes still save as planned defaults, independently of workout results.

Start workout creates a blank workout; Start routine snapshots ordered slots and
previous/planned guidance. Actual results begin empty. Start actions are disabled while a workout exists; use the floating play icon to resume it. Each account has at most one active server draft.

## Saving and resuming

Start immediately PUTs an authenticated draft to
`/api/v1/session-drafts/{client_session_id}`. Each set's tick saves its actual weight,
unit and repetitions, together with the current exercise/set layout. Empty fields adopt their displayed numeric placeholders when the tick is pressed; entered values are retained. Fields without numeric guidance still require input. The tick turns
filled only after a successful server response. Tapping a filled tick returns the set to draft, persisting its weight/repetitions as unconfirmed values. A failed untick retains the filled tick. Editing a saved value clears its tick;
a failed save keeps the entered values and allows an explicit retry. Sync workout
persists layout changes and already confirmed results; it does not confirm unsaved values.
Unsent field edits remain local until their own tick is pressed; an explicit untick retains the previously sent values as a server draft.

The account-specific AsyncStorage draft retains unsent changes across relaunches on the
same device. Sign-in also GETs `/api/v1/session-drafts` so saved results can resume from
another device. On the same device, unsent local values are retained when the server
UUID matches. Server restoration must succeed before a new session can start. Concurrent
starts on different devices cannot create two active drafts; simultaneous editing of one
existing draft uses the latest saved snapshot, with no merge/conflict-resolution UI.

The header chevron or a downward pull on the top grip minimizes the workout. A compact floating panel stays above the bottom safe area while routines/history remain usable. Its play icon resumes; its text opens the discard confirmation. The header omits the Started at label. The timer derives from the original start instant, including background
and minimized time; completion retries retain the original finish instant. Explicit sign-out
clears device storage while the server draft remains resumable. Discard asks for confirmation
and DELETEs the owned server draft before removing local state. Failed discard retains it.
Storage/network failures are visible and entered values are retained. AsyncStorage is ordinary
device storage; credentials are never stored in workout drafts.

## Units and completion

Weights retain their entered decimal text and source unit. Fields display kg for now, without unit selectors; a future account preference will choose the display unit. Old pound entries convert for presentation without losing original precision. Editing a converted field creates a kg value.
Backend normalization uses canonical kilograms. Template saves retain untouched six-decimal
canonical weights, including weights originally entered in pounds.

Finish keeps the current exercise order and only explicitly ticked sets. Partially entered,
blank and unticked sets are omitted from completed history and the finalized server snapshot.
Exercises with no recorded sets remain as empty exercise entries; a plain workout may also
finish empty. Placeholder guidance becomes an actual result only when explicitly confirmed with its tick.

A workout started from a routine retains only that routine's session-level origin ID.
Performed exercises have no template-slot IDs or foreign keys, so replacing routine slots
during a workout cannot invalidate its results. At Finish, choose **Keep routine** to leave
the plan unchanged or **Update routine** to replace its exercise order and default sets
with the workout's saved results, retaining its name. Cancel returns to the workout.
An empty exercise list cannot replace a routine. Completion and an accepted routine update
commit in one backend transaction.

Finish synchronizes only saved results, freezes its finish instant and routine-update choice
locally, then POSTs `/api/v1/session-drafts/{uuid}/finish` with `ended_at` and `update_routine`.
Retried requests retain both values, return the same workout and never apply the routine
update again. Failed delivery keeps the locked local snapshot and exposes Retry Finish.

Adding an exercise fetches authenticated `/api/v1/exercises/{id}/last-configuration`.
The account's latest completed occurrence with saved sets supplies the set count and kg/reps
placeholders; empty occurrences are skipped. Actual fields remain empty and require explicit
entry or a tick to accept the displayed suggestions. No history creates one blank set. Failed reads preserve the existing workout and
allow Retry adding exercise. Routine-start guidance uses the same history lookup, with
planned defaults as fallback. Catalogue exercise references and session-level origin remain;
there is no relationship between performed exercise rows and routine exercise slots.

History uses authenticated paginated `/api/v1/sessions` and `/api/v1/sessions/{id}`. Existing
atomic POST `/api/v1/sessions` remains compatible for clients without active drafts.
The API state `completed` represents a finished workout.

Record set appears beneath the next pending set with a camera icon and a disabled coming-soon
accessible label. Recording, camera access and form analysis are not implemented. Reps/time,
distance/time and combined formats remain deferred to Sprint 2.

## Verification scope

Focused tests exercise server start/tick requests, failed-save input retention, safe finish
retries, server restore, private storage and routine-editor reuse. Live browser evidence
and native-device gaps are reported with delivery; mocked tests do not establish native
execution, production Clerk providers or concurrent multi-device editing.

After the final outstanding set saves successfully, the next unfinished exercise expands automatically, skipping completed exercises and wrapping to earlier cards when needed.
A failed save or an untick keeps the current exercise open. When no unfinished sets remain, the exercise collapses. The floating ongoing-workout panel uses primary brand colors for visibility.
