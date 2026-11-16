# Frontend UI conventions

These rules apply when creating, editing or reviewing screens and components. Read
[src/theme/design-tokens.json](../src/theme/design-tokens.json), including its token usage
notes, and [src/theme/tokens.ts](../src/theme/tokens.ts) before design work. For training
flows, also read [docs/routines.md](routines.md). Keep these instructions updated
when the user approves a new convention; direct user instructions take precedence.

## Design source and tokens

- Management owns the design references and authoritative design system. Follow the supplied screen references for layout, hierarchy and interaction, with the user-approved refinements below. Keep the consumed token export in this repository; building the app must not require another checkout or a network font import.
- Use `usePalette`, `spacing`, `radii`, `sizes` and `textStyles` from `src/theme/tokens.ts`. Reuse shared UI primitives. Prefer existing semantic tokens over literal colors, arbitrary spacing, radii or typography. Introduce a new token only for a demonstrated design need and document its intended use.
- Use the dark theme. Use `surface-100` for screens, `surface-200` for cards/sheets and `surface-300` for fields and neutral chips. Use `ink` for primary text, `ink-muted` for supporting text and `line-strong` for control boundaries. Decorative `line` dividers must not be the sole control boundary.
- Pair `brand` backgrounds with `on-brand`, and `brand-soft` backgrounds with `brand-ink`. Use `danger`, `success`, `warning` and `info` for their semantic states, with text or icons rather than color alone. Nutrition macro colors require written labels.
- Use token typography for screen/section/card headings, body copy, labels and captions. Captions must not carry essential information. Limit hero headings/metrics to their intended hierarchy; use tabular numerals for comparable metrics. The design specifies Bricolage Grotesque/Figtree, but platform fallback remains intentional until font binaries are supplied and bundled.
- Follow the token spacing scale (4, 8, 12, 16, 20, 24, 32, 40, 48), radius scale (8, 12, 20, 28 and pill), minimum 44-unit touch targets and 52-unit regular controls. Respect safe areas, text scaling and keyboard visibility. Use theme-specific shadows: dark cards separate through surfaces, while dialogs/popovers use the pop elevation treatment.

## Actions, dialogs and feedback

- Use an accessible arrow icon button for back navigation, including routine, set editor and exercise details. Do not replace it with a full-width text Back button.
- Keep visible action names short and simple: Add, Remove, Save, Cancel, Discard, Back, Done. Give icon-only or repeated actions explicit accessible labels identifying their target.
- Add actions use the positive treatment (`brand-soft` / `brand-ink`). Removing an exercise and discarding a draft use danger styling. **Removing an individual set is neutral**: use the same `ink` and `surface-300` colors as the kg/reps fields, without a danger outline. Save retains the primary treatment; ordinary navigation/cancel actions are neutral.
- Confirm discarding unsaved routine edits in a centered modal with a `scrim` backdrop. Keep editing and Discard are explicit choices. The confirmation must float above the screen, never render as inline content at the bottom. Hide underlying content from accessibility while the confirmation is active and support platform back/dismiss behavior.
- Provide visible loading, empty, error and disabled/pending states. Keep entered form values after a failed save, show validation beside its field and prevent duplicate submissions.
- Preserve accessible names/roles, selected/disabled state and keyboard interaction. Focus indicators use the focus token with a 2-unit ring and 2-unit offset where supported; control/focus boundaries should meet the design's 3:1 contrast requirement. Do not rely on color alone for errors, selection or completion.

## Exercise catalogue and routine editing

- Exercise catalogue screens use one bounded vertical list, with search and active filter badges in its scrollable header. A Filters button opens a centered, scrollable checkbox modal for multiple body parts. Save applies the draft selection; Cancel leaves current filters unchanged. Active badges wrap and tapping their close action removes that part immediately. Changing search/filter resets the list to the top. Keep taps usable while the keyboard is open.
- Fetch the next exercise page automatically near the bottom, without a More button. Guard concurrent fetches, stop after a short page and retain existing results on page-fetch failure with an explicit Retry action.
- Filter exercises with **body-part** multi-selection (match any selected part), showing All body parts when empty; do not substitute granular target-muscle filters. Load available body parts from the authenticated catalogue options endpoint independently of the current page/search. Combine the selected body part with debounced name search and reset pagination when either changes.
- Routine and workout editing use expandable exercise cards. The image stays on the left; a compact exercise name and set summary sit beside it, with the exercise overflow menu in the upper-right corner. Tapping the name expands/collapses set rows inside the card; collapse retains draft values. The set editor and exercise information contain no muscle/body-part text. Images open full exercise information on demand; catalogue titles may also open that information.
- Exercise information uses **muted, looping autoplay video** with app-colored play/pause, replay, mute, progress and fullscreen controls. Start autoplay only once ready; later buffering must not override a user’s pause. Show the image only when video is absent or unavailable. Keep media bounded and release playback resources when closing. Listing/overview thumbnails remain images.
- Reorder exercises by mouse drag or touch hold/drag across their cards, names or images, with accessible/keyboard alternatives. The moving card must stay **above every neighboring card in both directions**, including when dragging down. Raise the actual list cell's stacking layer on web, not only its inner card; preserve native elevation/stacking behavior. Release/cancel must clear the active layer and restore controls.
- Reordering preserves stable exercise-slot IDs and unsaved set values. Keep kg/reps units explicit. Edit planned/default sets separately from completed workout results; keep routine templates separate from session start/history.

