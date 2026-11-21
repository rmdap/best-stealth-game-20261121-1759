// Every tuning number and colour for Lantern Shadows in one place.
// The garden is a fixed 1280x704 logical area (40x22 tiles of 32px); the
// renderer scales it to the window, so no rule below depends on screen size.

export const TILE = 32;
export const COLS = 40;
export const ROWS = 22;
export const FIELD = { width: COLS * TILE, height: ROWS * TILE };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 152,
  sneakSpeed: 92,
  /** How close a chasing guard must get to catch Pip. */
  catchRadius: 26,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 68,
  chaseSpeed: 168,
  investigateSpeed: 110,
  /** Seconds a guard waits at each patrol waypoint, looking around. */
  pauseAtWaypoint: 1.1,
  /** Vision cone: how far a guard sees, and its half-angle in radians. */
  sightRange: 235,
  sightHalfAngle: 0.62,
  /** Detection fills 0..100; the rate scales with closeness (near = fast). */
  detectNear: 120,
  detectFar: 42,
  detectDecay: 55,
  sneakFactor: 0.45,
  /** Seconds of lost sight before a chasing guard gives up. */
  loseSightSeconds: 2.6,
  /** Seconds a guard studies a pebble landing spot. */
  investigateSeconds: 3.0,
};

export const PEBBLE = {
  count: 5,
  throwRange: 270,
  /** Guards within this distance of the landing spot come to look. */
  hearRadius: 210,
};

export const GEMS_NEEDED = 3;

export const PALETTE = {
  night: '#0a1410',
  grass: '#1d3327',
  grassDark: '#16281e',
  path: '#3d3a2e',
  pathEdge: '#2c2a21',
  hedge: '#1e4d2b',
  hedgeTop: '#2f7a44',
  hedgeDot: '#3f9a58',
  shadowBed: '#0d1f33',
  bush: '#276b3a',
  bushLeaf: '#3fae5f',
  bushDark: '#17452a',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneCalmEdge: 'rgba(255, 214, 90, 0.45)',
  coneSuspicious: 'rgba(255, 166, 40, 0.26)',
  coneAlert: 'rgba(255, 70, 60, 0.30)',
  player: '#e8823a',
  playerBelly: '#f7e8d0',
  guard: '#3b5bdb',
  guardTrim: '#ffd66b',
  gem: '#7fe7ff',
  exit: '#ffd66b',
  exitLocked: '#8a8f98',
  text: '#f2ead8',
  muted: '#a9b8a4',
  danger: '#ff5a4e',
  panel: 'rgba(8, 18, 12, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best escape time is kept between visits (this browser only). */
export const BEST_KEY = 'lantern-shadows.best-seconds';
