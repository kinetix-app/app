import React from 'react';
import { View } from 'react-native';
import { usePalette } from '@/theme/tokens';
import { BONES, containRect, pointsAt } from '../poseTrack';
import type { PoseTrack } from '../schemas';

const DOT = 8;
const LINE = 3;

/**
 * The skeleton of the frame being played, drawn over a `contain`-fitted video. Joints involved in
 * a rep's faults turn red while that rep plays. Decorative: the result screen states the faults.
 */
export function PoseOverlay({
  track,
  time,
  box,
}: Readonly<{ track: PoseTrack; time: number; box: { width: number; height: number } }>) {
  const p = usePalette();
  const frame = pointsAt(track, time);
  if (!frame || !box.width || !box.height) return null;
  const rect = containRect(box, track.width, track.height);
  const rep = track.reps.find((r) => time >= r.start && time <= r.end);
  const faulty = new Set(rep?.faultJoints ?? []);
  const at = (joint: string) => {
    const j = track.joints.indexOf(joint);
    const x = frame[2 * j];
    const y = frame[2 * j + 1];
    if (j < 0 || x === null || y === null) return null;
    return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
  };
  const color = (joint: string) => (faulty.has(joint) ? p.danger : p.brand);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, top: 0, width: box.width, height: box.height }}
    >
      {BONES.map(([a, b]) => {
        const from = at(a);
        const to = at(b);
        if (!from || !to) return null;
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const bad = faulty.has(a) && faulty.has(b);
        return (
          <View
            key={`${a}-${b}`}
            style={{
              position: 'absolute',
              left: (from.x + to.x) / 2 - length / 2,
              top: (from.y + to.y) / 2 - LINE / 2,
              width: length,
              height: LINE,
              borderRadius: LINE / 2,
              backgroundColor: bad ? p.danger : p.brand,
              opacity: 0.85,
              transform: [{ rotate: `${angle}rad` }],
            }}
          />
        );
      })}
      {track.joints.map((joint) => {
        const point = at(joint);
        if (!point) return null;
        return (
          <View
            key={joint}
            style={{
              position: 'absolute',
              left: point.x - DOT / 2,
              top: point.y - DOT / 2,
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: color(joint),
              borderWidth: 1,
              borderColor: p['surface-100'],
            }}
          />
        );
      })}
    </View>
  );
}
