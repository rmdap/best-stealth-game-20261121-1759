// The screenshot scenes behind ?shot=title|play|alert|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a cautious autopilot that sneaks from gem to gem and waits out a
// warden's cone rather than walking into it, so the frame is what a real
// game looks like and the same seed always gives the same frame.

import { STEP, TILE } from './config.js';
import { GUARD_ALERT } from './guards.js';
import { guardCanSee } from './guards.js';
import { findPath } from './guards.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { gemsTaken, resetWorld, stepWorld } from './world.js';

const SAMPLE = STEP;
const TITLE_SECONDS = 4;
const PLAY_SECONDS = 14;
const WIN_LIMIT_SECONDS = 200;
const ALERT_LIMIT_SECONDS = 40;

/** The route Pip sneaks: the near gem, the low gem, the far gem, then the gate. */
function routeTargets(world) {
  const gems = [...world.gems].sort((a, b) => {
    const da = Math.abs(a.col - 1) + Math.abs(a.row - 1);
    const db = Math.abs(b.col - 1) + Math.abs(b.row - 1);
    return da - db;
  });
  const targets = gems.map((gem) => [gem.col, gem.row]);
  targets.push([world.level.exit.col, world.level.exit.row]);
  return targets;
}

function tileCentre(col, row) {
  return [(col + 0.5) * TILE, (row + 0.5) * TILE];
}

function tileOf(x, y) {
  return [Math.floor(x / TILE), Math.floor(y / TILE)];
}

function isHiddenTile(world, x, y) {
  const [col, row] = tileOf(x, y);
  return world.level.bushes.has(`${col},${row}`) || world.level.shadows.has(`${col},${row}`);
}

/** Would any warden see Pip standing at (x, y) right now? */
function seenAt(world, x, y) {
  if (isHiddenTile(world, x, y)) return false;
  for (const guard of world.guards) {
    if (guardCanSee(world.level, guard, x, y)) return true;
    if (Math.hypot(guard.x - x, guard.y - y) < 55) return true;
  }
  return false;
}

/**
 * The autopilot: sneak along a path to the current target, waiting where a
 * cone covers the next step, and pushing on when already seen. Returns the
 * input for one step and mutates `pilot` (its path and target).
 */
function autopilot(world, pilot) {
  const player = world.player;
  // Advance past targets already reached (gem taken, or standing on the tile).
  while (pilot.targetIndex < pilot.targets.length) {
    const [tc, tr] = pilot.targets[pilot.targetIndex];
    const gem = world.gems.find((g) => g.col === tc && g.row === tr);
    if (gem && gem.taken) {
      pilot.targetIndex += 1;
      pilot.path = [];
      continue;
    }
    const [tx, ty] = tileCentre(tc, tr);
    if (Math.hypot(player.x - tx, player.y - ty) < 20) {
      pilot.targetIndex += 1;
      pilot.path = [];
      continue;
    }
    break;
  }
  if (pilot.targetIndex >= pilot.targets.length) return { dx: 0, dy: 0, sneak: true };

  const [tc, tr] = pilot.targets[pilot.targetIndex];
  pilot.repath -= 1;
  if (pilot.path.length === 0 || pilot.repath <= 0) {
    const [pc, pr] = tileOf(player.x, player.y);
    pilot.path = findPath(world.level, pc, pr, tc, tr);
    pilot.repath = 30;
  }
  if (pilot.path.length === 0) return { dx: 0, dy: 0, sneak: true };

  const [wx, wy] = pilot.path[0];
  if (Math.hypot(player.x - wx, player.y - wy) < 8) {
    pilot.path.shift();
    return { dx: 0, dy: 0, sneak: true };
  }
  const dx = wx - player.x;
  const dy = wy - player.y;
  const length = Math.hypot(dx, dy);
  const step = 92 * SAMPLE;
  const candX = player.x + (dx / length) * step;
  const candY = player.y + (dy / length) * step;
  const currentlySeen = seenAt(world, player.x, player.y);
  // A cone covers the next step and nobody sees Pip yet: wait it out.
  if (!currentlySeen && seenAt(world, candX, candY)) return { dx: 0, dy: 0, sneak: true };
  return { dx: dx / length, dy: dy / length, sneak: true };
}

function freshPilot(world) {
  return { targets: routeTargets(world), targetIndex: 0, path: [], repath: 0 };
}

/**
 * Set `world` to the named scene (title, play, alert or win; any other name
 * is title) and return the screen to draw over it and the best time to show.
 */
export function stageShot(name, world) {
  resetWorld(world);
  if (name !== 'play' && name !== 'alert' && name !== 'win') {
    for (let i = 0; i < TITLE_SECONDS / SAMPLE; i += 1) stepWorld(world, { dx: 0, dy: 0, sneak: false }, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'alert') {
    // Walk Pip into the open in front of the first warden and hold still
    // there until the lantern finds him: the frame catches the chase.
    for (let i = 0; i < ALERT_LIMIT_SECONDS / SAMPLE; i += 1) {
      const guard = world.guards[0];
      const frontX = guard.x + Math.cos(guard.angle) * 120;
      const frontY = guard.y + Math.sin(guard.angle) * 120;
      const [col, row] = tileOf(frontX, frontY);
      if (!world.level.walls.has(`${col},${row}`) && !world.level.bushes.has(`${col},${row}`)) {
        world.player.x = Math.min(1260, Math.max(20, frontX));
        world.player.y = Math.min(684, Math.max(20, frontY));
      }
      stepWorld(world, { dx: 0, dy: 0, sneak: false }, null);
      if (world.guards.some((g) => g.state === GUARD_ALERT)) break;
      if (world.caught) break;
    }
    return { screen: world.caught ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
  }

  const pilot = freshPilot(world);
  const limit = name === 'win' ? WIN_LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / SAMPLE; i += 1) {
    stepWorld(world, autopilot(world, pilot), null);
    if (world.won || world.caught) break;
  }
  if (name === 'win') return { screen: world.won ? SCREEN_WIN : SCREEN_PLAY, best: world.won ? world.time : 0 };
  return { screen: world.caught ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
}
