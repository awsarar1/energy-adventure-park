export const G = 10;
export const FIXED_STEP = 1 / 120;

export type Point = { x: number; h: number; s: number };
export type Track = { points: Point[]; bottom: number; length: number };
export type State = { s: number; v: number; heat: number; t: number; segment: number; done: boolean };
export type Config = { mass: number; height: number; friction: number };
export type Reading = { t: number; h: number; speed: number; ke: number; pe: number; me: number; heat: number };

export function makeTrack(height: number): Track {
  const points: Point[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = i - 50;
    const u = i <= 50 ? i / 50 : (100 - i) / 50;
    // Sine eases into the valley while leaving a downhill slope at A.
    const h = height * (i <= 50 ? 1 : 0.5) * (1 - Math.sin(u * Math.PI / 2));
    const prev = points.at(-1);
    points.push({ x, h, s: prev ? prev.s + Math.hypot(x - prev.x, h - prev.h) : 0 });
  }
  return { points, bottom: points[50].s, length: points[100].s };
}

export function position(track: Track, s: number) {
  let lo = 0;
  let hi = track.points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track.points[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = track.points[lo], b = track.points[hi];
  const ratio = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
  return { x: a.x + (b.x - a.x) * ratio, h: a.h + (b.h - a.h) * ratio,
    angle: Math.atan2(b.h - a.h, b.x - a.x) };
}

export function initial(): State {
  return { s: 0, t: 0, v: 0, heat: 0, segment: 0, done: false };
}

export function advance(track: Track, cfg: Config, state: State, seconds: number): State {
  if (state.done || seconds <= 0) return state;
  let { s, v, t, heat, segment } = state;
  let remaining = seconds;
  let done = false;
  const friction = cfg.friction * G;
  const eps = 1e-9;
  while (remaining > eps && !done) {
    const a = track.points[segment], b = track.points[segment + 1];
    const gravity = -G * (b.h - a.h) / (b.s - a.s);
    if (Math.abs(v) < eps && Math.abs(gravity) <= friction + eps) {
      done = true;
      break;
    }
    const direction = Math.sign(Math.abs(v) < eps ? gravity : v);
    const boundary = direction > 0 ? b.s : a.s;
    const distance = Math.abs(boundary - s);
    const along = gravity * direction - friction;
    const speed = Math.abs(v);
    const stop = along < -eps ? speed / -along : Infinity;
    const endSquared = speed ** 2 + 2 * along * distance;
    const denominator = speed + Math.sqrt(Math.max(0, endSquared));
    const hit = distance < eps ? 0 : endSquared >= 0 && denominator > eps ? 2 * distance / denominator : Infinity;
    const dt = Math.min(remaining, stop, hit);
    const dx = dt === hit ? distance : Math.max(0, speed * dt + along * dt ** 2 / 2);
    s = dt === hit ? boundary : s + direction * dx;
    heat += cfg.mass * friction * dx;
    t += dt;
    remaining -= dt;
    // Reconstruct velocity from the energy budget at each event.
    const available = cfg.mass * G * (cfg.height - position(track, s).h) - heat;
    v = dt === stop ? 0 : direction * Math.sqrt(2 * Math.max(0, available) / cfg.mass);
    if (dt === hit) {
      const next = segment + direction;
      if (next < 0 || next >= track.points.length - 1) done = true;
      else if (Math.abs(v) < eps) {
        // At a joint at rest, select only a tangent that accelerates away.
        const c = track.points[next], d = track.points[next + 1];
        const outgoing = -G * (d.h - c.h) / (d.s - c.s) * direction;
        if (outgoing > friction + eps) segment = next;
        else if (gravity * -direction <= friction + eps) done = true;
      } else segment = next;
    }
  }
  return { s, v, t, heat, segment, done };
}

export function read(track: Track, cfg: Config, state: State): Reading {
  const h = position(track, state.s).h;
  const pe = cfg.mass * G * h;
  const ke = cfg.mass * state.v ** 2 / 2;
  return { t: state.t, h, speed: Math.abs(state.v), ke, pe, me: ke + pe, heat: state.heat };
}
