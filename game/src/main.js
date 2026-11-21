// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, win and caught.
//
// ?seed=N fixes the garden's decoration. ?shot=title|play|alert|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_PICKUP, EVENT_PEBBLE, EVENT_WIN, resetWorld, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas, seed);

function readBest() {
  try {
    return Number.parseFloat(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, performance.now());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const audio = createAudio();
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepSoundIn = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetWorld(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Slip past the wardens, pocket three moon gems, and leave by the gate.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_CAUGHT;
    if (won) {
      audio.win();
      if (best === 0 || world.time < best) {
        best = world.time;
        saveBest(best);
      }
      announce(`Escaped unseen in ${Math.round(world.time)} seconds.`);
    } else {
      audio.caught();
      announce('Caught by a warden. Press R to try again.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_WIN || screen === SCREEN_CAUGHT)) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_CAUGHT)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      stepWorld(world, { dx: 0, dy: 0, sneak: false }, null);
      return;
    }
    const click = input.takeClick();
    const events = stepWorld(world, input.direction(), click);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PEBBLE) audio.pebble();
    if (events & EVENT_ALERT) audio.alert();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
    // Footsteps patter while Pip moves, softer while sneaking.
    const player = world.player;
    if (player.moving && screen === SCREEN_PLAY) {
      stepSoundIn -= STEP;
      if (stepSoundIn <= 0) {
        audio.footstep(player.sneaking);
        stepSoundIn = player.sneaking ? 0.42 : 0.3;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best, now);
  }

  // Leaving the tab pauses a running game rather than letting wardens patrol unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lantern Shadows. Press Space or click to slip in.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
