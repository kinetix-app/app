import { analyze, parseSpec } from '../engine';
import { load, toSeries } from '../engine/test/loadFixtures';
import { buildPoseTrack, containRect, failed, frameAt, pointsAt, TRACK_JOINTS } from '../poseTrack';
import { poseTrackSchema } from '../schemas';

function track(name: string) {
  const fixture = load(name);
  const spec = parseSpec(fixture.spec);
  const series = toSeries(fixture.series);
  const result = analyze(series, spec, 'en');
  return { series, result, spec, track: buildPoseTrack(series, result, spec) };
}

describe('pose track', () => {
  it('keeps the tracked joints of every frame and the faults of each rep', () => {
    const { series, result, spec, track: pose } = track('synthetic-push_up');
    expect(poseTrackSchema.parse(pose)).toEqual(pose);
    expect(pose.frames).toHaveLength(series.t.length);
    expect(pose.frames.every((f) => f.length === 2 * TRACK_JOINTS.length)).toBe(true);
    expect(pose.width).toBe(series.width);
    if (!result.assessable) throw new Error('expected an assessed set');
    expect(pose.reps).toHaveLength(result.reps.length);
    result.reps.forEach((rep, i) => {
      const faulty = spec.criteria.filter((c) => failed(rep.criteria[c.id]));
      expect(pose.reps[i].start).toBe(rep.start_s);
      expect(pose.reps[i].faultJoints.length > 0).toBe(faulty.length > 0);
      for (const c of faulty)
        for (const point of c.points)
          expect(pose.reps[i].faultJoints).toContain(`${result.side}_${point}`);
    });
    // The synthetic set includes faulty reps, so some joints must be marked.
    expect(pose.reps.some((r) => r.faultJoints.length > 0)).toBe(true);
  });

  it('drops joints that were not seen and has no reps when the set was not assessable', () => {
    const { track: pose } = track('unassessable-not_side_view');
    expect(pose.reps).toEqual([]);
    const { track: missing } = track('unassessable-missing_joints');
    expect(missing.frames.some((f) => f.includes(null))).toBe(true);
  });

  it('finds the frame being played', () => {
    const t = [0, 0.1, 0.2, 0.3];
    expect(frameAt(t, -0.05)).toBe(-1);
    expect(frameAt(t, 0)).toBe(0);
    expect(frameAt(t, 0.15)).toBe(1);
    expect(frameAt(t, 9)).toBe(3);
    expect(frameAt([], 1)).toBe(-1);
  });

  it('places the video inside its box like contentFit contain', () => {
    expect(containRect({ width: 400, height: 400 }, 1920, 1080)).toEqual({
      left: 0,
      top: 87.5,
      width: 400,
      height: 225,
    });
    expect(containRect({ width: 400, height: 400 }, 1080, 1920)).toEqual({
      left: 87.5,
      top: 0,
      width: 225,
      height: 400,
    });
  });
});

describe('pointsAt', () => {
  const pose = {
    width: 100,
    height: 100,
    joints: ['a', 'b'],
    t: [0, 0.1],
    frames: [
      [0, 0, 0.5, 0.5],
      [1, 0.5, null, null],
    ],
    reps: [],
  };
  it('moves joints in a straight line between analysed poses', () => {
    expect(pointsAt(pose, 0.05)).toEqual([0.5, 0.25, 0.5, 0.5]);
    expect(pointsAt(pose, 0.2)).toEqual([1, 0.5, null, null]);
    expect(pointsAt(pose, -1)).toBeNull();
  });
});
