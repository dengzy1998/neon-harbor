export function makeRng(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  return {
    next, int,
    range: (a, b) => a + next() * (b - a),
    pick: (arr) => arr.length ? arr[int(0, arr.length - 1)] : undefined,
    chance: (p) => next() < p,
  };
}
