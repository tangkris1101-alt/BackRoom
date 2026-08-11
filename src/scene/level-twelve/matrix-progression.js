export function createMatrixProgression(initialInteractions = {}) {
  let doorAttempted = (initialInteractions["level-twelve-original-door"]?.count ?? 0) >= 1;
  let doorOpened = (initialInteractions["level-twelve-original-door"]?.count ?? 0) >= 2;
  let chairCompleted = Boolean(initialInteractions["level-twelve-chair"]?.count);
  let copycatCompleted = Boolean(initialInteractions["level-twelve-copycat-door"]?.count);
  let chairWatching = false;
  let chairTimer = chairCompleted ? 8 : 0;

  return {
    get doorAttempted() { return doorAttempted; },
    get doorOpened() { return doorOpened; },
    get chairCompleted() { return chairCompleted; },
    get copycatCompleted() { return copycatCompleted; },
    get chairWatching() { return chairWatching; },
    get chairTimer() { return chairTimer; },
    tryDoor() {
      doorAttempted = true;
      if (chairCompleted && copycatCompleted) doorOpened = true;
      return doorOpened;
    },
    beginChairObservation() {
      if (!doorAttempted || chairCompleted) return false;
      chairWatching = true;
      return true;
    },
    updateChairObservation(delta, inRange) {
      if (!chairWatching || chairCompleted || !inRange) return chairCompleted;
      chairTimer = Math.min(8, chairTimer + Math.max(0, Number(delta) || 0));
      if (chairTimer >= 8) {
        chairCompleted = true;
        chairWatching = false;
      }
      return chairCompleted;
    },
    completeCopycat() {
      if (chairCompleted) copycatCompleted = true;
      return copycatCompleted;
    },
    getInteractionState() {
      return {
        "level-twelve-original-door": { count: doorOpened ? 2 : doorAttempted ? 1 : 0 },
        "level-twelve-chair": { count: chairCompleted ? 1 : 0 },
        "level-twelve-copycat-door": { count: copycatCompleted ? 1 : 0 },
      };
    },
  };
}
