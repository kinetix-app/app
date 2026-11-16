import { z } from 'zod/v4';

/**
 * Exercise spec: what to measure for one exercise, the ideal bands and the coaching text. Specs are
 * data, shared with the Python reference (model/specs/*.json); the engine code is the same for all.
 */

export type Locale = 'es' | 'en';
const text = z.object({ es: z.string(), en: z.string() });

export const JOINTS = [
  'ear',
  'shoulder',
  'elbow',
  'wrist',
  'hip',
  'knee',
  'ankle',
  'heel',
  'foot_index',
] as const;
export type Joint = (typeof JOINTS)[number];
const joint = z.enum(JOINTS);

const signalSchema = z.object({
  type: z.enum([
    'angle',
    'inclination',
    'relative_height',
    'height',
    'forward_offset',
    'line_offset',
  ]),
  points: z.array(joint).optional(),
  point: joint.optional(),
  scale: z.tuple([joint, joint]).optional(),
  baseline: z.literal('rest').optional(),
});

const phase = z.enum([
  'rep',
  'out',
  'out_first_half',
  'return',
  'return_first_half',
  'end_window',
  'extreme',
]);

const metricSchema = z.object({
  type: z.enum(['duration', 'recovery_time', 'mean_speed']).optional(),
  signal: z.string().optional(),
  phase: phase.optional(),
  agg: z.enum(['mean', 'max', 'min', 'range', 'value', 'rise_from_start']).optional(),
  fraction: z.number().optional(),
});

const criterionSchema = z.object({
  id: z.string(),
  metric: z.string(),
  ideal_min: z.number().optional(),
  ideal_max: z.number().optional(),
  tolerance: z.number().positive(),
  weight: z.number().nonnegative(),
  severity: z.enum(['invalidates', 'technique', 'detail']),
  points: z.array(joint).min(1),
  unit: z.enum(['deg', 's', 'scale']),
  scale: z.tuple([joint, joint]).optional(),
  disabled: z.boolean().optional(),
});

const cueSchema = z.object({
  label: text,
  trend: text,
  live: text,
  fix: text,
  finding: text,
  good: text,
});

export const exerciseSpecSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  catalog: z.string().optional(),
  name: text,
  view: z.enum(['side', 'front']).optional(),
  side_joints: z.array(joint).optional(),
  camera: text.optional(),
  required: z.array(joint).optional(),
  signals: z.record(z.string(), signalSchema),
  rep: z.object({
    signal: z.string(),
    rest: z.enum(['high', 'low']),
    min_rom: z.number(),
    min_duration: z.number(),
    max_duration: z.number(),
    start_delta: z.number().optional(),
    end_delta: z.number().optional(),
    near: z.number().optional(),
    idle_end_s: z.number().optional(),
  }),
  metrics: z.record(z.string(), metricSchema),
  criteria: z.array(criterionSchema).min(1),
  effort_metric: z.string().optional(),
  cues: z.record(z.string(), cueSchema),
});

export type ExerciseSpec = z.infer<typeof exerciseSpecSchema>;
export type SignalSpec = z.infer<typeof signalSchema>;
export type MetricSpec = z.infer<typeof metricSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
export type RepConfig = ExerciseSpec['rep'];

/** Validates a spec from outside the bundle (e.g. downloaded); bundled specs are checked in tests. */
export function parseSpec(input: unknown): ExerciseSpec {
  return exerciseSpecSchema.parse(input);
}
