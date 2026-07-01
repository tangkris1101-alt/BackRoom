import {
  ENTITY_INSPECT_DISTANCE,
  INTERACTION_RADIUS,
  INTERACTION_INSPECT_DISTANCE,
} from "../constants.js";
import { inspectForward, inspectToItem } from "../items/shared.js";

export function inspectWorldPoint(camera, target, { distanceLimit, height = 1.2, radius = 0.55 }) {
  if (!camera || !target) return null;
  camera.getWorldDirection(inspectForward);
  inspectToItem.set(target.x, (target.y ?? 0) + height, target.z).sub(camera.position);
  const distance = inspectToItem.length();
  if (distance > distanceLimit) return null;
  inspectToItem.normalize();
  const maxAngle = Math.min(0.18, Math.max(0.045, Math.atan2(radius, distance)));
  if (inspectForward.dot(inspectToItem) < Math.cos(maxAngle)) return null;
  return distance;
}

export function getFocusedEntity(camera, entities = []) {
  const inspected = entities
    .filter((entity) => entity?.active)
    .map((entity) => {
      const distance = inspectWorldPoint(
        camera,
        { x: entity.x, y: 0, z: entity.z },
        {
          distanceLimit: ENTITY_INSPECT_DISTANCE,
          height: entity.y ?? 1.2,
          radius: entity.id === "hound" ? 0.8 : 0.58,
        },
      );
      return distance === null
        ? null
        : {
            id: entity.id,
            type: "entity",
            distance,
            active: entity.active,
          };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);
  return inspected[0] ?? null;
}

export function createInteractionSpot({
  id,
  position,
  radius = INTERACTION_RADIUS,
  inspectDistance = INTERACTION_INSPECT_DISTANCE,
  inspectHeight = 1.18,
  inspectRadius = 0.68,
  responseKey,
  initialState = null,
}) {
  let interactionCount =
    initialState && Number.isFinite(initialState.count) ? Math.max(0, Math.floor(initialState.count)) : 0;
  return {
    id,
    getState() {
      return { count: interactionCount };
    },
    inspect(camera, playerPosition) {
      const aimDistance = inspectWorldPoint(camera, position, {
        distanceLimit: inspectDistance,
        height: inspectHeight,
        radius: inspectRadius,
      });
      if (aimDistance === null) return null;
      const distance = Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
      return {
        id,
        type: "interaction",
        distance: aimDistance,
        available: distance <= radius,
        rangeDistance: distance,
      };
    },
    interact(playerPosition) {
      const distance = Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
      if (distance > radius) return { interacted: false };
      interactionCount += 1;
      return {
        interacted: true,
        id,
        textKey: responseKey ?? `${id}Response`,
        count: interactionCount,
      };
    },
  };
}

export function getFocusedInteraction(camera, playerPosition, interactions = []) {
  return interactions
    .map((interaction) => interaction.inspect(camera, playerPosition))
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function tryInteractWithSpots(playerPosition, ...interactions) {
  for (const interaction of interactions) {
    const result = interaction.interact(playerPosition);
    if (result?.interacted) return result;
  }
  return { interacted: false };
}

export function getFocusedItem(...items) {
  return items.filter(Boolean).sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function tryPickupItems(playerPosition, ...pickups) {
  for (const pickup of pickups) {
    const result = pickup.tryPickup(playerPosition);
    if (result?.pickedUp) return result;
  }
  return { pickedUp: false };
}

