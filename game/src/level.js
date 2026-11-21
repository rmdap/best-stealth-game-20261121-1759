// The moonlit garden of Lantern Manor, as one hand-drawn map.
//   # hedge wall (blocks movement and sight)
//   . mossy stone path (open ground)
//   , shadow bed (dark ground: a guard's eye slides off you here)
//   B lantern bush (cover: blocks sight, hides you inside)
//   g moon gem (collect all three to open the gate)
//   E the garden gate (the exit)
//   P where Pip the fox-thief slips in
//
// Every row is exactly 40 tiles; the garden is 40 x 22.

export const MAP = [
  '########################################',
  '#P.....B......,,............g.......B..#',
  '#......................................#',
  '#....####......B......####......B......#',
  '#....#..#..............#..#............#',
  '#..g.#..#...,,........B.#..#...,,......#',
  '#....#..#..............#..#............#',
  '#....####......B......####......B......#',
  '#......................................#',
  '#..,,....####....B......####....,,.....#',
  '#..,,....#..#..........#..#....,,......#',
  '#..,,..B.#..#....,,....#..#..B.,,......#',
  '#..,,....####....,,....####....,,..B...#',
  '#..,,..........,,......,,......,,......#',
  '#......B......,,.......B...............#',
  '#..,,..........,,.....####....,,.......#',
  '#..,,....g.....#......#..#....,,..E....#',
  '#..,,....B.....#...B..#..#....,,.......#',
  '#......,,......#......####....,,.......#',
  '#..B...,,......B.............,,........#',
  '#......,,..........................B...#',
  '########################################',
];

export const TILE_LEGEND = {
  WALL: '#',
  FLOOR: '.',
  SHADOW: ',',
  BUSH: 'B',
  GEM: 'g',
  EXIT: 'E',
  PLAYER: 'P',
};

/** The four lantern wardens and the patrol loop each one walks, in tiles. */
export const GUARD_PATROLS = [
  {
    name: 'Warden Bramble',
    waypoints: [
      [5, 2],
      [18, 2],
      [18, 6],
      [3, 6],
    ],
  },
  {
    name: 'Warden Sorrel',
    waypoints: [
      [4, 10],
      [14, 10],
      [14, 13],
      [4, 13],
    ],
  },
  {
    name: 'Warden Fen',
    waypoints: [
      [23, 9],
      [37, 9],
      [37, 13],
      [23, 13],
    ],
  },
  {
    name: 'Warden Moss',
    waypoints: [
      [5, 19],
      [18, 19],
      [18, 15],
      [5, 15],
    ],
  },
];

/** Parse the map into walkable data: walls, bushes, shadow beds, gems, exit, start. */
export function parseLevel() {
  const walls = new Set();
  const bushes = new Set();
  const shadows = new Set();
  const gems = [];
  let exit = null;
  let start = null;
  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      const cell = MAP[row][col];
      const key = `${col},${row}`;
      if (cell === '#') walls.add(key);
      else if (cell === 'B') bushes.add(key);
      else if (cell === ',') shadows.add(key);
      else if (cell === 'g') gems.push({ col, row, taken: false });
      else if (cell === 'E') exit = { col, row };
      else if (cell === 'P') start = { col, row };
    }
  }
  return { walls, bushes, shadows, gems, exit, start };
}

export function tileKey(col, row) {
  return `${col},${row}`;
}

export function isWallTile(level, col, row) {
  if (col < 0 || row < 0 || col >= 40 || row >= 22) return true;
  return level.walls.has(tileKey(col, row));
}

export function isBushTile(level, col, row) {
  return level.bushes.has(tileKey(col, row));
}

export function isShadowTile(level, col, row) {
  return level.shadows.has(tileKey(col, row));
}

/** True when the straight line between two points crosses no hedge wall. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + (dx * i) / steps;
    const y = y0 + (dy * i) / steps;
    if (isWallTile(level, Math.floor(x / 32), Math.floor(y / 32))) return false;
  }
  return true;
}

/** True when a circle of `radius` at (x, y) overlaps no hedge wall. */
export function circleFits(level, x, y, radius) {
  const corners = [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
    [x, y - radius],
    [x, y + radius],
    [x - radius, y],
    [x + radius, y],
  ];
  for (const [cx, cy] of corners) {
    if (isWallTile(level, Math.floor(cx / 32), Math.floor(cy / 32))) return false;
  }
  return true;
}
