// A tiny seeded generator (mulberry32) so the garden's decoration and every
// staged screenshot are the same on every run from the same seed.

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    /** Integer in [min, max). */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min));
    },
    /** Pick one element of an array. */
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}
