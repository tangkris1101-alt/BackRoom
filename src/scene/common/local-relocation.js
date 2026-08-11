import { inspectWorldPoint } from "../entities/interactions.js";

function distanceTo(position, playerPosition) {
  return Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
}

export function createLocalRelocationNetwork(camera, definitions = [], initialState = {}) {
  const routes = definitions.map((definition) => ({
    radius: 2.2,
    activation: "threshold",
    ...definition,
    count: Math.max(0, Math.floor(initialState?.[definition.id]?.count ?? 0)),
    armed: true,
  }));
  let pending = null;
  let serial = 0;

  function queue(route) {
    route.count += 1;
    route.armed = false;
    serial += 1;
    pending = {
      id: `${route.id}-${serial}`,
      x: route.destination.x,
      z: route.destination.z,
      yaw: route.destination.yaw ?? 0,
      routeId: route.id,
    };
  }

  function update(playerPosition) {
    for (const route of routes) {
      const distance = distanceTo(route.position, playerPosition);
      if (distance > route.radius + 1.2) route.armed = true;
      if (route.activation === "threshold" && route.armed && distance <= route.radius) queue(route);
    }
    const relocation = pending;
    pending = null;
    return relocation;
  }

  function inspect(playerPosition) {
    let focused = null;
    for (const route of routes) {
      if (route.activation !== "interact") continue;
      const aimDistance = inspectWorldPoint(camera, route.position, {
        distanceLimit: route.inspectDistance ?? 8,
        height: route.inspectHeight ?? 1.2,
        radius: route.inspectRadius ?? 0.75,
      });
      if (aimDistance === null) continue;
      const rangeDistance = distanceTo(route.position, playerPosition);
      if (!focused || aimDistance < focused.distance) {
        focused = {
          id: route.id,
          type: "interaction",
          distance: aimDistance,
          rangeDistance,
          available: rangeDistance <= route.radius,
          i18n: route.i18n,
        };
      }
    }
    return focused;
  }

  function interact(playerPosition, routeId = null) {
    const route = routes
      .filter((candidate) => candidate.activation === "interact")
      .filter((candidate) => !routeId || candidate.id === routeId)
      .map((candidate) => ({ candidate, distance: distanceTo(candidate.position, playerPosition) }))
      .filter(({ candidate, distance }) => distance <= candidate.radius && candidate.armed)
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
    if (!route) return { interacted: false };
    queue(route);
    return {
      interacted: true,
      id: route.id,
      count: route.count,
      i18n: route.i18n,
    };
  }

  return {
    routes,
    update,
    inspect,
    interact,
    getState: () => Object.fromEntries(routes.map((route) => [route.id, { count: route.count }])),
  };
}
