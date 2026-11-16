# Form check

**Status: partial.** The flow (consent, record, analyze, result, cannot-assess) is implemented on
all platforms. Real analysis runs **on the web build only**; Android and iOS still use the demo
analyzer until a native pose module exists.

## Pipeline

Everything runs on the device; the video never leaves it.

```
Record (expo-camera; MediaRecorder on the web)
  → Pose: MediaPipe pose landmarker, 33 landmarks per frame        pose/poseSource*.ts
  → Engine: clean → signals → reps → metrics → score → feedback    engine/
  → FormAnalysis (reps and the checks each failed, or reasons)     engineAnalysis.ts
  → existing result / cannot-assess screens                         components/
```

| Piece              | Where                       | Notes                                                                                                                                                                           |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Analyzer contract  | `analyzer.ts`               | Screens depend only on `FormAnalyzer`.                                                                                                                                          |
| On-device analyzer | `onDeviceAnalyzer.ts`       | Pose source + engine. `createDefaultAnalyzer` picks it when the platform has a pose source and `EXPO_PUBLIC_FORM_CHECK_ANALYZER` is `engine` (the default); otherwise the demo. |
| Pose, web          | `pose/poseSource.web.ts`    | `@mediapipe/tasks-vision` 1.2.0 and the `pose_landmarker_full` model, loaded from their CDNs on first use (Metro cannot bundle the library). Reads the recording at 15 fps.     |
| Pose, native       | `pose/poseSource.ts`        | Returns `null` for now.                                                                                                                                                         |
| Web recording      | `webRecorder.web.ts`        | expo-camera cannot record on the web; the preview stream is recorded with `MediaRecorder` (WebM).                                                                               |
| Engine             | `engine/`                   | TypeScript port of the Python reference (`model/kinetix_technique.py`, engine 0.2.0).                                                                                           |
| Specs              | `engine/specs/*.json`       | One per exercise: signals, rep detection, criteria, bands. Same content as `model/specs`.                                                                                       |
| Wording            | `profiles.ts`, `reasons.ts` | App copy per check; check ids are the spec's criterion ids. Disabled criteria have no copy and are never reported.                                                              |

## Supported exercises

All filmed side-on, working side toward the phone.

| Profile               | Spec                    | Catalogue names matched                                             |
| --------------------- | ----------------------- | ------------------------------------------------------------------- |
| Back squat            | `back_squat`            | Squat, Back squat, Barbell (back) squat                             |
| Push-up               | `push_up`               | Push-up                                                             |
| Hammer curl           | `hammer_curl`           | Hammer curl, Dumbbell (hammer) curl, Biceps curl                    |
| Seated shoulder press | `seated_shoulder_press` | Seated shoulder press, (Dumbbell) shoulder press, Military press    |
| One-arm dumbbell row  | `dumbbell_row`          | Dumbbell one arm bent-over row, One arm bent-over row, Dumbbell row |

Bands were calibrated on a public dataset of real gym videos; see the evaluation write-up in the
model repository (`docs/EVALUATION.md`). They separate good from bad sets only modestly and still
need review with a coach.

## Engine parity

`engine/test/parity.test.ts` runs the TypeScript engine on fixtures exported by the Python
reference (synthetic sets, unassessable cases and real gym videos) and requires the same reps,
metrics, scores, texts and reasons. To regenerate after changing the reference:

```bash
# in the model repository
python export_fixtures.py --out <app>/src/features/formcheck/engine/test/fixtures
```

Copy changed specs from `model/specs` into `engine/specs` in the same change; a test checks the
fixtures and the bundled specs agree.

## Verification

- Unit and parity tests: `pnpm test`.
- Web bundle: `npx expo export --platform web` builds.
- Web pipeline, run in headless Firefox 160 on public gym videos (Mendeley "Seven Fitness
  Exercises", CC BY 4.0) through `createOnDeviceAnalyzer` and the web pose source, 16 November 2026:

  | Video        | Result                        | Python reference    |
  | ------------ | ----------------------------- | ------------------- |
  | Squat, side  | 16 reps, score 97             | 16 reps, score 96   |
  | Curl, side   | 6 reps, score 96              | 6 reps, score 94–95 |
  | Squat, front | not assessable: `wrong_angle` | `not_side_view`     |

  Scores differ slightly because the web samples at 15 fps with MediaPipe's JavaScript build. On
  that machine (CPU fallback, CPU clocked at 600 MHz) a 32 s video took 3.5–8 minutes; expect
  far less with WebGL on a normal computer, but it has not been measured.

- **Not verified:** recording with a real webcam through `MediaRecorder`, and any native device.

## Next steps for Android and iOS

1. A local Expo module (`modules/pose`) wrapping MediaPipe Tasks (Kotlin and Swift) that reads a
   recorded video and returns landmarks; it needs development builds, not Expo Go.
2. `createPoseSource` on native returns it; nothing else changes.
3. Measure frame time on a mid-range Android phone before deciding live analysis
   (react-native-vision-camera frame processors) versus after-recording analysis.
