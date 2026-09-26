export const DEFAULT_PLAYER_RADIUS = 0.36;
export const LANDING_TOLERANCE = 0.18;
// Use the same forgiveness at the table edge as for landing. Previously the
// player could land from 0.18m below a platform top but remained blocked by
// its side until 0.04m below it, which made a close jump feel like a pushback.
export const SIDE_CLEARANCE = LANDING_TOLERANCE;
// Standing support only needs the body's centre over the platform, with a small
// inset so a body brushing the edge cannot flicker between supported and
// falling. Requiring the whole capsule inside instead (the original rule) threw
// the support away the instant the capsule began to overhang an edge, and since
// the same collider only blocks sideways below its top, the player dropped
// straight down through the tabletop and was then pushed off it.
export const LEDGE_SUPPORT_INSET = 0.05;

export function colliderBlocksAtFeetHeight(collider, feetY = 0) {
  if (collider?.active === false) return false;
  if (!Number.isFinite(collider?.topY)) return true;
  const sideClearance = Number.isFinite(collider?.sideClearance)
    ? Math.max(0, collider.sideClearance)
    : SIDE_CLEARANCE;
  return feetY < collider.topY - sideClearance;
}

export function getPlatformFloorHeight({
  colliders = [],
  x,
  z,
  feetY = Infinity,
  supportInset = LEDGE_SUPPORT_INSET,
  baseFloorHeight = 0,
}) {
  let floorHeight = baseFloorHeight;
  for (const collider of colliders) {
    if (collider?.active === false || !Number.isFinite(collider?.topY)) continue;
    // Platforms at or below the floor already found cannot raise it.
    if (collider.topY <= floorHeight) continue;
    const bodyOnTop =
      x - supportInset >= collider.minX &&
      x + supportInset <= collider.maxX &&
      z - supportInset >= collider.minZ &&
      z + supportInset <= collider.maxZ;
    const canLandOnPlatform = feetY >= collider.topY - LANDING_TOLERANCE;
    if (bodyOnTop && canLandOnPlatform) floorHeight = collider.topY;
  }
  return floorHeight;
}

export function resolvePlatformOverlap({
  colliders = [],
  x,
  z,
  feetY = 0,
  radius = DEFAULT_PLAYER_RADIUS,
  maxCorrection = Infinity,
}) {
  const resolved = { x, z };
  const padding = 0.002;
  let correctionRemaining = Math.max(0, maxCorrection);
  for (let attempt = 0; attempt <= colliders.length; attempt += 1) {
    const collider = colliders.find((candidate) => {
      if (!colliderBlocksAtFeetHeight(candidate, feetY)) return false;
      return (
        resolved.x + radius > candidate.minX &&
        resolved.x - radius < candidate.maxX &&
        resolved.z + radius > candidate.minZ &&
        resolved.z - radius < candidate.maxZ
      );
    });
    if (!collider) break;

    const exits = [
      { axis: "x", value: collider.minX - radius - padding, distance: Math.abs(resolved.x - (collider.minX - radius)) },
      { axis: "x", value: collider.maxX + radius + padding, distance: Math.abs(resolved.x - (collider.maxX + radius)) },
      { axis: "z", value: collider.minZ - radius - padding, distance: Math.abs(resolved.z - (collider.minZ - radius)) },
      { axis: "z", value: collider.maxZ + radius + padding, distance: Math.abs(resolved.z - (collider.maxZ + radius)) },
    ];
    const exit = exits.reduce((nearest, candidate) => candidate.distance < nearest.distance ? candidate : nearest);
    const correction = exit.value - resolved[exit.axis];
    const appliedCorrection = Math.sign(correction) * Math.min(Math.abs(correction), correctionRemaining);
    resolved[exit.axis] += appliedCorrection;
    correctionRemaining -= Math.abs(appliedCorrection);
    if (correctionRemaining <= 0) break;
  }
  return resolved;
}
