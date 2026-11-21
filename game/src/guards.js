// The lantern wardens: patrol, watch, suspect, chase, investigate.
// A guard's eye is a cone clipped by hedge walls; its suspicion (0..100)
// fills while it can see Pip and drains when it cannot. Bushes and shadow
// beds hide Pip outright. At 100 the guard gives chase; lose sight of Pip
// for a while and it goes back to its patrol, still wary.

import { GUARD, TILE } from './config.js';
import { hasLineOfSight, isWallTile } from './level.js';

export const GUARD_CALM = 'calm';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_INVESTIGATE = 'investigate';

/** Breadth-first path over walkable tiles, as a list of tile centres. */
export function findPath(level, fromCol, fromRow, toCol, toRow) {
  const key = (c, r) => `${c},${r}`;
  const start = key(fromCol, fromRow);
  const goal = key(toCol, toRow);
  if (start === goal) return [];
  const cameFrom = new Map([[start, null]]);
  const queue = [[fromCol, fromRow]];
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    for (const [nc, nr] of [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ]) {
      if (cameFrom.has(key(nc, nr)) || isWallTile(level, nc, nr)) continue;
      cameFrom.set(key(nc, nr), [c, r]);
      if (key(nc, nr) === goal) {
        const path = [];
        let at = [nc, nr];
        while (at) {
          path.unshift([(at[0] + 0.5) * TILE, (at[1] + 0.5) * TILE]);
          at = cameFrom.get(key(at[0], at[1]));
        }
        return path.slice(1);
      }
      queue.push([nc, nr]);
    }
  }
  return [];
}

export function createGuard(patrol, index) {
  const [startCol, startRow] = patrol.waypoints[0];
  return {
    name: patrol.name,
    index,
    waypoints: patrol.waypoints,
    waypointIndex: 1,
    x: (startCol + 0.5) * TILE,
    y: (startRow + 0.5) * TILE,
    angle: 0,
    state: GUARD_CALM,
    suspicion: 0,
    pauseLeft: 0,
    loseSightLeft: 0,
    investigateLeft: 0,
    investigateX: 0,
    investigateY: 0,
    path: [],
    pathTarget: null,
    scanAngle: 0,
  };
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Can this guard see the point (x, y) right now? Bushes block sight too. */
export function guardCanSee(level, guard, x, y) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.sightRange) return false;
  if (distance > 4 && Math.abs(angleDifference(Math.atan2(dy, dx), guard.angle)) > GUARD.sightHalfAngle) return false;
  if (!hasLineOfSight(level, guard.x, guard.y, x, y)) return false;
  // A lantern bush between guard and target breaks the line of sight.
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i < steps; i += 1) {
    const bx = Math.floor((guard.x + (dx * i) / steps) / TILE);
    const by = Math.floor((guard.y + (dy * i) / steps) / TILE);
    if (level.bushes.has(`${bx},${by}`)) return false;
  }
  return true;
}

/** How fast suspicion fills for a seen player: nearer and standing is worse. */
export function detectionRate(guard, player, hidden) {
  if (hidden) return 0;
  const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
  const closeness = 1 - distance / GUARD.sightRange;
  const rate = GUARD.detectFar + (GUARD.detectNear - GUARD.detectFar) * closeness;
  return player.sneaking ? rate * GUARD.sneakFactor : rate;
}

/** Walk toward (tx, ty) at `speed`, sliding along hedge walls. */
function moveToward(level, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  const step = Math.min(distance, speed * dt);
  const nx = guard.x + (dx / distance) * step;
  const ny = guard.y + (dy / distance) * step;
  const r = 12;
  if (!isWallTile(level, Math.floor(nx / TILE), Math.floor(guard.y / TILE)) && !isWallTile(level, Math.floor((nx + Math.sign(dx) * r) / TILE), Math.floor(guard.y / TILE))) guard.x = nx;
  if (!isWallTile(level, Math.floor(guard.x / TILE), Math.floor(ny / TILE)) && !isWallTile(level, Math.floor(guard.x / TILE), Math.floor((ny + Math.sign(dy) * r) / TILE))) guard.y = ny;
  guard.angle = angleTo(guard.x, guard.y, tx, ty);
  return distance <= speed * dt + 1;
}

