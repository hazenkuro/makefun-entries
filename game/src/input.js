// Lumen Drift — keyboard and mouse input. Arrows/WASD steer, Space or a
// click dashes, P pauses, R restarts, M mutes, Enter/click confirms. The
// pointer also steers: holding the mouse down pulls the skiff toward it.
// Input is polled each frame, and one-shot actions (dash, pause, restart)
// are edge-triggered so holding a key does not repeat them.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MUTE = 'mute';
export const ACTION_DASH = 'dash';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_DASH,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const pointer = { x: 0, y: 0, down: false, active: false };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(KEY_ACTIONS[event.code] ?? event.code);
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }

  function onPointerDown(event) {
    pointerPosition(event);
    pointer.down = true;
    pointer.active = true;
    // A click confirms on menus and dashes in play; startGame() drains
    // the queue on launch, so a launch click never dashes by accident.
    pressed.add(ACTION_CONFIRM);
    pressed.add(ACTION_DASH);
  }

  function onPointerUp() {
    pointer.down = false;
  }

  function onPointerMove(event) {
    pointerPosition(event);
    pointer.active = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);

  return {
    // Steering vector from keys, normalised (-1..1 on each axis).
    steer() {
      let x = 0;
      let y = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    // Where the pointer is, and whether it is steering right now.
    pointer() {
      return pointer;
    },
    // True once for each press of the named action since the last poll.
    consume(action) {
      if (pressed.has(action)) {
        pressed.delete(action);
        return true;
      }
      return false;
    },
    // Drain one-shot presses (used when changing screens).
    clearPressed() {
      pressed.clear();
    },
  };
}
