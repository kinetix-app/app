import { z } from 'zod/v4';
import { bundledSpecs, type SpecId } from './engine/specs';
import profilesJson from './profiles.json';
import type { NotAssessableReason } from './reasons';

type Plural = { one: string; other: string };

/** One thing the analyzer can flag on a repetition. Wording lives here, not in the analyzer. */
export type FormCheck = {
  id: string;
  /** Short name, for example "Depth". */
  label: string;
  /** `{reps}` is replaced with the affected repetitions, for example "4 and 5". */
  title: Plural;
  explanation: string;
  /** Short word shown on an affected repetition. */
  repLabel: string;
  /** Advice for the next set. */
  tip: string;
  /** Said when the check passed on every rep; defaults to the spec's positive cue. */
  praise?: string;
};

export type FormCheckProfile = {
  id: string;
  /** The technique-engine spec that analyzes this exercise; check ids are its criterion ids. */
  specId: SpecId;
  name: string;
  /** Exercise names this profile applies to. Compared after normalising case and punctuation. */
  exerciseNames: string[];
  camera: { view: string; hint: string; checklist: string[] };
  checks: FormCheck[];
  /** Replaces the generic wording of a not-assessable reason for this exercise. */
  reasonOverrides?: Record<string, NotAssessableReason>;
};

const plural = z.object({ one: z.string(), other: z.string() });
const reason = z.object({ title: z.string(), explanation: z.string(), fixes: z.array(z.string()) });
const profileSchema = z.object({
  id: z.string(),
  specId: z.enum(Object.keys(bundledSpecs) as [SpecId, ...SpecId[]]),
  name: z.string(),
  exerciseNames: z.array(z.string()).min(1),
  camera: z.object({ view: z.string(), hint: z.string(), checklist: z.array(z.string()) }),
  checks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      title: plural,
      explanation: z.string(),
      repLabel: z.string(),
      tip: z.string(),
      praise: z.string().optional(),
    }),
  ),
  reasonOverrides: z.record(z.string(), reason).optional(),
});

/**
 * The app's copy per exercise lives in profiles.json (data, like the engine specs); it is
 * validated on load so a malformed entry fails fast instead of showing broken text.
 */
export const formCheckProfiles: FormCheckProfile[] = z.array(profileSchema).parse(profilesJson);

const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The profile for an exercise, or undefined when form check is not available for it. */
export function profileForExercise(
  exerciseName: string,
  profiles: FormCheckProfile[] = formCheckProfiles,
): FormCheckProfile | undefined {
  const name = normalize(exerciseName);
  return profiles.find((profile) => profile.exerciseNames.some((n) => normalize(n) === name));
}

export function profileById(
  id: string,
  profiles: FormCheckProfile[] = formCheckProfiles,
): FormCheckProfile | undefined {
  return profiles.find((profile) => profile.id === id);
}
