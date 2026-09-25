// ─────────────────────────────────────────────────────────────────────────────
//  lib.js — math, easing, springs, noise, colour and shape utilities.
//  Everything here is pure: the same inputs always give the same pixels, which
//  is what lets any frame of the reel be rendered in any order, on any worker.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const FPS = 60, DUR = 15, BPM = 120, BEAT = 60 / BPM;
const TAU = Math.PI * 2;

const C = {
  ink: '#0C0C10', ink2: '#16161F', paper: '#EFEAE0', coral: '#FF4B2B',
  lime: '#D4FF3A', cobalt: '#2E4BFF', violet: '#8B5CFF', coralDk: '#C9321A',
};

// ── math ─────────────────────────────────────────────────────────────────────
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

const E = {
  lin: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inQuart: (x) => x * x * x * x,
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outSine: (x) => Math.sin((x * Math.PI) / 2),
};

// Critically/under-damped spring step response. t = seconds since trigger.
// f = natural frequency (Hz), z = damping ratio. Overshoots when z < 1.
function spring(t, f = 3, z = 0.4) {
  if (t <= 0) return 0;
  const w = TAU * f;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
}
// Damped oscillation that starts at 0 and decays back to 0 (a "wobble").
const wobble = (t, f = 6, k = 8) => (t <= 0 ? 0 : Math.sin(t * f * TAU) * Math.exp(-t * k));

// ── deterministic randomness ─────────────────────────────────────────────────
function hash(i, s = 0) {
  let x = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((s | 0) + 0x165667b1, 0x9e3779b1)) | 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const hrange = (i, s, a, b) => a + (b - a) * hash(i, s);

// 2D gradient noise in [-1, 1]
const _g2 = (ix, iy) => { const a = hash(ix * 7919 + iy * 104729, 17) * TAU; return [Math.cos(a), Math.sin(a)]; };
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const d = (gx, gy, dx, dy) => { const g = _g2(gx, gy); return g[0] * dx + g[1] * dy; };
  const n00 = d(ix, iy, fx, fy), n10 = d(ix + 1, iy, fx - 1, fy);
  const n01 = d(ix, iy + 1, fx, fy - 1), n11 = d(ix + 1, iy + 1, fx - 1, fy - 1);
  return 1.4 * lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

// ── colour ───────────────────────────────────────────────────────────────────
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const RGB = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex2rgb(v)]));
const rgba = (c, a = 1) => { const r = typeof c === 'string' ? hex2rgb(c) : c; return `rgba(${r[0] | 0},${r[1] | 0},${r[2] | 0},${a})`; };
const mixc = (a, b, t) => { a = typeof a === 'string' ? hex2rgb(a) : a; b = typeof b === 'string' ? hex2rgb(b) : b; return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
// multi-stop gradient lookup, stops = [[pos, colour], ...]
function ramp(stops, x) {
  x = clamp(x);
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) return mixc(stops[i - 1][1], stops[i][1], (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return mixc(stops[stops.length - 1][1], stops[stops.length - 1][1], 0);
}

// ── type ─────────────────────────────────────────────────────────────────────
const F = { inter: '"Inter"', serif: '"Instrument Serif"', mono: '"JetBrains Mono"', grot: '"Space Grotesk"' };
const font = (px, fam = F.inter, w = 900, style = '') => `${style} ${w} ${px}px ${fam}`;

// Per-letter layout honouring kerning: x of glyph i = width of the prefix.
function layout(ctx, str, fnt, track = 0) {
  ctx.font = fnt;
  ctx.letterSpacing = '0px';
  const xs = [];
  for (let i = 0; i < str.length; i++) xs.push(ctx.measureText(str.slice(0, i)).width + i * track);
  const total = ctx.measureText(str).width + (str.length - 1) * track;
  const ws = [...str].map((ch) => ctx.measureText(ch).width);
  return { xs, ws, total };
}
function capHeight(ctx, fnt) { ctx.font = fnt; return ctx.measureText('H').actualBoundingBoxAscent; }

// ── morphable shapes ─────────────────────────────────────────────────────────
// Every shape is sampled as a radius r(θ) at N fixed angles, so any two shapes
// can be morphed by simply lerping radii. N is divisible by 3, 4, 5 and 8 so
// polygon corners land exactly on sample angles.
const SN = 120;
function rayPoly(poly, th) {
  const dx = Math.cos(th), dy = Math.sin(th);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [px, py] = poly[i], [qx, qy] = poly[(i + 1) % poly.length];
    const ex = qx - px, ey = qy - py, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (px * ey - py * ex) / den, u = (px * dy - py * dx) / den;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
}
function starPoly(n, ro, ri, rot = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return p;
}
function regPoly(n, r, rot = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = rot + (i * TAU) / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return p;
}
function sampleShape(fn) { const a = new Float32Array(SN); for (let i = 0; i < SN; i++) a[i] = fn((i / SN) * TAU); return a; }
const _pw = 0.36;
const SHAPES = {
  circle: sampleShape(() => 0.9),
  square: sampleShape((th) => 0.8 / Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th)))),
  diamond: sampleShape((th) => 1.05 / (Math.abs(Math.cos(th)) + Math.abs(Math.sin(th)))),
  plus: sampleShape((th) => rayPoly([[_pw, -1], [_pw, -_pw], [1, -_pw], [1, _pw], [_pw, _pw], [_pw, 1], [-_pw, 1], [-_pw, _pw], [-1, _pw], [-1, -_pw], [-_pw, -_pw], [-_pw, -1]], th)),
  star4: sampleShape((th) => rayPoly(starPoly(4, 1.1, 0.38, 0), th)),
  star5: sampleShape((th) => rayPoly(starPoly(5, 1.05, 0.45), th)),
  tri: sampleShape((th) => rayPoly(regPoly(3, 1.05), th)),
  hex: sampleShape((th) => rayPoly(regPoly(6, 0.95, 0), th)),
  flower: sampleShape((th) => 0.72 + 0.22 * Math.cos(th * 6)),
};

// Draw a morph between two sampled shapes. mix ∈ [0,1].
function shapePath(ctx, a, b, mix, x, y, size, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < SN; i++) {
    const th = (i / SN) * TAU, r = lerp(a[i], b[i], mix) * size;
    const px = x + Math.cos(th + rot) * r, py = y + Math.sin(th + rot) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// A seamless chain of shapes, driven by a continuous index (2.5 = halfway 3rd→4th).
function shapeChain(chain, k) {
  const n = chain.length, i = Math.floor(k), m = k - i;
  return [SHAPES[chain[((i % n) + n) % n]], SHAPES[chain[(((i + 1) % n) + n) % n]], m];
}

// rounded rect helper
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
