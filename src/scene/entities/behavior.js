import { ENTITY_SPEED_MULTIPLIER, FIRESALT_STUN_DURATION } from "../constants.js";
import { resolveEntityStep } from "./spawn.js";
import { createNavGrid, aStar, followPath, pathContainsCell } from "./pathfinding.js";

const DEFAULT_RECOMPUTE_INTERVAL = 0.52;
const DEFAULT_STUCK_THRESHOLD = 0.72;
const DEFAULT_STUCK_MIN_PROGRESS = 0.22;
const DEFAULT_DIRECT_CHASE_DISTANCE = 7.5;
const PLAYER_DIRECT_LOOK_MINIMUM_DOT = 0.985;

export function getEntityPlayerDistance(entityPosition, playerPosition) {
  return Math.hypot(
    playerPosition.x - entityPosition.x,
    playerPosition.z - entityPosition.z,
  );
}

export function createEntityNavCellFilter({ isCellOpen, cellCenter, isWalkable, radius = 0.32 }) {
  return (col, row) => {
    if (!isCellOpen(col, row)) return false;
    const center = cellCenter(col, row);
    return Boolean(center && isWalkable(center.x, center.z, radius));
  };
}

export function createContactAttackCycle({
  windup = 0.32,
  hitDuration = 0.12,
  recovery = 0.72,
} = {}) {
  let phase = "idle";
  let timer = 0;
  let hitConsumed = false;

  return {
    reset() {
      phase = "idle";
      timer = 0;
      hitConsumed = false;
    },
    update(delta, inRange) {
      let shouldDamage = false;
      if (phase === "idle" && inRange) {
        phase = "windup";
        timer = windup;
        hitConsumed = false;
      } else if (phase === "windup" && !inRange) {
        phase = "idle";
        timer = 0;
      }

      if (phase !== "idle") timer -= Math.max(0, delta);
      if (phase === "windup" && timer <= 1e-6) {
        phase = "hit";
        timer = hitDuration;
      }
      if (phase === "hit" && !hitConsumed) {
        shouldDamage = inRange;
        hitConsumed = true;
      }
      if (phase === "hit" && timer <= 1e-6) {
        phase = "recovery";
        timer = recovery;
      }
      if (phase === "recovery" && timer <= 1e-6) {
        phase = "idle";
        timer = 0;
      }

      return { phase, shouldDamage, progress: timer };
    },
    get phase() {
      return phase;
    },
  };
}

function smoothAngle(current, target, maxStep) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  const step = Math.max(-maxStep, Math.min(maxStep, delta));
  return current + step;
}

function tryResolveDirections(position, directions, step, isWalkable) {
  for (const [dirX, dirZ] of directions) {
    const resolved = resolveEntityStep(position, dirX * step, dirZ * step, isWalkable);
    if (Math.hypot(resolved.x - position.x, resolved.z - position.z) > 0.001) {
      return resolved;
    }
  }
  return { x: position.x, z: position.z };
}

function hasClearCellLine(origin, target, worldToCell, isCellOpen) {
  if (!worldToCell || !isCellOpen) return true;
  const distance = Math.hypot(target.x - origin.x, target.z - origin.z);
  const samples = Math.max(2, Math.ceil(distance / 0.45));
  for (let index = 1; index < samples; index += 1) {
    const ratio = index / samples;
    const cell = worldToCell(
      origin.x + (target.x - origin.x) * ratio,
      origin.z + (target.z - origin.z) * ratio,
    );
    if (!isCellOpen(cell.col, cell.row)) return false;
  }
  return true;
}

function playerDirectlyLooksAtEntity(playerView, group, worldToCell, isCellOpen) {
  const origin = playerView?.origin;
  const direction = playerView?.direction;
  if (!origin || !direction) return false;

  const targetY = group.position.y + (playerView.entityLookHeight ?? 0.9);
  const dx = group.position.x - origin.x;
  const dy = targetY - origin.y;
  const dz = group.position.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  const directionLength = Math.hypot(direction.x, direction.y, direction.z);
  if (distance < 0.2 || directionLength < 0.001) return false;

  const dot = (dx * direction.x + dy * direction.y + dz * direction.z) / (distance * directionLength);
  if (dot < (playerView.minimumDot ?? PLAYER_DIRECT_LOOK_MINIMUM_DOT)) return false;
  return hasClearCellLine(origin, group.position, worldToCell, isCellOpen);
}

