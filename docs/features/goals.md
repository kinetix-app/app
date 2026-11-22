# Goals and body measurements

Open **Profile → Progress** to record weight, height, body-fat percentage, muscle mass,
or waist, chest, arm and thigh circumference. Users can record any subset on a given
date. The calendar defaults to today in the saved profile timezone, with UTC as the
fallback. The log fills in the latest saved value for each measurement. Clear any field
to leave it out of the new check-in. Successful saves show a toast. Failed saves retain
the draft and reuse the same submission ID for a retry.

The trends card uses the same chart as exercise evolution. Select a metric to show its
observations. An empty chart shows guidance for the selected metric inside the grid, and a
recorded check-in appears in the dated history. If a metric has several observations on the same day, the chart shows
the last one and the history keeps each entry. The screen, forms and chart use Kinetix's dark palette.

The chart, history, target, and measurement entry use the saved profile unit
preference. Metric uses cm and kg. Imperial uses feet and inches for height, inches
for other lengths, and pounds for mass. Percentages stay
the same. The API uses canonical decimals. Logging the latest height or weight refreshes
the related profile field. Direct edits to those values in Profile appear in the day's history.

The **Weight target** card shows the current objective and its manually chosen weight
target. Users can set or edit the target and optionally choose a date from the calendar. Each objective
has its own target, so returning to a previous objective restores its saved target.
Expected progress and automatic completion are outside this workflow.
[Nutrition targets](nutrition.md) remain available in the Nutrition goal editor.

The account feature uses the private body-measurements and physical-target API endpoints.
Backend documentation covers persistence and synchronization rules.
[Backend goals](https://github.com/kinetix-app/app-rest/blob/master/docs/features/goals.md)
