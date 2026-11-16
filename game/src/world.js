// Lumen Drift — the world: the skiff, the storm field, and the rules.
// Everything the game simulates lives in one plain state object so the
// renderer, the screenshots and the tests all read the same truth.
//
// Entities: star shards (collect for points), void mines (slow, spiky,
// drifting), storm shards (fast, sharp), shield cells (one free hit).
// Picking up shards in a row without a hit raises the combo x1..x5; a hit
// resets it. Every 200 points the level rises (1..5): spawns quicken and
// everything drifts faster. At 1,200 points the Aurora Gate opens: win.
import {
  COMBO_MAX,
  DRIFT,
  FIELD,
  HEARTS,
  LEVEL_EVERY,
  LEVEL_MAX,
  SHARD_POINTS,
  SHIP,
  SPAWN,
  WIN_SCORE,
} from './config.js';

export const KIND_SHARD = 'shard';
export const KIND_MINE = 'mine';
export const KIND_STORM = 'storm';
export const KIND_SHIELD = 'shield';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_SHIELD = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_DASH = 32;

function makeShip() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height * 0.62,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    dashTime: 0,
    dashCooldown: 0,
    invulnerable: 0,
  };
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    bestCombo: 0,
    combo: 0,
    comboCount: 0,
    hearts: HEARTS,
    level: 1,
    shield: false,
    ship: makeShip(),
    shards: [],
    mines: [],
    storms: [],
    shields: [],
    particles: [],
    trail: [],
    stars: [],
    gateOpen: false,
    gateProgress: 0,
    spawnTimers: { shard: 0.2, mine: 1.2, storm: 2.0, shield: 8 },
    flashes: 0,
  };

  // Three parallax star layers, seeded once per world.
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < 42 - layer * 10; i += 1) {
      state.stars.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, FIELD.height),
        layer,
        size: random.range(0.6, 1.4 + layer * 0.5),
        twinkle: random.range(0, Math.PI * 2),
      });
    }
  }

  function levelFor(score) {
    return Math.min(LEVEL_MAX, 1 + Math.floor(score / LEVEL_EVERY));
  }

  function speedScale() {
    return 1 + (state.level - 1) * DRIFT.speedGrowth;
  }

  function spawnRate(base) {
    return base * Math.pow(SPAWN.growth, state.level - 1);
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, Math.PI * 2);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(0.3, 0.8),
        maxLife: 0.8,
        size: random.range(1.5, 4),
        color,
      });
    }
  }

  function spawnShard() {
    state.shards.push({
      x: random.range(40, FIELD.width - 40),
      y: -20,
      vy: DRIFT.shard * speedScale() * random.range(0.7, 1.4),
      vx: random.range(-18, 18),
      radius: 10,
      spin: random.range(0, Math.PI * 2),
      spinSpeed: random.range(1.5, 3.5),
      pulse: random.range(0, Math.PI * 2),
    });
  }

  function spawnMine() {
    const fromLeft = random.next() < 0.5;
    state.mines.push({
      x: fromLeft ? -24 : FIELD.width + 24,
      y: random.range(60, FIELD.height - 60),
      vx: (fromLeft ? 1 : -1) * DRIFT.mine * speedScale() * random.range(0.8, 1.3),
      vy: random.range(-14, 14),
      radius: random.range(15, 20),
      spin: random.range(0, Math.PI * 2),
      spinSpeed: random.range(0.6, 1.6),
      pulse: random.range(0, Math.PI * 2),
    });
  }

  function spawnStorm() {
    const angle = random.range(Math.PI * 0.15, Math.PI * 0.85);
    const fromTop = random.next() < 0.6;
    state.storms.push({
      x: random.range(40, FIELD.width - 40),
      y: fromTop ? -24 : FIELD.height + 24,
      vx: Math.cos(angle) * DRIFT.storm * speedScale() * random.range(0.85, 1.25) * (random.next() < 0.5 ? -1 : 1),
      vy: (fromTop ? 1 : -1) * Math.sin(angle) * DRIFT.storm * speedScale() * random.range(0.85, 1.25),
      radius: 9,
      spin: random.range(0, Math.PI * 2),
      spinSpeed: random.range(4, 7),
    });
  }

  function spawnShield() {
    state.shields.push({
      x: random.range(60, FIELD.width - 60),
      y: -20,
      vy: 55,
      radius: 13,
      pulse: random.range(0, Math.PI * 2),
    });
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.bestCombo = 0;
    state.combo = 0;
    state.comboCount = 0;
    state.hearts = HEARTS;
    state.level = 1;
    state.shield = false;
    state.ship = makeShip();
    state.shards = [];
    state.mines = [];
    state.storms = [];
    state.shields = [];
    state.particles = [];
    state.trail = [];
    state.gateOpen = false;
    state.gateProgress = 0;
    state.spawnTimers = { shard: 0.2, mine: 1.2, storm: 2.0, shield: 8 };
    state.flashes = 0;
  }

  // Advance the world one fixed step. `steer` is the normalised keyboard
  // vector, `pointer` the mouse target (or null), `dash` a dash request.
  // Returns a bitmask of events that happened this step.
  function step(dt, steer, pointer, dash) {
    let events = EVENT_NONE;
    state.time += dt;
    state.level = levelFor(state.score);
    const ship = state.ship;

    // --- Spawning ---------------------------------------------------------
    state.spawnTimers.shard -= dt;
    state.spawnTimers.mine -= dt;
    state.spawnTimers.storm -= dt;
    state.spawnTimers.shield -= dt;
    if (state.spawnTimers.shard <= 0) { spawnShard(); state.spawnTimers.shard = spawnRate(SPAWN.shardEvery); }
    if (state.spawnTimers.mine <= 0) { spawnMine(); state.spawnTimers.mine = spawnRate(SPAWN.mineEvery); }
    if (state.spawnTimers.storm <= 0) { spawnStorm(); state.spawnTimers.storm = spawnRate(SPAWN.stormEvery); }
    if (state.spawnTimers.shield <= 0 && !state.shield) { spawnShield(); state.spawnTimers.shield = SPAWN.shieldEvery; }

    // --- Ship steering ----------------------------------------------------
    let ax = steer.x * SHIP.accel;
    let ay = steer.y * SHIP.accel;
    if ((steer.x === 0 && steer.y === 0) && pointer && pointer.active && pointer.down) {
      const dx = pointer.x - ship.x;
      const dy = pointer.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) {
        ax = (dx / dist) * SHIP.accel;
        ay = (dy / dist) * SHIP.accel;
      }
    }
    if (ship.dashTime > 0) {
      ship.dashTime -= dt;
    } else {
      ship.vx += ax * dt;
      ship.vy += ay * dt;
      const drag = Math.max(0, 1 - SHIP.drag * dt);
      ship.vx *= drag;
      ship.vy *= drag;
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > SHIP.maxSpeed) {
        ship.vx = (ship.vx / speed) * SHIP.maxSpeed;
        ship.vy = (ship.vy / speed) * SHIP.maxSpeed;
      }
    }
    if (dash && ship.dashCooldown <= 0 && ship.dashTime <= 0) {
      let dx = steer.x;
      let dy = steer.y;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(ship.angle);
        dy = Math.sin(ship.angle);
      }
      const len = Math.hypot(dx, dy) || 1;
      ship.vx = (dx / len) * SHIP.dashSpeed;
      ship.vy = (dy / len) * SHIP.dashSpeed;
      ship.dashTime = SHIP.dashTime;
      ship.dashCooldown = SHIP.dashCooldown;
      ship.invulnerable = Math.max(ship.invulnerable, SHIP.dashTime + 0.08);
      events |= EVENT_DASH;
      burst(ship.x, ship.y, '#22d3ee', 10, 160);
    }
    ship.dashCooldown = Math.max(0, ship.dashCooldown - dt);
    ship.invulnerable = Math.max(0, ship.invulnerable - dt);
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    ship.x = Math.max(SHIP.radius, Math.min(FIELD.width - SHIP.radius, ship.x));
    ship.y = Math.max(SHIP.radius, Math.min(FIELD.height - SHIP.radius, ship.y));
    if (Math.hypot(ship.vx, ship.vy) > 40) {
      ship.angle = Math.atan2(ship.vy, ship.vx);
    }

    // Engine trail: a fading ribbon behind the skiff.
    state.trail.push({ x: ship.x, y: ship.y, life: 0.35, maxLife: 0.35 });
    if (state.trail.length > 26) state.trail.shift();
    for (const dot of state.trail) dot.life -= dt;
    state.trail = state.trail.filter((dot) => dot.life > 0);

    // --- Entities drift ---------------------------------------------------
    for (const s of state.shards) {
      s.y += s.vy * dt;
      s.x += s.vx * dt + Math.sin(state.time * 2 + s.pulse) * 12 * dt;
      s.spin += s.spinSpeed * dt;
      s.pulse += dt;
    }
    for (const m of state.mines) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.spin += m.spinSpeed * dt;
      m.pulse += dt;
    }
    for (const s of state.storms) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += s.spinSpeed * dt;
    }
    for (const s of state.shields) {
      s.y += s.vy * dt;
      s.pulse += dt;
    }
    const offscreen = (e) => e.y > FIELD.height + 40 || e.y < -60 || e.x < -60 || e.x > FIELD.width + 60;
    state.shards = state.shards.filter((e) => !offscreen(e));
    state.mines = state.mines.filter((e) => !offscreen(e));
    state.storms = state.storms.filter((e) => !offscreen(e));
    state.shields = state.shields.filter((e) => !offscreen(e));

    // --- Particles --------------------------------------------------------
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    state.flashes = Math.max(0, state.flashes - dt * 3);

    // --- Pickups ----------------------------------------------------------
    const collect = (list, radius, onCollect) => {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const e = list[i];
        if (Math.hypot(e.x - ship.x, e.y - ship.y) < radius + e.radius) {
          list.splice(i, 1);
          onCollect(e);
        }
      }
    };
    collect(state.shards, SHIP.radius, (e) => {
      state.comboCount += 1;
      state.combo = Math.min(COMBO_MAX, 1 + Math.floor(state.comboCount / 3));
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const gained = SHARD_POINTS * state.combo;
      state.score += gained;
      state.level = levelFor(state.score);
      state.gateProgress = Math.min(1, state.score / WIN_SCORE);
      burst(e.x, e.y, '#fbbf24', 12, 200);
      events |= EVENT_PICKUP;
      if (state.score >= WIN_SCORE && !state.gateOpen) {
        state.gateOpen = true;
        events |= EVENT_WIN;
      }
    });
    collect(state.shields, SHIP.radius, (e) => {
      state.shield = true;
      burst(e.x, e.y, '#34d399', 14, 180);
      events |= EVENT_SHIELD;
    });

    // --- Hits -------------------------------------------------------------
    const hitBy = (list) => {
      if (ship.invulnerable > 0) return false;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const e = list[i];
        if (Math.hypot(e.x - ship.x, e.y - ship.y) < SHIP.radius * 0.8 + e.radius * 0.85) {
          list.splice(i, 1);
          return true;
        }
      }
      return false;
    };
    const hit = hitBy(state.mines) || hitBy(state.storms);
    if (hit) {
      state.combo = 0;
      state.comboCount = 0;
      state.flashes = 1;
      burst(ship.x, ship.y, '#f472b6', 22, 320);
      if (state.shield) {
        state.shield = false;
        ship.invulnerable = SHIP.invulnerableTime;
        events |= EVENT_SHIELD;
      } else {
        state.hearts -= 1;
        ship.invulnerable = SHIP.invulnerableTime;
        events |= EVENT_HIT;
        if (state.hearts <= 0) events |= EVENT_OVER;
      }
    }

    return events;
  }

  return { state, reset, step, burst };
}