## Design verification

- Inspect the affected screen and interaction in the available runtime, including the dark theme and relevant keyboard/modal/drag/media states where feasible. For drag changes check both upward and downward movement; for details check video preference and image fallback.
- Run checks appropriate to the change and report what was actually verified. Mocked tests and platform exports do not establish native device behavior. Rebuild development clients after native module changes and state any unavailable device checks.
- These are required implementation conventions, not a claim that every existing screen already conforms. Keep changes scoped to the requested work and report material inconsistencies instead of silently copying them into new screens.

## Ongoing workout refinements

- Keep weight units explicit in fields, using kg until a user preference is implemented. Do not show per-screen kg/lb selectors.
- Set ticks toggle confirmed/draft state through the API. Only acknowledge a toggle after the server accepts it; failure retains the previous state and entered values. Returning a set to draft retains its weight/repetitions as draft values.
- The workout header shows elapsed time and an icon to minimize, without a Started at label. Pulling the top grip down also minimizes; ordinary list scrolling remains usable. Native overscroll from the top may minimize as well.
- Minimized workouts use a compact floating panel above the bottom safe area. Its text opens a centered discard confirmation; a separate play icon resumes. Cancel preserves the workout. All icon controls retain accessible names and minimum touch sizes.

- While a workout exists, disable new Start actions in the list/editor; the floating play icon is the resume control.
- Finish allows unticked/partial sets and leaves them out of completed results. For routine-origin workouts, show Keep routine / Update routine / Cancel before finishing; only saved results update the plan. Retain that choice through retries.
- New workout exercises fetch account-scoped last configuration. Show prior kg/reps as placeholders until the user enters values or presses the tick. Ticking fills empty fields from their displayed numeric placeholders and saves them; preserve explicit input and validate fields without guidance. Lookup failure must be recoverable without appending duplicate exercise rows.

- Expanded exercise cards collapse through their name; omit redundant Done buttons. In a live workout, successfully confirming the final outstanding set expands the next unfinished exercise, skipping completed cards and wrapping around the list. Failures and unticks keep the current card open; when no unfinished sets remain, collapse it.
- Use the translucent black surface-overlay token for the floating ongoing-workout panel, with a primary brand border, overlay-ink text/timer, and a brand/on-brand resume action. Nutrition-goal setup has no back arrow; the Home bottom bar owns navigation.

- Main Home, Workout and Nutrition headings share `ScreenHeader`, display-lg type, theme ink color, and the Nutrition screen's 16-unit side and 32-unit top padding.

## Session creation refinements

- Ongoing sessions group name/timer at the top left and Finish at the top right.
  Keep pull-to-minimize without a separate minimize button. Keep ordinary guidance
  only for the empty state; retain actionable error/retry feedback.
- Session cards reorder by mouse drag or touch hold/drag across the card, name or image. Keep inputs
  and action controls independent. Expose keyboard and accessibility reorder actions.
  Use a three-dot exercise menu for removal and Set/kg/Reps column headers. Set
  numbers open a neutral removal menu; placeholders provide previous/planned guidance.
- Shared catalogue pickers use Add exercise as a compact title, an accessible close
  icon, an inline search-clear action and adjacent filter icon. Use larger thumbnails,
  compact body-part text in sentence case and plus/check selection buttons. Keep
  selection across queries and confirm the ordered batch with a floating counted
  action. Retain failed selections and prevent duplicate addition while submitting.

## Unified routine and session exercise editor

- Use the same exercise card, summary and set-row components in routine creation,
  routine editing and ongoing sessions. Keep the set count primary-colored and
  show live reps/kg ranges beneath it. Session confirmation progress remains explicit.
- Both flows use the session design: exercise overflow/removal, whole-card dragging,
  Set/kg/Reps headers, neutral removal from the set-number menu and the shared Add
  set button. Only sessions expose confirmation ticks; routine Save owns planned sets.
