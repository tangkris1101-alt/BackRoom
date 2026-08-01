const HUB_DOOR_ENTRY_OFFSET = 2.4;

export function resolveHubEntry({
  routes,
  initialInteractions = {},
  entryContext = null,
  defaultSpawn,
}) {
  if (entryContext?.type !== "door" || !Number.isInteger(entryContext.sourceLevel)) {
    return { spawn: defaultSpawn, interactions: initialInteractions, entryRoute: null };
  }

  const entryRoute = routes.find((route) => route.targetLevel === entryContext.sourceLevel) ?? null;
  if (!entryRoute) {
    return { spawn: defaultSpawn, interactions: initialInteractions, entryRoute: null };
  }

  const side = Math.sign(entryRoute.position.x) || 1;
  return {
    spawn: {
      x: entryRoute.position.x - side * HUB_DOOR_ENTRY_OFFSET,
      z: entryRoute.position.z,
      yaw: side * Math.PI / 2,
    },
    interactions: {
      ...initialInteractions,
      [entryRoute.id]: {
        ...initialInteractions?.[entryRoute.id],
        count: 0,
        unlocked: true,
      },
    },
    entryRoute,
  };
}
