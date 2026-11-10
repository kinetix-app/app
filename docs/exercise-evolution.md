# Exercise evolution

[Frontend issue #20](https://github.com/kinetix-app/app/issues/20)

The Evolution tab displays daily observations from the protected exercise evolution endpoint. It requests the authenticated profile's measurement system (metric by default) and keeps the account, exercise and units in the query key. The endpoint returns all dates; the client filters inclusive rolling UTC calendar-month periods, clamping the start day to the destination month and excluding future observations. Selecting a point updates the headline; selecting it again, changing the period or changing the metric clears the selection. The observation list provides an accessible alternative to the chart.

The backend calculates the maximum Epley estimate from eligible 1–10 rep sets, maximum recorded weight and repetitions, and eligible recorded-load volume. Cardio distance and time are independent maximum individual sets. The displayed estimate is not a test of maximum effort, and recorded load for assisted or bodyweight exercise may not represent total load. Partial volume is marked when sets were excluded. Decimal conversion and half-up rounding happen on the server; source records are unchanged. See the in-app explanations for each metric.

The chart and sheet use React Native primitives without a new native dependency. Native device behavior, including screen reader and reduced-motion behavior, still requires device acceptance.

For example, 60 kg × 5 estimates 70.0 kg and 40 kg × 10 estimates 53.3 kg. A 12-rep set can contribute to weight, reps and volume but not estimated strength.
