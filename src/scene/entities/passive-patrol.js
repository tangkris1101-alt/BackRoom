export function createPassivePatrolState({ points = [], provokeDuration = 12, initialState = null } = {}) {
  const patrolPoints = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.z));
  if (!patrolPoints.length) return null;
  let patrolIndex = Math.max(0, Math.floor(initialState?.patrolIndex ?? 0)) % patrolPoints.length;
  let provokedTimer = Math.max(0, initialState?.provokedTimer ?? 0);
  let wasFiresaltHit = false;
  const duration = Number.isFinite(provokeDuration) ? Math.max(1, provokeDuration) : 12;

  return {
    update(delta, position, effects = {}) {
      const firesaltHit = Boolean(
        effects.firesaltActive &&
        effects.firesaltPosition &&
        Math.hypot(
          position.x - effects.firesaltPosition.x,
          position.z - effects.firesaltPosition.z,
        ) <= (effects.firesaltRadius ?? 0),
      );
      if (firesaltHit && !wasFiresaltHit) provokedTimer = duration;
      else provokedTimer = Math.max(0, provokedTimer - delta);
      wasFiresaltHit = firesaltHit;
      const provoked = provokedTimer > 0;
      if (!provoked) {
        const target = patrolPoints[patrolIndex];
        if (Math.hypot(position.x - target.x, position.z - target.z) < 0.8) {
          patrolIndex = (patrolIndex + 1) % patrolPoints.length;
        }
      }
      return { provoked, provokedTimer, patrolIndex, target: patrolPoints[patrolIndex] };
    },
    getState: () => ({ patrolIndex, provokedTimer }),
  };
}
