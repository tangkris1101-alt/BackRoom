// Normalized camera height and pitch during the Level 0 opening. The brief
// weight shift near the end keeps the stand-up from feeling like one eased lift.
export const OPENING_STAND_UP_DURATION_S = 1.18;

const STAND_POSES = [
  [0, 0, 0],
  [0.10, 0.03, 0.01], // brace against the floor
  [0.22, 0.12, 0.055],
  [0.52, 0.74, 0.44], // push up; the head follows the body
  [0.68, 0.91, 0.78],
  [0.75, 0.875, 0.84], // catch balance before straightening
  [1, 1, 1],
];

export function sampleOpeningStandPose(elapsedSeconds) {
  const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const progress = Math.max(0, Math.min(time / OPENING_STAND_UP_DURATION_S, 1));
  for (let i = 1; i < STAND_POSES.length; i += 1) {
    const [endTime, endHeight, endPitch] = STAND_POSES[i];
    if (progress > endTime) continue;
    const [startTime, startHeight, startPitch] = STAND_POSES[i - 1];
    const part = (progress - startTime) / (endTime - startTime);
    return {
      height: startHeight + (endHeight - startHeight) * part,
      pitch: startPitch + (endPitch - startPitch) * part,
    };
  }
  return { height: 1, pitch: 1 };
}
