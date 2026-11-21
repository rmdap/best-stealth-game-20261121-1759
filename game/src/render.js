// Everything the eye sees: the moonlit garden, the wardens' lantern cones,
// Pip the fox-thief, the moon gems, the gate, and the HUD. The canvas is a
// fixed 1280x704 logical area scaled to the window; the game logic never
// learns the window size.

import { FIELD, FONT, GEMS_NEEDED, GUARD, PALETTE, TILE } from './config.js';
import { GUARD_ALERT, GUARD_INVESTIGATE, GUARD_SUSPICIOUS } from './guards.js';
import { createRandom } from './random.js';
import { currentDanger, gemsTaken } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

const CONE_RAYS = 26;

export function createRenderer(canvas, seed) {
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = FIELD.width;
  dark.height = FIELD.height;
  const darkCtx = dark.getContext('2d');

  // The garden's freckles: grass blades, pebbles and petals, fixed per seed.
  const random = createRandom(seed);
  const speckles = [];
  for (let i = 0; i < 520; i += 1) {
    speckles.push({
      x: random.next() * FIELD.width,
      y: random.next() * FIELD.height,
      r: 1 + random.next() * 2.2,
      shade: random.pick(['#24402f', '#1a2f23', '#2a4a35', '#223a2c']),
    });
  }
  const petals = [];
  for (let i = 0; i < 26; i += 1) {
    petals.push({
      x: random.next() * FIELD.width,
      y: random.next() * FIELD.height,
      r: 2 + random.next() * 2,
      drift: random.next() * Math.PI * 2,
    });
  }

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.round(FIELD.width * scale);
    canvas.height = Math.round(FIELD.height * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }

  function drawFloor(level) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const speckle of speckles) {
      ctx.fillStyle = speckle.shade;
      ctx.beginPath();
      ctx.arc(speckle.x, speckle.y, speckle.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shadow beds: still, dark pools where the eye slides off.
    ctx.fillStyle = PALETTE.shadowBed;
    for (const key of level.shadows) {
      const [col, row] = key.split(',').map(Number);
      ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, TILE - 2);
    }
    // Petals drift on the wind.
    ctx.fillStyle = 'rgba(240, 210, 180, 0.5)';
    for (const petal of petals) {
      ctx.beginPath();
      ctx.arc(petal.x, petal.y, petal.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHedges(level) {
    for (const key of level.walls) {
      const [col, row] = key.split(',').map(Number);
      const x = col * TILE;
      const y = row * TILE;
      ctx.fillStyle = PALETTE.hedge;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.hedgeTop;
      ctx.fillRect(x + 2, y + 2, TILE - 4, 10);
      ctx.fillStyle = PALETTE.hedgeDot;
      ctx.beginPath();
      ctx.arc(x + 9, y + 20, 3, 0, Math.PI * 2);
      ctx.arc(x + 22, y + 25, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 16, y + 12, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBushes(level, time) {
    for (const key of level.bushes) {
      const [col, row] = key.split(',').map(Number);
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      const sway = Math.sin(time / 900 + col * 1.7 + row) * 1.5;
      ctx.fillStyle = PALETTE.bushDark;
      ctx.beginPath();
      ctx.arc(cx + sway, cy, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bush;
      ctx.beginPath();
      ctx.arc(cx - 6 + sway, cy - 3, 10, 0, Math.PI * 2);
      ctx.arc(cx + 7 + sway, cy + 2, 11, 0, Math.PI * 2);
      ctx.arc(cx + sway, cy - 8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bushLeaf;
      ctx.beginPath();
      ctx.arc(cx - 5 + sway, cy - 6, 3.5, 0, Math.PI * 2);
      ctx.arc(cx + 8 + sway, cy - 2, 3, 0, Math.PI * 2);
      ctx.arc(cx + sway, cy + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** The cone's edge, clipped where a hedge or bush stops the lantern light. */
  function coneEdge(level, guard, angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let distance = GUARD.sightRange;
    for (let d = 8; d <= GUARD.sightRange; d += 8) {
      const x = guard.x + dx * d;
      const y = guard.y + dy * d;
      const col = Math.floor(x / TILE);
      const row = Math.floor(y / TILE);
      if (level.walls.has(`${col},${row}`) || level.bushes.has(`${col},${row}`)) {
        distance = d;
        break;
      }
    }
    return [guard.x + dx * distance, guard.y + dy * distance];
  }

  function drawCones(level, guards) {
    for (const guard of guards) {
      const alerted = guard.state === GUARD_ALERT;
      const suspicious = guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_INVESTIGATE;
      ctx.fillStyle = alerted ? PALETTE.coneAlert : suspicious ? PALETTE.coneSuspicious : PALETTE.coneCalm;
      ctx.strokeStyle = alerted ? 'rgba(255, 90, 78, 0.6)' : PALETTE.coneCalmEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      for (let i = 0; i <= CONE_RAYS; i += 1) {
        const angle = guard.angle - GUARD.sightHalfAngle + ((GUARD.sightHalfAngle * 2 * i) / CONE_RAYS);
        const [x, y] = coneEdge(level, guard, angle);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawGems(world, time) {
    for (const gem of world.gems) {
      if (gem.taken) continue;
      const x = (gem.col + 0.5) * TILE;
      const y = (gem.row + 0.5) * TILE;
      const pulse = 0.75 + Math.sin(time / 350 + gem.col) * 0.25;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 30);
      glow.addColorStop(0, `rgba(127, 231, 255, ${0.5 * pulse})`);
      glow.addColorStop(1, 'rgba(127, 231, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time / 600 + gem.row) * 0.3);
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawExit(world, time) {
    const exit = world.level.exit;
    if (!exit) return;
    const x = (exit.col + 0.5) * TILE;
    const y = (exit.row + 0.5) * TILE;
    const open = world.gateOpen;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, open ? 64 : 30);
    glow.addColorStop(0, open ? 'rgba(255, 214, 107, 0.55)' : 'rgba(138, 143, 152, 0.25)');
    glow.addColorStop(1, 'rgba(255, 214, 107, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, open ? 64 : 30, 0, Math.PI * 2);
    ctx.fill();
    // Two posts and an arch: the garden gate.
    ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    ctx.fillRect(x - 18, y - 16, 5, 32);
    ctx.fillRect(x + 13, y - 16, 5, 32);
    ctx.beginPath();
    ctx.arc(x, y - 14, 18, Math.PI, 0);
    ctx.lineWidth = 5;
    ctx.strokeStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    ctx.stroke();
    if (!open) {
      ctx.strokeStyle = '#5a5e66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 13, y - 8);
      ctx.lineTo(x + 13, y + 8);
      ctx.moveTo(x + 13, y - 8);
      ctx.lineTo(x - 13, y + 8);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3a2f10';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', x, y + 26);
    }
  }

  function drawPebbles(world) {
    for (const pebble of world.pebbles) {
      const fade = 1 - pebble.age / 1.2;
      ctx.fillStyle = `rgba(220, 220, 210, ${0.9 * fade})`;
      ctx.beginPath();
      ctx.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 214, 107, ${0.6 * fade})`;
      ctx.beginPath();
      ctx.arc(pebble.x, pebble.y, 8 + pebble.age * 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGuard(guard) {
    const alerted = guard.state === GUARD_ALERT;
    // Lantern glow around the warden.
    const glow = ctx.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, 46);
    glow.addColorStop(0, alerted ? 'rgba(255, 90, 78, 0.35)' : 'rgba(255, 214, 107, 0.30)');
    glow.addColorStop(1, 'rgba(255, 214, 107, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 46, 0, Math.PI * 2);
    ctx.fill();
    // Body: a navy cloak with a brass-trimmed helmet.
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardTrim;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, guard.angle - 1.1, guard.angle + 1.1);
    ctx.lineTo(guard.x, guard.y);
    ctx.closePath();
    ctx.fill();
    // The lantern, held out in front.
    const lx = guard.x + Math.cos(guard.angle) * 18;
    const ly = guard.y + Math.sin(guard.angle) * 18;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6d1f';
    ctx.fillRect(lx - 5, ly - 8, 10, 3);
    // "?" while wary, "!" while chasing.
    if (alerted || guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_INVESTIGATE) {
      ctx.fillStyle = alerted ? PALETTE.danger : '#ffcf4d';
      ctx.font = `bold 22px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - 24);
    }
  }

  function drawPlayer(world, time) {
    const player = world.player;
    const r = player.sneaking ? 11 : 13;
    // Tail, trailing behind the direction of travel.
    const tailX = player.x - Math.cos(player.angle) * 14;
    const tailY = player.y - Math.sin(player.angle) * 14;
    ctx.fillStyle = '#c96a28';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(player.x - Math.cos(player.angle + 0.5) * 20, player.y - Math.sin(player.angle + 0.5) * 20);
    ctx.lineTo(player.x - Math.cos(player.angle - 0.5) * 20, player.y - Math.sin(player.angle - 0.5) * 20);
    ctx.closePath();
    ctx.fill();
    // Body.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Belly patch and ears.
    ctx.fillStyle = PALETTE.playerBelly;
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      const earAngle = player.angle + side * 0.6;
      const ex = player.x + Math.cos(earAngle) * (r - 2);
      const ey = player.y + Math.sin(earAngle) * (r - 2);
      ctx.fillStyle = '#c96a28';
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(earAngle + 0.5) * 9, ey + Math.sin(earAngle + 0.5) * 9);
      ctx.lineTo(ex + Math.cos(earAngle - 0.5) * 9, ey + Math.sin(earAngle - 0.5) * 9);
      ctx.closePath();
      ctx.fill();
    }
    // Nose and eyes.
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * (r - 1), player.y + Math.sin(player.angle) * (r - 1), 2.5, 0, Math.PI * 2);
    ctx.fill();
    // A soft ring when Pip is hidden: the player can see safety at a glance.
    if (player.hidden || player.inShadow) {
      ctx.strokeStyle = 'rgba(127, 231, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, r + 7 + Math.sin(time / 300) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawDarkness(world) {
    darkCtx.clearRect(0, 0, FIELD.width, FIELD.height);
    darkCtx.fillStyle = 'rgba(4, 8, 18, 0.50)';
    darkCtx.fillRect(0, 0, FIELD.width, FIELD.height);
    darkCtx.globalCompositeOperation = 'destination-out';
    function hole(x, y, radius, strength) {
      const gradient = darkCtx.createRadialGradient(x, y, 4, x, y, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      darkCtx.fillStyle = gradient;
      darkCtx.beginPath();
      darkCtx.arc(x, y, radius, 0, Math.PI * 2);
      darkCtx.fill();
    }
    hole(world.player.x, world.player.y, 190, 0.95);
    for (const guard of world.guards) hole(guard.x, guard.y, 120, 0.8);
    for (const gem of world.gems) {
      if (!gem.taken) hole((gem.col + 0.5) * TILE, (gem.row + 0.5) * TILE, 70, 0.7);
    }
    if (world.level.exit) {
      hole((world.level.exit.col + 0.5) * TILE, (world.level.exit.row + 0.5) * TILE, 90, 0.7);
    }
    darkCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0);
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(640, 352, 300, 640, 352, 780);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function formatTime(seconds) {
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }

  function drawHud(world, screen, best) {
    const danger = currentDanger(world);
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(10, 10, 330, 40, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`◆ ${gemsTaken(world)}/${GEMS_NEEDED}`, 24, 31);
    ctx.fillText(`● ${world.pebblesLeft}`, 104, 31);
    ctx.fillText(`◷ ${formatTime(world.time)}`, 184, 31);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `15px ${FONT}`;
      ctx.fillText(`best ${formatTime(best)}`, 268, 31);
    }
    // The eye: how close the wardens are to raising the alarm.
    if (danger > 1 && screen === SCREEN_PLAY) {
      const width = 260;
      const x = (FIELD.width - width) / 2;
      const y = 14;
      ctx.fillStyle = PALETTE.panel;
      ctx.beginPath();
      ctx.roundRect(x - 12, y - 4, width + 24, 32, 10);
      ctx.fill();
      ctx.fillStyle = '#20242a';
      ctx.fillRect(x, y + 4, width, 12);
      ctx.fillStyle = danger >= 100 ? PALETTE.danger : danger >= 45 ? '#ff9f2e' : '#ffd66b';
      ctx.fillRect(x, y + 4, (width * Math.min(100, danger)) / 100, 12);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(danger >= 100 ? 'SPOTTED!' : danger >= 45 ? 'SUSPICIOUS…' : 'SEEN…', FIELD.width / 2, y + 34);
    }
    // Hints along the bottom.
    if (screen === SCREEN_PLAY) {
      ctx.fillStyle = 'rgba(8, 18, 12, 0.7)';
      ctx.beginPath();
      ctx.roundRect(10, FIELD.height - 34, 560, 24, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `14px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('WASD move · Shift sneak · Click toss a pebble · P pause · M mute', 20, FIELD.height - 21);
    }
    ctx.textBaseline = 'alphabetic';
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(4, 10, 7, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = accent;
    ctx.font = `bold 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `22px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 310 + i * 36));
  }

  function drawTitle(world, best) {
    overlay('LANTERN SHADOWS', [
      'Pip the fox-thief slips into the moonlit garden.',
      'Pocket all three moon gems, then slip out the gate — unseen.',
      '',
      'WASD / arrows move · Shift sneak · Click toss a pebble to distract',
      'Bushes hide you · Shadow beds blind the wardens · Mind the cones',
      '',
      'Press SPACE or click to slip in',
    ], '#ffd66b');
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `18px ${FONT}`;
      ctx.fillText(`Best escape: ${formatTime(best)}`, FIELD.width / 2, 560);
    }
  }

  /** Paint one frame. `time` is a millisecond clock for pulses and sways. */
  function draw(world, screen, best, time) {
    fitCanvas();
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
    const level = world.level;
    drawFloor(level);
    drawGems(world, time);
    drawExit(world, time);
    drawCones(level, world.guards);
    drawHedges(level);
    drawBushes(level, time);
    drawPebbles(world);
    for (const guard of world.guards) drawGuard(guard);
    drawPlayer(world, time);
    drawDarkness(world);
    drawVignette();
    drawHud(world, screen, best);
    if (screen === SCREEN_TITLE) drawTitle(world, best);
    else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['The wardens wait. The moon waits.', '', 'Press P or SPACE to keep sneaking'], '#f2ead8');
    } else if (screen === SCREEN_WIN) {
      overlay('ESCAPED UNSEEN!', [
        `All three moon gems, out the gate in ${formatTime(world.time)}.`,
        best > 0 ? `Best escape: ${formatTime(best)}` : '',
        '',
        'Press R to slip in again',
      ], '#7fe7ff');
    } else if (screen === SCREEN_CAUGHT) {
      overlay('CAUGHT!', [
        'A lantern found you. The garden keeps its gems — this time.',
        '',
        'Press R to try again',
      ], PALETTE.danger);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, fitCanvas };
}
