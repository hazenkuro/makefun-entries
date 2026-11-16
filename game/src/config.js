// Lumen Drift — tuning constants. One place holds every number that shapes
// how the game feels, so balancing is editing values here, never hunting
// through the world or the renderer.
export const FIELD = { width: 1280, height: 720 };

// Fixed simulation step: the world advances in 1/60 s slices.
export const STEP = 1 / 60;

// The goal: reach this score and the Aurora Gate opens.
export const WIN_SCORE = 1200;
export const HEARTS = 3;

// Star shards: base points, and the combo ladder (consecutive pickups with
// no hit multiply the base; every 3 pickups steps the combo up one rung).
// Combo caps at x5.
export const SHARD_POINTS = 10;
export const COMBO_MAX = 5;

// The skiff: how fast it flies, how hard the dash kicks, how long the dash
// lasts and how long the player waits before dashing again.
export const SHIP = {
  radius: 16,
  accel: 2600,
  maxSpeed: 420,
  drag: 2.6,
  dashSpeed: 950,
  dashTime: 0.16,
  dashCooldown: 1.4,
  invulnerableTime: 1.2,
};

// Difficulty ramps one level every 200 points, up to level 5.
export const LEVEL_EVERY = 200;
export const LEVEL_MAX = 5;

// Spawn pacing, in seconds between spawns at level 1; each level multiplies
// the rate by SPAWN_GROWTH, so the field gets busier as the score climbs.
export const SPAWN = {
  shardEvery: 0.55,
  mineEvery: 1.5,
  stormEvery: 2.4,
  shieldEvery: 14,
  growth: 0.82,
};

// Drift speeds (pixels per second) at level 1; each level adds SPEED_GROWTH.
export const DRIFT = {
  mine: 55,
  storm: 190,
  shard: 40,
  speedGrowth: 0.16,
};

// Best score is kept in local storage under this key.
export const BEST_KEY = 'lumen-drift-best';
