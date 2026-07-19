// The exit compass has been removed from the game. Keep this inert factory
// temporarily so level scenes written before its removal can load old saves
// without creating a visible or collectible item.
export function createCompassPickup() {
  const state = {
    id: "compass",
    active: false,
    visible: false,
    available: false,
    distance: Infinity,
    respawnTimer: 0,
  };

  return {
    getState() {
      return { active: false, removed: true };
    },
    getPickupState() {
      return state;
    },
    inspect() {
      return null;
    },
    update() {
      return state;
    },
    tryPickup() {
      return { pickedUp: false };
    },
  };
}
