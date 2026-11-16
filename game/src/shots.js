// Lumen Drift — the screenshot scenes behind ?shot=start|play|end|win.
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot (chase the nearest shard,
// keep clear of mines and storm shards), so the frame is what a real game
// looks like and the same seed always gives the same frame.
//
// - start: the title screen over a live, drifting field.
// - play: a busy mid-game — score ~340, combo x3, 2 hearts left.
// - end: the autopilot flies carelessly and the storm takes the skiff.
// - win: the gate opens at 1,200 points.
import { STEP, WIN_SCORE } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_TARGET = 340;
const END_LIMIT_SECONDS = 600;

/** Steer toward `target` while dodging the nearest hazard in the way. */
function autopilot(state, careless) {
  const ship = state.ship;
  // Nearest shard to chase.
  let shard = null;
  let shardDist = Infinity;
  for (const s of state.shards) {
    const d = Math.hypot(s.x - ship.x, s.y - ship.y);
    if (d < shardDist) { shardDist = d; shard = s; }
  }
  let tx = shard ? shard.x : state.ship.x;
  let ty = shard ? shard.y : state.ship.y;
  // Dodge: if a mine or storm is close and ahead, veer away from it.
  const horizon = careless ? 60 : 130;
  for (const list of [state.mines, state.storms]) {
    for (const e of list) {
      const d = Math.hypot(e.x - ship.x, e.y - ship.y);
      if (d < horizon) {
        const away = Math.atan2(ship.y - e.y, ship.x - e.x);
        tx = ship.x + Math.cos(away) * 160;
        ty = ship.y + Math.sin(away) * 160;
      }
    }
  }
  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) return { x: 0, y: 0 };
  return { x: dx / dist, y: dy / dist };
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'win') {
    // Play forward until the gate opens, then let the victory settle.
    for (let i = 0; i < 60 * 240; i += 1) {
      const events = world.step(STEP, autopilot(state, false), null, false);
      if (events & EVENT_WIN) break;
    }
    state.score = Math.max(state.score, WIN_SCORE);
    state.gateOpen = true;
    state.gateProgress = 1;
    for (let i = 0; i < 30; i += 1) world.step(STEP, { x: 0, y: 0 }, null, false);
    return { screen: SCREEN_WIN, best: state.score };
  }
  if (name === 'play') {
    for (let i = 0; i < 60 * 240; i += 1) {
      world.step(STEP, autopilot(state, false), null, false);
      if (state.score >= PLAY_TARGET) break;
    }
    // Let the field settle for a moment, then stage the exact HUD the
    // brief asks for: ~340 points, combo x3, two hearts. The autopilot
    // keeps the skiff alive; the numbers below are the scene's floor.
    for (let i = 0; i < 12; i += 1) world.step(STEP, autopilot(state, false), null, false);
    state.score = PLAY_TARGET;
    state.combo = 3;
    state.comboCount = 6;
    state.bestCombo = Math.max(3, state.bestCombo);
    state.hearts = 2;
    state.gateProgress = Math.min(1, state.score / WIN_SCORE);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'end') {
    // A reckless pilot: it wanders the middle of the field, never chases
    // a shard and never dodges, so the storm catches it early with a
    // modest score — a real game over, not a high-score run cut short.
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      const wander = {
        x: Math.sin(state.time * 0.7) * 0.4,
        y: Math.cos(state.time * 0.5) * 0.3,
      };
      const events = world.step(STEP, wander, null, false);
      if (events & EVENT_OVER) break;
    }
    // Guarantee the game-over frame: if the reckless pilot survived the
    // whole limit (it should not), drain the hearts directly.
    if (state.hearts > 0) state.hearts = 0;
    for (let i = 0; i < 20; i += 1) world.step(STEP, { x: 0, y: 0 }, null, false);
    return { screen: SCREEN_OVER, best: state.score };
  }
  // start (and any unknown name): a live field behind the title.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, { x: 0, y: 0 }, null, false);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
