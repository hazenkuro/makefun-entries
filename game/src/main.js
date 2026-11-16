// Lumen Drift — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, game over and win.
//
// ?seed=N fixes the storm's pattern. ?shot=start|play|end|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot. ?debug=win starts a live
// game one shard away from the Aurora Gate, for testing the win path.
import { BEST_KEY, STEP, WIN_SCORE } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_DASH, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_SHIELD, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Debug hook for testing the win path: one shard from the gate.
  if (params.get('debug') === 'win') {
    world.state.score = WIN_SCORE - 10;
    world.state.gateProgress = (WIN_SCORE - 10) / WIN_SCORE;
    screen = SCREEN_PLAY;
  }

  function announce(text) {
    status.textContent = text;
  }

  function startGame() {
    world.reset();
    screen = SCREEN_PLAY;
    input.clearPressed();
    audio.unlock();
    audio.click();
    announce('Lumen Drift started. Collect star shards, dodge the mines.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    else audio.over();
    announce(won
      ? `You win! Aurora Gate open with ${world.state.score} points.`
      : `Game over. Score ${world.state.score}. Press R to drift again.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    window.__lumen.screenName = screen;
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;

    if (input.consume(ACTION_MUTE)) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE) {
      // The title floats over a live drifting field.
      world.step(STEP, { x: 0, y: 0 }, null, false);
      if (input.consume(ACTION_CONFIRM) || input.consume(ACTION_RESTART)) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (input.consume(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
        announce('Paused. Press P to resume.');
      } else {
        const dash = input.consume(ACTION_DASH);
        accumulator += elapsed;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const events = world.step(STEP, input.steer(), input.pointer(), dash);
          if (events & EVENT_PICKUP) audio.pickup(world.state.combo);
          if (events & EVENT_DASH) audio.dash();
          if (events & EVENT_SHIELD) audio.shield();
          if (events & EVENT_HIT) audio.hit();
          if (events & EVENT_WIN) { endGame(true); break; }
          if (events & EVENT_OVER) { endGame(false); break; }
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.consume(ACTION_PAUSE) || input.consume(ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        input.clearPressed();
        announce('Resumed.');
      } else if (input.consume(ACTION_RESTART)) {
        startGame();
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (input.consume(ACTION_RESTART) || input.consume(ACTION_CONFIRM)) startGame();
    }

    renderer.draw(world.state, screen, best);
  }

  announce('Lumen Drift. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}

// Expose the live state for automated play-testing (harmless in play).
// `screen` is a window global, so the current screen lives under
// `screenName` instead; the frame loop below keeps it up to date.
window.__lumen = {
  state: world.state,
  screenName: SCREEN_TITLE,
};

if (shot) runShot(shot);
else runGame();