export function createEntityMover({
  group,
  isWalkable,
  speed,
  contactRadius,
  cols,
  rows,
  isCellOpen,
  worldToCell,
  cellCenter,
  recomputeInterval = DEFAULT_RECOMPUTE_INTERVAL,
  stuckThreshold = DEFAULT_STUCK_THRESHOLD,
  stuckMinProgress = DEFAULT_STUCK_MIN_PROGRESS,
  directChaseDistance = DEFAULT_DIRECT_CHASE_DISTANCE,
  turnRate = 8.5,
}) {
  const navGrid =
    cols && rows && isCellOpen && worldToCell && cellCenter
      ? createNavGrid({ cols, rows, isCellOpen })
      : null;
  const path = { waypoints: [], index: 0 };
  let recomputeTimer = 0;
  let stuckTimer = 0;
  let lastPlayerCellKey = "";
  let lastPositionX = group.position.x;
  let lastPositionZ = group.position.z;
  let firesaltStunTimer = 0;

  function clearPath() {
    path.waypoints = [];
    path.index = 0;
  }

  function repathTo(playerPosition) {
    if (!navGrid) return;
    const start = worldToCell(group.position.x, group.position.z);
    const goal = worldToCell(playerPosition.x, playerPosition.z);
    const next = aStar(navGrid, start, goal);
    path.waypoints = next ?? [];
    path.index = 0;
    recomputeTimer = recomputeInterval;
  }

  return {
    clearPath,
    update(delta, elapsed, playerPosition, effects = {}, options = {}) {
      const dx = playerPosition.x - group.position.x;
      const dz = playerPosition.z - group.position.z;
      const distance = Math.hypot(dx, dz);
      const repelRadius = Number.isFinite(effects.repelRadius) ? effects.repelRadius : 0;
      const repelActive = Boolean(effects.entityRepelActive && distance <= repelRadius);
      const baseSpeed = speed * ENTITY_SPEED_MULTIPLIER;
      const speedScale = Number.isFinite(options.speedScale) ? Math.max(0, options.speedScale) : 1;
      const closeBoost = !repelActive && distance < directChaseDistance ? 1.12 : 1;
      const farBoost = !repelActive && distance > directChaseDistance * 3 ? 1.08 : 1;
      const movementSpeed = baseSpeed * speedScale * closeBoost * farBoost;
      const firesaltPosition = effects.firesaltPosition;
      const firesaltStunned = Boolean(
        effects.firesaltActive &&
        firesaltPosition &&
        Math.hypot(group.position.x - firesaltPosition.x, group.position.z - firesaltPosition.z) <=
          (effects.firesaltRadius ?? 0),
      );
      if (firesaltStunned) firesaltStunTimer = FIRESALT_STUN_DURATION;
      else firesaltStunTimer = Math.max(0, firesaltStunTimer - delta);
      const isDormant = Boolean(options.dormant || firesaltStunTimer > 0);
      const directGazeChase =
        !isDormant &&
        playerDirectlyLooksAtEntity(effects.playerView, group, worldToCell, isCellOpen);
      const lineOfSight = hasClearCellLine(group.position, playerPosition, worldToCell, isCellOpen);
      const heardPlayer = Boolean(
        (effects.playerSprinting && distance <= 24) ||
        (effects.playerMoving && distance <= 10),
      );
      const directChaseAllowed =
        (distance <= directChaseDistance || directGazeChase) &&
        stuckTimer <= stuckThreshold * 0.6;

      if (repelActive || isDormant) {
        clearPath();
        recomputeTimer = recomputeInterval;
        stuckTimer = 0;
      }

      if (!repelActive && !isDormant && navGrid) {
        const playerCell = worldToCell(playerPosition.x, playerPosition.z);
        const playerCellKey = `${playerCell.col},${playerCell.row}`;
        const playerMoved = playerCellKey !== lastPlayerCellKey;
        const playerOffPath = !pathContainsCell(path.waypoints, playerCell, path.index);
        const stuck = stuckTimer > stuckThreshold;
        const nearDirect = directChaseAllowed && isWalkable(playerPosition.x, playerPosition.z, 0.32);
        const needRepath =
          stuck ||
          (!nearDirect &&
            (path.waypoints.length === 0 ||
              recomputeTimer <= 0 ||
              (playerMoved && playerOffPath)));
        if (needRepath) {
          repathTo(playerPosition);
          lastPlayerCellKey = playerCellKey;
        }
      }

      let nextX = group.position.x;
      let nextZ = group.position.z;
      let advanced = false;
      let reachedEnd = false;

      if (!isDormant && repelActive && distance > 0.001) {
        const repelMultiplier = Number.isFinite(effects.repelSpeedMultiplier)
          ? Math.max(0.2, effects.repelSpeedMultiplier)
          : 1.4;
        const step = movementSpeed * repelMultiplier * delta;
        const resolved = tryResolveDirections(
          group.position,
          [
            [-dx / distance, -dz / distance],
            [-dz / distance, dx / distance],
            [dz / distance, -dx / distance],
          ],
          step,
          isWalkable,
        );
        nextX = resolved.x;
        nextZ = resolved.z;
        advanced = nextX !== group.position.x || nextZ !== group.position.z;
      } else if (!isDormant && distance > 0.001 && directChaseAllowed) {
        const step = Math.min(distance, movementSpeed * delta);
        const resolved = tryResolveDirections(
          group.position,
          [
            [dx / distance, dz / distance],
            [dx / distance + -dz / distance * 0.42, dz / distance + dx / distance * 0.42],
            [dx / distance + dz / distance * 0.42, dz / distance + -dx / distance * 0.42],
          ],
          step,
          isWalkable,
        );
        nextX = resolved.x;
        nextZ = resolved.z;
        advanced = nextX !== group.position.x || nextZ !== group.position.z;
      } else if (!isDormant && path.waypoints.length > 0) {
        const followed = followPath({
          entityPos: group.position,
          waypoints: path.waypoints,
          indexRef: path,
          cellCenter,
          speed: movementSpeed,
          delta,
          isWalkable,
        });
        nextX = followed.x;
        nextZ = followed.z;
        advanced = followed.advanced;
        reachedEnd = followed.reachedEnd;
      } else if (!isDormant && distance > 0.001) {
        const step = Math.min(distance, movementSpeed * delta);
        const resolved = resolveEntityStep(
          group.position,
          (dx / distance) * step,
          (dz / distance) * step,
          isWalkable,
        );
        nextX = resolved.x;
        nextZ = resolved.z;
        advanced = nextX !== group.position.x || nextZ !== group.position.z;
      }

      const movedNow = Math.hypot(nextX - lastPositionX, nextZ - lastPositionZ);
      const expected = movementSpeed * delta * stuckMinProgress;
      if (!isDormant && movedNow < expected) {
        stuckTimer += delta;
      } else {
        stuckTimer = 0;
      }

      if (!isDormant && stuckTimer > stuckThreshold && distance > 0.001) {
        const side = Math.sin(elapsed * 1.73 + group.position.x * 0.37) >= 0 ? 1 : -1;
        const step = movementSpeed * delta * 0.82;
        const nudge = tryResolveDirections(
          group.position,
          [
            [(-dz / distance) * side, (dx / distance) * side],
            [(dz / distance) * side, (-dx / distance) * side],
            [-dx / distance, -dz / distance],
          ],
          step,
          isWalkable,
        );
        nextX = nudge.x;
        nextZ = nudge.z;
        advanced = nextX !== group.position.x || nextZ !== group.position.z;
        if (advanced) {
          clearPath();
          recomputeTimer = 0;
          stuckTimer = 0;
        }
      }

      const velocityX = delta > 0 ? (nextX - lastPositionX) / delta : 0;
      const velocityZ = delta > 0 ? (nextZ - lastPositionZ) / delta : 0;
      group.position.x = nextX;
      group.position.z = nextZ;
      lastPositionX = nextX;
      lastPositionZ = nextZ;

      if (distance > 0.001 && (advanced || reachedEnd || repelActive)) {
        const targetYaw = repelActive ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
        group.rotation.y = smoothAngle(group.rotation.y, targetYaw, turnRate * delta);
      }

      if (recomputeTimer > 0) recomputeTimer -= delta;

      const currentDistance = Math.hypot(
        playerPosition.x - group.position.x,
        playerPosition.z - group.position.z,
      );
      const contact = !repelActive && !isDormant && currentDistance <= contactRadius;
      const state = isDormant
        ? "idle"
        : repelActive
          ? "retreat"
          : contact
            ? "attack"
            : lineOfSight || directGazeChase
              ? "chase"
              : heardPlayer
                ? "investigate"
                : advanced
                  ? "search"
                  : "idle";
      return {
        repelActive,
        distance: currentDistance,
        contact,
        movementSpeed,
        advanced,
        dormant: isDormant,
        state,
        velocity: { x: velocityX, z: velocityZ },
        perception: { lineOfSight, heardPlayer, directGaze: directGazeChase },
      };
    },
  };
}