/** Follow a tile path; returns true when the end is reached. */
function followPath(level, guard, speed, dt) {
  if (guard.path.length === 0) return true;
  const [tx, ty] = guard.path[0];
  if (moveToward(level, guard, tx, ty, speed, dt)) guard.path.shift();
  return guard.path.length === 0;
}

function setPath(level, guard, toCol, toRow) {
  const fromCol = Math.floor(guard.x / TILE);
  const fromRow = Math.floor(guard.y / TILE);
  guard.path = findPath(level, fromCol, fromRow, toCol, toRow);
  guard.pathTarget = [toCol, toRow];
}

/** One guard, one fixed step. `player` carries x, y, sneaking and hidden. */
export function stepGuard(level, guard, player, dt, events) {
  const seesPlayer = guardCanSee(level, guard, player.x, player.y);
  const hidden = player.hidden;
  if (seesPlayer && !hidden) {
    guard.suspicion = Math.min(100, guard.suspicion + detectionRate(guard, player, false) * dt);
    guard.loseSightLeft = GUARD.loseSightSeconds;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.detectDecay * dt);
    guard.loseSightLeft -= dt;
  }

  if (guard.suspicion >= 100 && guard.state !== GUARD_ALERT) {
    guard.state = GUARD_ALERT;
    events.alerted = true;
  }

  if (guard.state === GUARD_ALERT) {
    if (seesPlayer && !hidden) {
      moveToward(level, guard, player.x, player.y, GUARD.chaseSpeed, dt);
      if (Math.hypot(player.x - guard.x, player.y - guard.y) <= 26) events.caught = true;
    } else if (guard.loseSightLeft > 0) {
      moveToward(level, guard, player.x, player.y, GUARD.chaseSpeed * 0.8, dt);
    } else {
      guard.state = GUARD_SUSPICIOUS;
      guard.suspicion = 60;
      setPath(level, guard, Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    }
    return;
  }

  if (guard.state === GUARD_INVESTIGATE) {
    guard.investigateLeft -= dt;
    if (!guard.pathTarget) {
      setPath(level, guard, Math.floor(guard.investigateX / TILE), Math.floor(guard.investigateY / TILE));
    }
    if (followPath(level, guard, GUARD.investigateSpeed, dt) || guard.investigateLeft <= 0) {
      guard.state = GUARD_SUSPICIOUS;
      guard.suspicion = Math.max(guard.suspicion, 35);
      const [wc, wr] = guard.waypoints[guard.waypointIndex];
      setPath(level, guard, wc, wr);
    }
    return;
  }

  // Calm or suspicious: walk the patrol loop, pausing at each waypoint.
  if (guard.suspicion >= 45) guard.state = GUARD_SUSPICIOUS;
  else if (guard.suspicion <= 5) guard.state = GUARD_CALM;

  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    // Look around while waiting: a slow sweep of the lantern.
    guard.scanAngle += dt * 0.9;
    guard.angle += Math.sin(guard.scanAngle) * dt * 0.55;
    return;
  }
  if (!guard.pathTarget) {
    const [wc, wr] = guard.waypoints[guard.waypointIndex];
    setPath(level, guard, wc, wr);
  }
  const speed = guard.state === GUARD_SUSPICIOUS ? GUARD.patrolSpeed * 1.35 : GUARD.patrolSpeed;
  if (followPath(level, guard, speed, dt)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pathTarget = null;
    guard.pauseLeft = GUARD.pauseAtWaypoint;
  }
}

/** A pebble lands: every guard close enough goes to look. */
export function distractGuards(guards, x, y) {
  for (const guard of guards) {
    if (guard.state === GUARD_ALERT) continue;
    if (Math.hypot(guard.x - x, guard.y - y) <= 210) {
      guard.state = GUARD_INVESTIGATE;
      guard.investigateX = x;
      guard.investigateY = y;
      guard.investigateLeft = GUARD.investigateSeconds;
      guard.path = [];
      guard.pathTarget = null;
    }
  }
}
