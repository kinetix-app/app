import { load, toSeries } from '../engine/test/loadFixtures';
import { createDefaultAnalyzer, createOnDeviceAnalyzer } from '../onDeviceAnalyzer';
import type { PoseSource } from '../pose/poseSource';
import { profileById } from '../profiles';

function fixtureSource(name: string): PoseSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async extract({ uri }) {
      calls.push(uri);
      return toSeries(load(name).series);
    },
  };
}

describe('on-device analyzer', () => {
  it('analyzes the recording with the engine', async () => {
    const source = fixtureSource('real-bicep_curl-good-subject_010');
    const analyzer = createOnDeviceAnalyzer({ poseSource: source });
    const analysis = await analyzer.analyze({
      profile: profileById('hammer-curl')!,
      recording: { uri: 'blob:set', durationSeconds: 32 },
    });
    expect(analyzer.isDemo).toBe(false);
    expect(source.calls).toEqual(['blob:set']);
    expect(analysis).toMatchObject({ status: 'assessed', profileId: 'hammer-curl' });
    if (analysis.status === 'assessed') expect(analysis.reps).toHaveLength(6);
  });

  it('explains a missing video instead of guessing', async () => {
    const source = fixtureSource('real-bicep_curl-good-subject_010');
    const analysis = await createOnDeviceAnalyzer({ poseSource: source }).analyze({
      profile: profileById('hammer-curl')!,
      recording: { uri: null, durationSeconds: 10 },
    });
    expect(analysis).toMatchObject({ status: 'not_assessable', reasons: ['no_recording'] });
    expect(source.calls).toEqual([]);
  });

  it('stops when the analysis is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const source: PoseSource = {
      extract: async () => toSeries(load('unassessable-too_short').series),
    };
    await expect(
      createOnDeviceAnalyzer({ poseSource: source }).analyze({
        profile: profileById('push-up')!,
        recording: { uri: 'blob:set', durationSeconds: 1 },
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});

describe('default analyzer', () => {
  const source: PoseSource = {
    extract: async () => toSeries(load('unassessable-too_short').series),
  };

  it('uses the engine when the platform can extract poses', () => {
    expect(createDefaultAnalyzer('engine', source).isDemo).toBe(false);
  });

  it('falls back to the demo without a pose source or when configured', () => {
    expect(createDefaultAnalyzer('engine', null).isDemo).toBe(true);
    expect(createDefaultAnalyzer('demo', source).isDemo).toBe(true);
  });
});
