// Keyboard and mouse: WASD or arrows to move, Shift to sneak, click to toss
// a pebble, Space or Enter to confirm, P or Escape to pause, M to mute,
// R to restart after being caught or escaping.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let click = null;

  function onKeyDown(event) {
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    }
    held.add(event.code);
    if (MOVE_KEYS[event.code] || event.code === 'ShiftLeft' || event.code === 'ShiftRight') event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
  }

  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 704,
    };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('click', onClick);

  return {
    /** The movement vector for this frame, from the keys held down. */
    direction() {
      let dx = 0;
      let dy = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          dx += move[0];
          dy += move[1];
        }
      }
      return {
        dx,
        dy,
        sneak: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
    /** The last mouse click in world coordinates, if any since last read. */
    takeClick() {
      const point = click;
      click = null;
      return point;
    },
    /** One-shot actions (confirm, pause, mute, restart) since last read. */
    takeActions() {
      const value = actions;
      actions = 0;
      return value;
    },
  };
}
