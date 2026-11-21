// The game state: Pip, the wardens, the moon gems and the gate.
// Pure logic, no drawing and no DOM: the same step runs in the browser and
// in the screenshot stager, so a staged frame is a real game frame.

import { FIELD, GEMS_NEEDED, GUARD, PEBBLE, PLAYER, STEP, TILE } from './config.js';
import { createGuard, distractGuards, stepGuard } from './guards.js';
import { circleFits, GUARD_PATROLS, isBushTile, isShadowTile, parseLevel } from './level.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_ALERT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_PEBBLE = 16;

export function createWorld(seed) {
  const level = parseLevel();
  const world = {
    seed,
    level,
    guards: GUARD_PATROLS.map((patrol, index) => createGuard(patrol, index)),
    player: null,
    gems: level.gems.map((gem) => ({ ...gem })),
    pebblesLeft: PEBBLE.count,
    pebbles: [],
    time: 0,
    won: false,
    caught: false,
    gateOpen: false,
    maxSuspicion: 0,
  };
  resetWorld(world);
  return world;
}

export function resetWorld(world) {
  const { level } = world;
  world.player = {
    x: (level.start.col + 0.5) * TILE,
    y: (level.start.row + 0.5) * TILE,
    angle: 0,
    moving: false,
    sneaking: false,
    hidden: false,
    inShadow: false,
  };
  world.gems = level.gems.map((gem) => ({ ...gem }));
  world.pebblesLeft = PEBBLE.count;
  world.pebbles = [];
  world.time = 0;
  world.won = false;
  world.caught = false;
  world.gateOpen = false;
  world.maxSuspicion = 0;
  world.guards = GUARD_PATROLS.map((patrol, index) => createGuard(patrol, index));
}

function playerTile(world) {
  return {
    col: Math.floor(world.player.x / TILE),
    row: Math.floor(world.player.y / TILE),
  };
}

/** Is Pip hidden right now: inside a lantern bush, or flat in a shadow bed. */
export function updateHidden(world) {
  const { col, row } = playerTile(world);
  const inBush = isBushTile(world.level, col, row);
  const inShadow = isShadowTile(world.level, col, row);
  world.player.hidden = inBush;
  world.player.inShadow = inShadow && !inBush;
}

/**
 * One fixed step. `input` is { dx, dy, sneak } with dx/dy in [-1, 1];
 * `throwAt` is a world point to toss a pebble at, or null.
 * Returns an event bitmask (EVENT_*).
 */
export function stepWorld(world, input, throwAt) {
  if (world.won || world.caught) return EVENT_NONE;
  let events = EVENT_NONE;
  const player = world.player;
  world.time += STEP;

  // Throwing a pebble: it lands where the mouse points, within range.
  if (throwAt && world.pebblesLeft > 0) {
    const dx = throwAt.x - player.x;
    const dy = throwAt.y - player.y;
    const distance = Math.hypot(dx, dy);
    const range = Math.min(distance, PEBBLE.throwRange);
    const lx = player.x + (distance > 0 ? (dx / distance) * range : 0);
    const ly = player.y + (distance > 0 ? (dy / distance) * range : 0);
    world.pebbles.push({ x: lx, y: ly, age: 0 });
    world.pebblesLeft -= 1;
    distractGuards(world.guards, lx, ly);
    events |= EVENT_PEBBLE;
  }
  for (const pebble of world.pebbles) pebble.age += STEP;
  world.pebbles = world.pebbles.filter((pebble) => pebble.age < 1.2);

  // Move Pip, sliding along hedge walls.
  const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const length = Math.hypot(input.dx, input.dy);
  player.moving = length > 0.01;
  player.sneaking = Boolean(input.sneak) && player.moving;
  if (player.moving) {
    const nx = input.dx / length;
    const ny = input.dy / length;
    player.angle = Math.atan2(ny, nx);
    const step = speed * STEP;
    const tryX = player.x + nx * step;
    const tryY = player.y + ny * step;
    if (circleFits(world.level, tryX, player.y, PLAYER.radius)) player.x = tryX;
    if (circleFits(world.level, player.x, tryY, PLAYER.radius)) player.y = tryY;
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y));
  }
  updateHidden(world);

  // The wardens watch, suspect and chase.
  const guardEvents = { alerted: false, caught: false };
  for (const guard of world.guards) {
    stepGuard(world.level, guard, player, STEP, guardEvents);
    world.maxSuspicion = Math.max(world.maxSuspicion, guard.suspicion);
  }
  if (guardEvents.alerted) events |= EVENT_ALERT;
  if (guardEvents.caught) {
    world.caught = true;
    return events | EVENT_CAUGHT;
  }

  // Moon gems: close enough and Pip pockets one.
  for (const gem of world.gems) {
    if (gem.taken) continue;
    const gx = (gem.col + 0.5) * TILE;
    const gy = (gem.row + 0.5) * TILE;
    if (Math.hypot(player.x - gx, player.y - gy) < 26) {
      gem.taken = true;
      events |= EVENT_PICKUP;
    }
  }
  const taken = world.gems.filter((gem) => gem.taken).length;
  if (taken >= GEMS_NEEDED) world.gateOpen = true;

  // The gate: step through it once it stands open.
  if (world.gateOpen && world.level.exit) {
    const ex = (world.level.exit.col + 0.5) * TILE;
    const ey = (world.level.exit.row + 0.5) * TILE;
    if (Math.hypot(player.x - ex, player.y - ey) < 28) {
      world.won = true;
      events |= EVENT_WIN;
    }
  }
  return events;
}

/** How many moon gems Pip has pocketed. */
export function gemsTaken(world) {
  return world.gems.filter((gem) => gem.taken).length;
}

/** The highest suspicion any warden holds right now, 0..100. */
export function currentDanger(world) {
  return world.guards.reduce((max, guard) => Math.max(max, guard.suspicion), 0);
}
