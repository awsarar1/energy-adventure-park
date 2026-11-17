import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, FIXED_STEP, initial, makeTrack, read, type Config } from '../src/physics.ts';

const cfg: Config = { mass: 500, height: 20, friction: 0 };
const close = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

function simulate(config: Config) {
  const track = makeTrack(config.height);
  let state = initial();
  const history = [state];
  for (let i = 0; i < 60 * 120 && !state.done; i++) {
    state = advance(track, config, state, FIXED_STEP);
    history.push(state);
  }
  assert.ok(state.done, 'run should terminate');
  return { track, history };
}

test('500 kg at 20 m: 100,000 J, 20 m/s exactly at B, and constant ME', () => {
  const { track, history } = simulate(cfg);
  close(read(track, cfg, initial()).me, 100000);
  for (const state of history) close(read(track, cfg, state).me, 100000);
  let lo = 0, hi = history.find(s => s.s >= track.bottom)!.t;
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    if (advance(track, cfg, initial(), mid).s < track.bottom) lo = mid;
    else hi = mid;
  }
  const atB = read(track, cfg, advance(track, cfg, initial(), hi));
  close(atB.h, 0);
  close(atB.speed, 20);
  close(atB.ke, 100000);
  close(history.at(-1)!.s, track.length);
});

test('changing mass scales energies while preserving the trajectory', () => {
  const heavy = {...cfg, mass: 1000, friction: 0.05};
  const light = {...cfg, friction: 0.05};
  const a = simulate(light), b = simulate(heavy);
  assert.equal(a.history.length, b.history.length);
  a.history.forEach((state, i) => {
    close(b.history[i].s, state.s);
    const x = read(a.track, light, state), y = read(b.track, heavy, b.history[i]);
    close(y.speed, x.speed);
    for (const key of ['ke', 'pe', 'me', 'heat'] as const) close(y[key], x[key] * 2);
  });
});

test('changing height changes geometry, length and initial energy', () => {
  const high = {...cfg, height: 32};
  const a = makeTrack(20), b = makeTrack(high.height);
  assert.ok(b.length > a.length);
  close(b.points[0].h, 32);
  close(b.points[50].h, 0);
  close(b.points[100].h, 16);
  close(read(b, high, initial()).me, 160000);
});

test('friction accumulates over arc distance and balances mechanical losses', () => {
  const config = {...cfg, friction: 0.05};
  const {track, history} = simulate(config);
  let last = 100000;
  for (const s of history) {
    const e = read(track, config, s);
    assert.ok(e.ke >= 0 && e.me <= last + 1e-7);
    close(e.me + e.heat, 100000);
    close(e.heat, config.mass * 10 * config.friction * s.s);
    last = e.me;
  }
  assert.ok(history.at(-1)!.heat > config.mass * 10 * config.friction * 100);
});

test('insufficient energy causes reversal or rest with a balanced energy budget', () => {
  const config = {...cfg, friction: 0.18};
  const {track, history} = simulate(config);
  assert.ok(history.some(s => s.v < 0));
  assert.ok(Math.max(...history.map(s => s.s)) < track.length);
  close(history.at(-1)!.v, 0);
  for (const s of history) {
    const e = read(track, config, s);
    close(e.me + e.heat, 100000, 1e-5);
  }
  const stuck = advance(track, {...cfg, friction:0.6}, initial(), FIXED_STEP);
  assert.equal(stuck.done, true);
  close(stuck.s, 0);
});

test('pause holds state, resume continues and reset restores A', () => {
  const track = makeTrack(cfg.height);
  const running = advance(track, cfg, initial(), 1);
  const paused = advance(track, cfg, running, 0);
  assert.deepEqual(paused, running);
  const resumed = advance(track, cfg, paused, 1);
  const continuous = advance(track, cfg, initial(), 2);
  close(resumed.s, continuous.s);
  close(resumed.v, continuous.v);
  assert.deepEqual(read(track, cfg, initial()), {t:0, h:20, speed:0, ke:0, pe:100000, me:100000, heat:0});
});

test('all slider friction values preserve total energy across sample heights', () => {
  for (const height of [10, 15, 20, 25, 30, 35]) for (let mu = 0; mu <= 60; mu++) {
    const config = { ...cfg, height, friction: mu / 100 };
    const { track, history } = simulate(config);
    const totals = history.filter((_, i) => i % 29 === 0 || i === history.length - 1);
    for (const state of totals) {
      const a = read(track, config, state);
      close(a.me + a.heat, config.mass * 10 * height, 1e-5);
      assert.ok(state.s >= 0 && state.s <= track.length);
    }
  }
});
