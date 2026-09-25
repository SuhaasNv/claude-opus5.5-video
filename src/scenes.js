// ─────────────────────────────────────────────────────────────────────────────
//  scenes.js — the reel. 15 s, 120 BPM (a beat every 0.5 s), every cut on the
//  grid. Each scene is a pure function draw(ctx, t) of absolute time, returning
//  the lens settings it wants — so the montage can "re-shoot" any moment.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

// Outline text without the variable font's internal overlap contours: stroke,
// then knock out the fill, on a cached offscreen canvas.
const _OT = new Map();
function outlineSprite(str, fnt, lw, col) {
  const key = str + fnt + lw + col;
  if (_OT.has(key)) return _OT.get(key);
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = fnt; const m = x.measureText(str);
  const pad = lw * 2 + 4, asc = m.actualBoundingBoxAscent, dsc = m.actualBoundingBoxDescent;
  c.width = Math.ceil(m.width + pad * 2); c.height = Math.ceil(asc + dsc + pad * 2);
  x.font = fnt; x.lineJoin = 'round';
  x.strokeStyle = col; x.lineWidth = lw * 2; x.strokeText(str, pad, pad + asc);
  x.globalCompositeOperation = 'destination-out'; x.fillText(str, pad, pad + asc);
  const spr = { c, ox: -pad, oy: -(pad + asc) };
  _OT.set(key, spr); return spr;
}
const drawOutline = (ctx, spr, x, y) => ctx.drawImage(spr.c, x + spr.ox, y + spr.oy);

const bg = (ctx, col) => { ctx.fillStyle = col; ctx.fillRect(-80, -80, W + 160, H + 160); };

function ring(ctx, dt, R, lw, col, life = 0.6) {
  if (dt < 0 || dt > life) return;
  const u = dt / life, p = E.outExpo(u);
  ctx.strokeStyle = rgba(col, Math.pow(1 - u, 1.6));
  ctx.lineWidth = lw * (1 - p) + 0.75;
  ctx.beginPath(); ctx.arc(CX, CY, R * p, 0, TAU); ctx.stroke();
}

// ═════════════════════════════════════════════════════════════════════════════
//  01 · IGNITION   0.00 → 1.50
//  A dot is born on a designer's crosshair, pulses on the beat, winds up
//  (anticipation), then stretches into a line that splits the frame open.
// ═════════════════════════════════════════════════════════════════════════════
function sIgnite(ctx, t) {
  bg(ctx, C.ink);
  const g = E.outExpo(prog(t, 0.1, 0.75)), ga = 1 - prog(t, 0.88, 1.08);

  if (ga > 0) {
    // construction guides + dashed orbit + typed coordinate readout
    ctx.strokeStyle = rgba(C.paper, 0.18 * ga); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - g * CX, CY + 0.5); ctx.lineTo(CX + g * CX, CY + 0.5);
    ctx.moveTo(CX + 0.5, CY - g * CY); ctx.lineTo(CX + 0.5, CY + g * CY);
    ctx.stroke();
    ctx.setLineDash([3, 9]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.arc(CX, CY, 170 * E.outExpo(prog(t, 0.18, 0.8)), 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    const label = 'X 960   Y 540', n = Math.floor(prog(t, 0.28, 0.52) * label.length);
    ctx.font = font(15, F.mono, 500); ctx.fillStyle = rgba(C.paper, 0.6 * ga);
    ctx.fillText(label.slice(0, n) + (n < label.length && n > 0 ? '▌' : ''), CX + 28, CY - 24);
    // tiny corner handles like a selected layer
    const hs = 44 * E.outBack(prog(t, 0.34, 0.6));
    if (hs > 0) {
      ctx.strokeStyle = rgba(C.coral, 0.9 * ga); ctx.lineWidth = 1.5;
      ctx.strokeRect(CX - hs, CY - hs, hs * 2, hs * 2);
      ctx.fillStyle = C.ink;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.fillRect(CX + sx * hs - 4, CY + sy * hs - 4, 8, 8);
        ctx.strokeRect(CX + sx * hs - 4, CY + sy * hs - 4, 8, 8);
      }
    }
  }

  // dial of ticks that assembles, spins and gets sucked into the dot
  const col = E.inBack(prog(t, 0.8, 1.0), 2.2);
  ctx.lineCap = 'round';
  for (let i = 0; i < 32; i++) {
    const a0 = 0.26 + i * 0.012, s = E.outBack(prog(t, a0, a0 + 0.2));
    if (s <= 0 || col >= 1) continue;
    const ang = (i / 32) * TAU - Math.PI / 2 + t * 1.6 + col * 3;
    const r1 = lerp(92, 8, col), r2 = r1 + (i % 4 === 0 ? 22 : 12) * s * (1 - col);
    ctx.strokeStyle = rgba(i % 4 === 0 ? C.coral : C.paper, 0.85);
    ctx.lineWidth = i % 4 === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(ang) * r1, CY + Math.sin(ang) * r1);
    ctx.lineTo(CX + Math.cos(ang) * r2, CY + Math.sin(ang) * r2);
    ctx.stroke();
  }

  ring(ctx, t - 0.5, 460, 5, C.coral);
  ring(ctx, t - 0.75, 300, 2, C.paper);
  ring(ctx, t - 1.0, 620, 3, C.coral, 0.5);

  // the dot
  let r = 18 * spring(t - 0.05, 2.6, 0.42);
  r *= 1 - 0.3 * E.outCubic(prog(t, 0.84, 1.0));                  // anticipation
  const k = wobble(t - 0.5, 4.5, 7) * 0.4 + wobble(t - 0.75, 5, 9) * 0.25;
  const st = E.inOutExpo(prog(t, 1.0, 1.3));
  const w = lerp(2 * r * (1 + k), W + 300, st);
  const h = lerp(2 * r * (1 - k), 8, E.outExpo(prog(t, 1.0, 1.1)));
  ctx.fillStyle = C.coral;
  if (w > 0 && h > 0) { rrect(ctx, CX - w / 2, CY - h / 2, w, h, h / 2); ctx.fill(); }

  // the line splits: a paper band opens, the coral edges ride it off-frame
  const bt = E.inOutExpo(prog(t, 1.22, 1.5));
  if (bt > 0) {
    const bh = bt * (H + 60);
    ctx.fillStyle = C.paper; ctx.fillRect(-80, CY - bh / 2, W + 160, bh);
    ctx.fillStyle = C.coral;
    ctx.fillRect(-80, CY - bh / 2 - 8, W + 160, 8);
    ctx.fillRect(-80, CY + bh / 2, W + 160, 8);
  }
  return { tone: 'light' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  02 · KINETIC TYPE   1.50 → 4.00
//  MAKE (masked rise) / IT (scale slam) / MOVE (spring drop) / marquee / iris.
// ═════════════════════════════════════════════════════════════════════════════
function sType(ctx, t) {
  if (t < 2.0) return typeMake(ctx, t);
  if (t < 2.5) return typeIt(ctx, t);
  if (t < 3.0) return typeMove(ctx, t);
  return typeMarquee(ctx, t);
}

function typeMake(ctx, t) {
  bg(ctx, C.paper);
  const fnt = font(380), L = layout(ctx, 'MAKE', fnt, -14), cap = capHeight(ctx, fnt);
  const x0 = CX - L.total / 2, base = CY + cap / 2;
  // underline sweep (secondary action)
  const u1 = E.outExpo(prog(t, 1.6, 1.85)), u2 = E.inExpo(prog(t, 1.86, 2.0));
  ctx.fillStyle = C.coral;
  const ux0 = x0 + L.total * u2, ux1 = x0 + L.total * u1;
  if (ux1 > ux0) ctx.fillRect(ux0, base + 34, ux1 - ux0, 18);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, base - cap - 40, W, cap + 74); ctx.clip();
  ctx.font = fnt; ctx.fillStyle = C.ink;
  for (let i = 0; i < 4; i++) {
    const a = 1.5 + i * 0.045, p = E.outExpo(prog(t, a, a + 0.45));
    const e = E.inExpo(prog(t, 1.84 + i * 0.03, 2.0));
    const y = (1 - p) * (cap + 80) - e * (cap + 80);
    ctx.save();
    ctx.translate(x0 + L.xs[i], base + y);
    ctx.rotate((1 - p) * 0.22);
    ctx.fillText('MAKE'[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return { tone: 'dark' };
}

function typeIt(ctx, t) {
  bg(ctx, C.ink);
  const lt = t - 2.0;
  // anime impact lines
  const sl = prog(t, 2.0, 2.3);
  if (sl < 1) {
    ctx.strokeStyle = rgba(C.paper, 0.22 * (1 - sl)); ctx.lineCap = 'butt';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU + hash(i, 3) * 0.1, len = hrange(i, 4, 200, 700);
      const r0 = 250 + E.outExpo(sl) * 900 * hrange(i, 5, 0.6, 1.2);
      ctx.lineWidth = hrange(i, 6, 2, 7);
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0);
      ctx.lineTo(CX + Math.cos(a) * (r0 + len), CY + Math.sin(a) * (r0 + len));
      ctx.stroke();
    }
  }
  const fnt = font(720), L = layout(ctx, 'IT', fnt, -20), cap = capHeight(ctx, fnt);
  const push = 1 + E.outSine(prog(t, 2.2, 2.5)) * 0.06;
  const sc = lerp(3.4, 1, E.outExpo(prog(t, 2.0, 2.2))) * (1 + wobble(lt - 0.14, 5, 11) * 0.035) * push;
  const rot = (1 - E.outExpo(prog(t, 2.0, 2.22))) * -0.18;
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(sc, sc); ctx.rotate(rot);
  ctx.font = fnt;
  // echo outlines blasting outward
  for (let k = 2; k >= 0; k--) {
    const e = prog(t, 2.08 + k * 0.05, 2.46);
    if (e <= 0 || e >= 1) continue;
    const s = 1 + E.outExpo(e) * 0.5 * (k + 1);
    ctx.save(); ctx.scale(s, s);
    ctx.globalAlpha = (1 - e) * 0.6;
    drawOutline(ctx, outlineSprite('IT', fnt, 2, k === 0 ? C.coral : C.paper), -L.total / 2, cap / 2);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.fillStyle = C.coral;
  ctx.fillText('IT', -L.total / 2, cap / 2);
  ctx.restore();
  return { tone: 'light' };
}

function typeMove(ctx, t) {
  bg(ctx, C.paper);
  const fnt = font(340), L = layout(ctx, 'MOVE', fnt, -12), cap = capHeight(ctx, fnt);
  const x0 = CX - L.total / 2, base = CY + cap / 2 - 40;
  ctx.font = fnt; ctx.fillStyle = C.ink;
  for (let i = 0; i < 4; i++) {
    const a = 2.5 + i * 0.04, s = spring(t - a, 3.4, 0.45);
    const y = (1 - s) * -(base + 60);
    // squash on landing: scaleY dips when the spring crosses its target
    const land = wobble(t - a - 0.08, 4, 10) * 0.12;
    ctx.save();
    ctx.translate(x0 + L.xs[i] + L.ws[i] / 2, base + y);
    ctx.scale(1 + land, 1 - land);
    ctx.rotate((1 - s) * (i % 2 ? 0.35 : -0.35));
    ctx.fillText('MOVE'[i], -L.ws[i] / 2, 0);
    ctx.restore();
  }
  const p = E.outExpo(prog(t, 2.72, 3.0));
  ctx.font = font(120, F.serif, 400, 'italic');
  ctx.fillStyle = rgba(C.coral, p);
  const s2 = '(with intent)', w2 = ctx.measureText(s2).width;
  ctx.fillText(s2, CX - w2 / 2 + (1 - p) * 160, base + 150);
  return { tone: 'dark' };
}

function typeMarquee(ctx, t) {
  bg(ctx, C.ink);
  const rowH = 152, fnt = font(150);
  ctx.font = fnt;
  const unit = 'MOVE • ', uw = ctx.measureText(unit).width, cap = capHeight(ctx, fnt);
  const col = E.inOutExpo(prog(t, 3.48, 3.74));                         // rows collapse
  for (let r = -3; r <= 3; r++) {
    const dir = r % 2 === 0 ? -1 : 1;
    const e = E.outExpo(prog(t, 3.0 + Math.abs(r) * 0.035, 3.42));
    const y = CY + r * rowH * (1 - col) + cap / 2;
    const sy = 1 - col * (r === 0 ? 0.3 : 0.9);
    const off = dir * (1 - e) * W * 0.9 + dir * (t - 3.0) * 820 + r * 173;
    const a = 1 - prog(t, 3.62, 3.74);
    if (a <= 0) continue;
    ctx.save();
    ctx.translate(0, y); ctx.scale(1, sy);
    let x = (((off % uw) + uw) % uw) - uw;
    const outline = Math.abs(r) % 2 === 1;
    if (r === 0) ctx.fillStyle = rgba(C.coral, a);
    else ctx.fillStyle = rgba(C.paper, (Math.abs(r) === 2 ? 0.9 : 0.35) * a);
    const spr = outline && outlineSprite(unit, fnt, 1.5, C.paper);
    if (outline) ctx.globalAlpha = 0.6 * a;
    for (; x < W + uw; x += uw) outline ? drawOutline(ctx, spr, x, 0) : ctx.fillText(unit, x, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // hero MOVE resolves; its O becomes a coral iris into the next scene
  const hfnt = font(340), L = layout(ctx, 'MOVE', hfnt, -12), hcap = capHeight(ctx, hfnt);
  const x0 = CX - L.total / 2, base = CY + hcap / 2;
  const hs = spring(t - 3.6, 2.8, 0.5);
  if (hs > 0) {
    const oc = [x0 + L.xs[1] + L.ws[1] / 2, base - hcap / 2];
    const orad = L.ws[1] * 0.47;
    const split = E.inExpo(prog(t, 3.8, 4.0));
    const iris = E.inExpo(prog(t, 3.8, 4.0));
    const pop = spring(t - 3.74, 3.5, 0.35);
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(lerp(0.45, 1, hs), lerp(0.45, 1, hs)); ctx.translate(-CX, -CY);
    ctx.font = hfnt; ctx.fillStyle = C.paper;
    for (let i = 0; i < 4; i++) {
      if (i === 1 && pop > 0) continue;
      const dx = (i === 0 ? -1 : 1) * split * 1400;
      ctx.fillText('MOVE'[i], x0 + L.xs[i] + dx, base);
    }
    if (pop > 0) {
      const maxR = Math.hypot(Math.max(oc[0], W - oc[0]), Math.max(oc[1], H - oc[1])) + 40;
      const rr = lerp(orad * pop, maxR, iris);
      ctx.fillStyle = C.coral;
      ctx.beginPath(); ctx.arc(oc[0], oc[1], rr, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  return { tone: 'light' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  03 · SHAPE & RHYTHM   4.00 → 6.00
//  A 16×9 field of morphing primitives driven by radial beat-waves, which then
//  implodes into one hero shape that winds up and spins into a shatter.
// ═════════════════════════════════════════════════════════════════════════════
const GRID_CHAIN = ['circle', 'square', 'plus', 'star4', 'diamond', 'flower', 'hex'];
function heroShape(t) {
  const r = 250 * spring(t - 5.3, 2.2, 0.5) * (1 + 0.15 * E.inCubic(prog(t, 5.82, 6.0)));
  const mix = E.inOutCubic(prog(t, 5.48, 5.7));
  let rot = (t - 5.3) * 0.9;
  rot -= 0.6 * E.outCubic(prog(t, 5.66, 5.82));                         // wind-up
  rot += TAU * 1.3 * E.inCubic(prog(t, 5.82, 6.0));                      // release
  return { r, mix, rot };
}

function sShapes(ctx, t) {
  bg(ctx, C.coral);
  const cell = 120;
  const waves = [4.3, 4.8, 5.05];
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < 9; j++) {
      for (let i = 0; i < 16; i++) {
        const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
        const dn = Math.hypot(cx - CX, cy - CY) / 1020;
        const pop = spring(t - 4.0 - dn * 0.42, 3, 0.45);
        if (pop <= 0) continue;
        let k = 0, swell = 0;
        for (const wv of waves) {
          const a = wv + dn * 0.34;
          k += E.inOutCubic(prog(t, a, a + 0.26));
          swell += Math.exp(-Math.pow((t - a - 0.12) / 0.07, 2)) * 0.4;
        }
        const c = E.inExpo(prog(t, 5.18 + (1 - dn) * 0.14, 5.46 + (1 - dn) * 0.14));
        if (c >= 1) continue;
        const x = lerp(cx, CX, c), y = lerp(cy, CY, c);
        const size = 42 * pop * (1 + swell + 0.1 * Math.sin(dn * 14 - t * 9)) * (1 - c * 0.8);
        const rot = (k * Math.PI) / 2 + 0.35 * Math.sin(dn * 9 - t * 5);
        const [A, B, m] = shapeChain(GRID_CHAIN, k + ((i + j) % 2) * 0);
        if (pass === 0) {
          ctx.fillStyle = C.coralDk;
          shapePath(ctx, A, B, m, x + 9, y + 11, size, rot); ctx.fill();
        } else {
          const hl = hash(i + j * 16, 7) > 0.86;
          ctx.fillStyle = hl ? C.paper : C.ink;
          shapePath(ctx, A, B, m, x, y, size, rot); ctx.fill();
        }
      }
    }
  }
  const hs = heroShape(t);
  if (hs.r > 0) {
    ctx.fillStyle = C.coralDk;
    shapePath(ctx, SHAPES.circle, SHAPES.star5, hs.mix, CX + 16, CY + 20, hs.r, hs.rot); ctx.fill();
    ctx.fillStyle = C.ink;
    shapePath(ctx, SHAPES.circle, SHAPES.star5, hs.mix, CX, CY, hs.r, hs.rot); ctx.fill();
    // inner orbiting accent
    const ia = E.outBack(prog(t, 5.5, 5.75)) * (1 - prog(t, 5.9, 6.0));
    if (ia > 0) {
      ctx.fillStyle = C.lime;
      shapePath(ctx, SHAPES.circle, SHAPES.star4, 0.5, CX, CY, hs.r * 0.28 * ia, -hs.rot * 2); ctx.fill();
    }
  }
  return { tone: 'dark' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  04 · PARTICLE SYSTEMS   6.00 → 8.00
//  The star shatters into 3,200 particles: a differential-rotation galaxy that
//  tilts into 3D, condenses into a sphere, re-knots into a (2,3) torus knot,
//  then jumps to hyperspace. All closed-form, so streaks are exact.
// ═════════════════════════════════════════════════════════════════════════════
const PN = 3200;
let PART = null;
function initParticles() {
  const hs = heroShape(6.0), R = hs.r;
  const cols = [RGB.paper, RGB.coral, RGB.lime, RGB.cobalt, RGB.violet];
  PART = [];
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < PN; i++) {
    // origin: uniform-ish inside the rotated hero star at t = 6.0
    const th = hash(i, 1) * TAU;
    const idx = Math.floor((((th - hs.rot) % TAU) + TAU) % TAU / TAU * SN) % SN;
    const rmax = SHAPES.star5[idx] * R;
    const r0 = Math.sqrt(hash(i, 2)) * rmax;
    const rF = 120 + Math.pow(hash(i, 3), 0.7) * 820;
    const nf = clamp((rF - 120) / 820);
    const ci = nf < 0.18 ? (hash(i, 9) < 0.6 ? 0 : 2) : nf < 0.5 ? (hash(i, 9) < 0.7 ? 1 : 0) : hash(i, 9) < 0.6 ? 3 : 4;
    // fibonacci sphere target
    const yy = 1 - (i / (PN - 1)) * 2, rr = Math.sqrt(1 - yy * yy), ph = i * gold;
    // (2,3) torus knot target with a little tube jitter
    const s = (i / PN) * TAU, kr = 2 + Math.cos(3 * s);
    const jit = [hrange(i, 11, -0.18, 0.18), hrange(i, 12, -0.18, 0.18), hrange(i, 13, -0.18, 0.18)];
    PART.push({
      th, r0, rF, ci, col: cols[ci],
      spin: hrange(i, 4, 0.8, 1.25), zj: hrange(i, 5, -1, 1), dl: hash(i, 6), sz: hrange(i, 7, 1.2, 3.4),
      sph: [Math.cos(ph) * rr, yy, Math.sin(ph) * rr],
      knot: [kr * Math.cos(2 * s) + jit[0], kr * Math.sin(2 * s) + jit[1], -Math.sin(3 * s) + jit[2]],
    });
  }
}

function rotYX(p, ay, ax) {
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
  return [x, p[1] * cx - z * sx, p[1] * sx + z * cx];
}

function particlePos(q, t) {
  // galaxy
  const u = prog(t, 6.0, 7.3);
  const r = lerp(q.r0, q.rF, E.outExpo(prog(t, 6.0, 6.85)));
  const th = q.th + q.spin * (E.outCubic(u) * 1.2 + u * 0.8) * (320 / (r + 90));
  let p = [Math.cos(th) * r, Math.sin(th) * r, q.zj * 60 * u];
  const tilt = 1.05 * E.inOutCubic(prog(t, 6.15, 7.0));
  p = rotYX(p, 0, tilt);
  // sphere
  const v = E.inOutCubic(prog(t, 6.92 + q.dl * 0.3, 7.34 + q.dl * 0.3));
  const rot = (t - 6.9) * 1.7;
  if (v > 0) {
    const s = rotYX([q.sph[0] * 310, q.sph[1] * 310, q.sph[2] * 310], rot, 0.35);
    p = [lerp(p[0], s[0], v), lerp(p[1], s[1], v), lerp(p[2], s[2], v)];
  }
  // torus knot
  const w = E.inOutCubic(prog(t, 7.38 + q.dl * 0.14, 7.7 + q.dl * 0.14));
  if (w > 0) {
    const k = rotYX([q.knot[0] * 118, q.knot[1] * 118, q.knot[2] * 118], rot * 1.2, 0.5 + (t - 7.4) * 0.8);
    p = [lerp(p[0], k[0], w), lerp(p[1], k[1], w), lerp(p[2], k[2], w)];
  }
  // hyperspace
  p[2] -= E.inExpo(prog(t, 7.74, 8.0)) * 1450;
  return p;
}

const FOC = 1100;
function projP(p) { const d = FOC + p[2]; if (d < 30) return null; const s = FOC / d; return [CX + p[0] * s, CY + p[1] * s, s]; }

function sParticles(ctx, t) {
  bg(ctx, C.ink);
  if (!PART) initParticles();
  // bloom from the shatter
  const bl = Math.exp(-(t - 6.0) * 5);
  if (bl > 0.01) {
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 700);
    g.addColorStop(0, rgba(C.coral, 0.7 * bl)); g.addColorStop(0.4, rgba(C.coral, 0.2 * bl)); g.addColorStop(1, rgba(C.coral, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const dt = 1 / 110 + E.inExpo(prog(t, 7.74, 8.0)) * 0.05;
  for (let i = 0; i < PN; i++) {
    const q = PART[i];
    const a = projP(particlePos(q, t)), b = projP(particlePos(q, t - dt));
    if (!a || !b) continue;
    const depth = clamp(a[2], 0.3, 3);
    const alpha = clamp(0.25 + 0.55 * depth, 0, 1) * (q.ci === 0 ? 0.9 : 0.8);
    ctx.strokeStyle = rgba(q.col, alpha);
    ctx.lineWidth = q.sz * depth;
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0] + 0.01, a[1]); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  return { tone: 'light' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  05 · DIMENSION   8.00 → 9.75
//  An 11×11 field of extruded blocks, rippling on the beat under an orbiting
//  camera — then the camera cranes to top-down and dives into the centre cube.
// ═════════════════════════════════════════════════════════════════════════════
function sCubes(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#15153A'); g.addColorStop(1, C.ink);
  ctx.fillStyle = g; ctx.fillRect(-80, -80, W + 160, H + 160);

  const N = 11, half = (N - 1) / 2, sp = 1.16, tt = t - 8;
  const tr = E.inOutCubic(prog(t, 9.25, 9.75));
  const zoom = E.inExpo(prog(t, 9.3, 9.72));
  const yaw = lerp(Math.PI / 4 + tt * 0.34, Math.PI / 2, tr);
  const pitch = lerp(0.62, Math.PI / 2, tr);
  const scale = 74 * (1 + zoom * 36) * (1 + E.outExpo(prog(t, 8.0, 8.6)) * 0.12);
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), spn = Math.sin(pitch);
  const P = (x, y, z) => { const X = x * cyw - z * syw, Z = x * syw + z * cyw; return [X, -y * cp + Z * spn, y * spn + Z * cp]; };

  const cubes = [];
  let hc = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const di = i - half, dj = j - half, dist = Math.hypot(di, dj) / (half * Math.SQRT2);
    const rise = spring(tt - dist * 0.5, 2.1, 0.48);
    let h = 0.25 + 1.1 * (0.5 + 0.5 * Math.sin(dist * 7.5 - tt * 6.5));
    for (const [tb, ox, oz] of [[0.5, -half, -half], [1.0, half, half]]) {
      const dd = Math.hypot(i - half - ox, j - half - oz), front = (tt - tb) * 11;
      if (tt > tb) h += 1.3 * Math.exp(-Math.pow(dd - front, 2) / 2.5) * Math.exp(-(tt - tb) * 1.2);
    }
    h *= rise;
    const center = i === half && j === half;
    let shrink = 1;
    if (center) { h = lerp(h, 1.4, tr); hc = h; }
    else shrink = 1 - E.inBack(prog(t, 9.2 + dist * 0.2, 9.44 + dist * 0.22), 2);
    if (h < 0.01 || shrink <= 0.01) continue;
    h *= shrink;
    const x = di * sp, z = dj * sp;
    cubes.push({ x, z, h, y0: 0, s: 0.5 * shrink, center, dist, depth: P(x, h / 2, z)[2] });
  }
  const anchor = P(0, lerp(0, hc, tr), 0);
  const ox = CX - anchor[0] * scale, oy = CY + 40 * (1 - tr) - anchor[1] * scale;
  const S = (p) => [ox + p[0] * scale, oy + p[1] * scale];

  // floor grid
  ctx.strokeStyle = rgba(C.paper, 0.07 * (1 - tr)); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -half - 0.5; k <= half + 0.6; k += 1) {
    const e = (half + 0.5) * sp;
    let a = S(P(k * sp, 0, -e)), b = S(P(k * sp, 0, e)); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    a = S(P(-e, 0, k * sp)); b = S(P(e, 0, k * sp)); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();

  cubes.sort((a, b) => a.depth - b.depth);
  const L = [-0.55, 0.8, -0.25];
  const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const c of cubes) {
    const s = c.s, y0 = c.y0, y1 = c.y0 + c.h;
    let top = ramp([[0, C.cobalt], [0.45, C.violet], [0.75, C.coral], [1, C.lime]], c.h / 2.1);
    if (c.center) top = mixc(top, C.cobalt, tr);
    for (const [nx, nz] of faces) {
      if ((nx * syw + nz * cyw) * cp <= 0) continue;
      const lit = 0.32 + 0.5 * Math.max(0, nx * L[0] + nz * L[2]);
      const colr = mixc(C.ink, top, lit);
      const ex = nx !== 0 ? [[nx * s, -s], [nx * s, s]] : [[-s, nz * s], [s, nz * s]];
      const q = [[...ex[0], y0], [...ex[1], y0], [...ex[1], y1], [...ex[0], y1]].map(([a, b, y]) => S(P(c.x + a, y, c.z + b)));
      ctx.fillStyle = rgba(colr); ctx.strokeStyle = rgba(colr); ctx.lineWidth = 1;
      ctx.beginPath(); q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    const q = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([a, b]) => S(P(c.x + a, y1, c.z + b)));
    ctx.fillStyle = rgba(top); ctx.strokeStyle = rgba(mixc(top, C.paper, 0.35)); ctx.lineWidth = 1.2;
    ctx.beginPath(); q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  return { tone: 'light' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  06 · INTERFACE   9.75 → 11.50
//  Product-UI motion: spring-loaded cards, a self-drawing chart, an odometer,
//  toggles, a cursor, a click that morphs into a success state and an iris.
// ═════════════════════════════════════════════════════════════════════════════
const CHART = [0.16, 0.26, 0.2, 0.38, 0.33, 0.5, 0.44, 0.62, 0.56, 0.74, 0.69, 0.93];
let CHART_PTS = null;
function chartPts(x0, y0, w, h) {
  if (CHART_PTS) return CHART_PTS;
  const P = CHART.map((v, i) => [x0 + (i / (CHART.length - 1)) * w, y0 + h - v * h]);
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < 24; s++) {
      const u = s / 24, u2 = u * u, u3 = u2 * u;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]);
  let acc = 0; const len = [0];
  for (let i = 1; i < out.length; i++) { acc += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); len.push(acc); }
  return (CHART_PTS = { pts: out, len, total: acc });
}

const BTN = { x: 1192, y: 800, w: 556, h: 62 };               // screen-space button
function card(ctx, t, x, y, w, h, at, draw) {
  const p = spring(t - at, 2.2, 0.55), a = clamp((t - at) * 6);
  if (a <= 0) return;
  const out = E.inBack(prog(t, 11.3, 11.48));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x + w / 2, y + h / 2 + (1 - p) * 180 + out * 60);
  const sc = lerp(0.9, 1, p) * (1 - out * 0.08);
  ctx.scale(sc, sc);
  ctx.rotate((1 - p) * 0.06);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(8,12,60,0.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
  ctx.fillStyle = C.paper; rrect(ctx, 0, 0, w, h, 30); ctx.fill();
  ctx.shadowColor = 'transparent';
  draw(ctx);
  ctx.restore();
}

function sUI(ctx, t) {
  bg(ctx, C.cobalt);
  // drifting dot grid
  ctx.fillStyle = rgba(C.paper, 0.13);
  const drift = (t - 9.75) * 30;
  for (let y = -48; y < H + 48; y += 48) for (let x = 24; x < W; x += 48) {
    const yy = y + (drift % 48);
    ctx.fillRect(x - 1.5, yy - 1.5, 3, 3);
  }

  // A — chart card
  card(ctx, t, 140, 170, 980, 710, 9.8, (c) => {
    c.font = font(17, F.mono, 500); c.fillStyle = rgba(C.ink, 0.55);
    c.letterSpacing = '3px'; c.fillText('ENGAGEMENT / 30D', 50, 70); c.letterSpacing = '0px';
    const v = Math.round(248 * E.outExpo(prog(t, 10.05, 10.95)));
    c.font = font(128); c.fillStyle = C.ink; c.fillText(`+${v}%`, 44, 200);
    const nw = c.measureText('+248%').width;
    const pa = E.outBack(prog(t, 10.5, 10.75));
    if (pa > 0) {
      c.save(); c.translate(60 + nw + 30, 150); c.scale(pa, pa);
      c.fillStyle = C.lime; rrect(c, 0, -28, 170, 50, 25); c.fill();
      c.fillStyle = C.ink; c.font = font(22, F.inter, 700); c.fillText('▲ all-time', 20, 5);
      c.restore();
    }
    const gx = 50, gy = 270, gw = 880, gh = 380;
    c.strokeStyle = rgba(C.ink, 0.08); c.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      const gp = E.outExpo(prog(t, 9.95 + k * 0.04, 10.4 + k * 0.04));
      c.beginPath(); c.moveTo(gx, gy + (k * gh) / 4); c.lineTo(gx + gw * gp, gy + (k * gh) / 4); c.stroke();
    }
    const { pts, len, total } = chartPts(gx, gy, gw, gh);
    const pr = E.inOutCubic(prog(t, 10.05, 10.95)) * total;
    let n = 1; while (n < pts.length && len[n] <= pr) n++;
    const f = n < pts.length ? (pr - len[n - 1]) / (len[n] - len[n - 1] || 1) : 1;
    const head = n < pts.length ? [lerp(pts[n - 1][0], pts[n][0], f), lerp(pts[n - 1][1], pts[n][1], f)] : pts[pts.length - 1];
    if (pr > 0) {
      const grad = c.createLinearGradient(0, gy, 0, gy + gh);
      grad.addColorStop(0, rgba(C.coral, 0.3)); grad.addColorStop(1, rgba(C.coral, 0));
      c.fillStyle = grad; c.beginPath(); c.moveTo(pts[0][0], gy + gh);
      for (let i = 0; i < n; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.lineTo(head[0], head[1]); c.lineTo(head[0], gy + gh); c.closePath(); c.fill();
      c.strokeStyle = C.coral; c.lineWidth = 7; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.lineTo(head[0], head[1]); c.stroke();
      const pulse = fract((t - 10) * 2);
      c.strokeStyle = rgba(C.coral, 1 - pulse); c.lineWidth = 3;
      c.beginPath(); c.arc(head[0], head[1], 12 + pulse * 26, 0, TAU); c.stroke();
      c.fillStyle = C.paper; c.beginPath(); c.arc(head[0], head[1], 13, 0, TAU); c.fill();
      c.fillStyle = C.coral; c.beginPath(); c.arc(head[0], head[1], 8, 0, TAU); c.fill();
    }
  });

  // B — odometer card
  card(ctx, t, 1160, 170, 620, 330, 9.9, (c) => {
    c.font = font(17, F.mono, 500); c.fillStyle = rgba(C.ink, 0.55);
    c.letterSpacing = '3px'; c.fillText('SUB-FRAMES RENDERED', 44, 64); c.letterSpacing = '0px';
    const str = REEL_STATS.subframes;
    c.font = font(120);
    const dh = 128;
    let x = 40;
    c.save(); c.beginPath(); c.rect(30, 80, 560, 150); c.clip();
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], cw = c.measureText(ch === ',' ? ',' : '0').width;
      if (ch === ',') { c.fillStyle = C.ink; c.fillText(',', x, 204); x += cw; continue; }
      const target = +ch + 10 * (2 + i);
      const e = E.outExpo(prog(t, 10.0 + i * 0.07, 10.85 + i * 0.07));
      const pos = target * e, d0 = Math.floor(pos), fr = pos - d0;
      c.fillStyle = C.ink;
      c.fillText(String(d0 % 10), x, 204 - fr * dh);
      c.fillText(String((d0 + 1) % 10), x, 204 + dh - fr * dh);
      x += cw;
    }
    c.restore();
    for (let k = 0; k < 14; k++) {
      const bh = hrange(k, 31, 18, 58) * spring(t - 10.2 - k * 0.03, 2.6, 0.45);
      c.fillStyle = k === 13 ? C.coral : rgba(C.cobalt, 0.85);
      rrect(c, 44 + k * 38, 290 - bh, 24, bh, 6); c.fill();
    }
  });

  // C — controls card
  card(ctx, t, 1160, 540, 620, 340, 10.0, (c) => {
    const rows = ['Easing', 'Motion blur', 'Overshoot'], flips = [10.4, 10.62, 10.84];
    rows.forEach((lb, k) => {
      const y = 62 + k * 66;
      c.font = font(30, F.inter, 600); c.fillStyle = C.ink; c.fillText(lb, 44, y + 10);
      const s = spring(t - flips[k], 3.2, 0.45);
      const tx = 490, tw = 88, th = 46;
      c.fillStyle = rgba(mixc('#CFC8BA', C.cobalt, clamp(s)));
      rrect(c, tx, y - th / 2, tw, th, th / 2); c.fill();
      const kx = tx + th / 2 + (tw - th) * s, stretch = 1 + wobble(t - flips[k], 3, 9) * 0.25;
      c.fillStyle = '#fff';
      c.save(); c.translate(kx, y); c.scale(stretch, 1 / stretch);
      c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill(); c.restore();
    });
    // the button (drawn in card space: card is at 1160,540)
    const bx = BTN.x - 1160, by = BTN.y - 540;
    const press = 1 - 0.06 * Math.sin(Math.PI * prog(t, 11.08, 11.18));
    const morph = E.inOutCubic(prog(t, 11.16, 11.3));
    const bw = lerp(BTN.w, BTN.h, morph);
    c.save();
    c.translate(bx + BTN.w / 2, by + BTN.h / 2); c.scale(press, press);
    c.fillStyle = rgba(mixc(C.ink, C.lime, morph));
    rrect(c, -bw / 2, -BTN.h / 2, bw, BTN.h, BTN.h / 2); c.fill();
    const ta = 1 - prog(t, 11.14, 11.2);
    if (ta > 0) {
      c.font = font(26, F.inter, 700); c.fillStyle = rgba(C.paper, ta);
      const lbl = 'Render reel  →', lw = c.measureText(lbl).width;
      c.fillText(lbl, -lw / 2, 9);
    }
    const ck = E.outCubic(prog(t, 11.24, 11.34));
    if (ck > 0) {
      c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
      const pts = [[-12, 1], [-3, 10], [14, -9]];
      const seg = ck * 2;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      c.lineTo(lerp(pts[0][0], pts[1][0], clamp(seg)), lerp(pts[0][1], pts[1][1], clamp(seg)));
      if (seg > 1) c.lineTo(lerp(pts[1][0], pts[2][0], seg - 1), lerp(pts[1][1], pts[2][1], seg - 1));
      c.stroke();
    }
    // click ripple
    const rp = prog(t, 11.1, 11.4);
    if (rp > 0 && rp < 1) {
      c.strokeStyle = rgba(C.ink, 0.5 * (1 - rp)); c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, 30 + E.outExpo(rp) * 160, 0, TAU); c.stroke();
    }
    c.restore();
  });

  // cursor
  const cp = E.inOutCubic(prog(t, 10.5, 11.06));
  if (cp > 0) {
    const bcx = BTN.x + BTN.w / 2 + 40, bcy = BTN.y + BTN.h / 2 + 6;
    const p0 = [1700, 1180], p1 = [1500, 700], p2 = [bcx, bcy];
    const bez = (a, b, c2, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c2;
    let x = bez(p0[0], p1[0], p2[0], cp), y = bez(p0[1], p1[1], p2[1], cp);
    const away = E.inOutCubic(prog(t, 11.22, 11.5));
    x += away * 160; y += away * 120;
    const click = 1 - 0.18 * Math.sin(Math.PI * prog(t, 11.06, 11.16));
    ctx.save(); ctx.translate(x, y); ctx.scale(click * 1.3, click * 1.3); ctx.rotate(-0.08);
    ctx.fillStyle = C.ink; ctx.strokeStyle = C.paper; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 36); ctx.lineTo(9, 28); ctx.lineTo(16, 43); ctx.lineTo(22, 40); ctx.lineTo(15, 25); ctx.lineTo(27, 25); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // success iris: a lime ring races out and punches through to the shader world
  const ip = prog(t, 11.28, 11.5);
  let liquid = 0;
  if (ip > 0) {
    liquid = 1;
    const ccx = BTN.x + BTN.w / 2, ccy = BTN.y + BTN.h / 2;
    const maxR = Math.hypot(ccx, ccy) + 60;
    const R = lerp(BTN.h / 2, maxR, E.inExpo(ip) * 0.8 + E.inOutCubic(ip) * 0.2);
    const hole = lerp(0, maxR, E.inExpo(prog(t, 11.32, 11.5)));
    ctx.fillStyle = C.lime; ctx.beginPath(); ctx.arc(ccx, ccy, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(ccx, ccy, hole, 0, TAU); ctx.fill(); ctx.restore();
  }
  return { tone: 'light', liquid, liqT: liqTime(t) };
}

// ═════════════════════════════════════════════════════════════════════════════
//  07 · SHADERS   11.50 → 12.25
//  A domain-warped fBm "liquid chrome" field (GLSL, in gl.js); the 2D layer is
//  just type — and the shader refracts it.
// ═════════════════════════════════════════════════════════════════════════════
const liqTime = (t) => 4 + (t - 11.3) * 1.9;
function sLiquid(ctx, t) {
  ctx.clearRect(-80, -80, W + 160, H + 160);
  const fnt = font(440, F.serif, 400, 'italic'), word = 'fluid.';
  const L = layout(ctx, word, fnt, -6), x0 = CX - L.total / 2, base = CY + 120;
  ctx.font = fnt;
  for (let i = 0; i < word.length; i++) {
    const a = 11.52 + i * 0.04, p = E.outExpo(prog(t, a, a + 0.5));
    const y = (1 - p) * 120 + Math.sin(t * 4 + i * 0.9) * 12;
    ctx.save();
    ctx.translate(x0 + L.xs[i] + L.ws[i] / 2, base + y);
    ctx.rotate(Math.sin(t * 3 + i * 1.3) * 0.05 + (1 - p) * 0.3);
    ctx.fillStyle = rgba(i === 5 ? C.lime : C.paper, p);
    ctx.fillText(word[i], -L.ws[i] / 2, 0);
    ctx.restore();
  }
  const cp = E.outExpo(prog(t, 11.62, 11.9));
  ctx.font = font(18, F.mono, 500); ctx.letterSpacing = '5px';
  ctx.fillStyle = rgba(C.paper, 0.8 * cp);
  const cap = 'GLSL · DOMAIN-WARPED FBM · REFRACTION', cw = ctx.measureText(cap).width;
  ctx.fillText(cap, CX - cw / 2, base - 380 + (1 - cp) * 20);
  ctx.letterSpacing = '0px';
  return { tone: 'light', liquid: 1, liqT: liqTime(t), refract: 0.022 };
}

// ═════════════════════════════════════════════════════════════════════════════
//  08 · THE CUT   12.25 → 13.00
//  An accelerating montage that re-shoots earlier moments — possible only
//  because every scene is a pure function of time. Cut points are on frames.
// ═════════════════════════════════════════════════════════════════════════════
const CUTS = [
  // [start frame, scene fn, source time, invert, scene index for HUD]
  [735, sType, 2.05, 0, 1],
  [743, sShapes, 4.6, 0, 2],
  [750, sParticles, 6.55, 0, 3],
  [757, sCubes, 8.95, 0, 4],
  [762, sUI, 10.92, 1, 5],
  [766, sLiquid, 11.95, 0, 6],
  [770, sIgnite, 0.62, 1, 0],
  [774, sType, 3.22, 0, 1],
  [777, sShapes, 5.93, 0, 2],
];
const cutAt = (t) => { const f = t * FPS + 1e-6; let c = CUTS[0]; for (const k of CUTS) if (f >= k[0]) c = k; return c; };
function sMontage(ctx, t) {
  const c = cutAt(t), lt = t - c[0] / FPS;
  const punch = 1 + 0.07 * Math.exp(-lt * 18);
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(punch, punch); ctx.translate(-CX, -CY);
  const r = c[1](ctx, c[2] + lt) || {};
  ctx.restore();
  return { ...r, invert: c[3], hudScene: c[4] };
}

// ═════════════════════════════════════════════════════════════════════════════
//  09 · RESOLVE   13.00 → 15.00
//  Iris-in to the dot from the opening; it hops, rolls out the wordmark and
//  lands as its full stop. Scramble-decoded credits. Then everything falls
//  away back to a single dot on black — so the reel loops seamlessly.
// ═════════════════════════════════════════════════════════════════════════════
let WM = null;
function wordmark(ctx) {
  if (WM) return WM;
  const fnt = font(270, F.inter, 900), L = layout(ctx, 'claude', fnt, -12), xh = ctx.measureText('x').actualBoundingBoxAscent;
  const dr = 26, gap = 16, total = L.total + gap + dr * 2;
  const x0 = CX - total / 2, base = CY + xh / 2 - 10;
  WM = { fnt, L, xh, dr, x0, base, fx: x0 + L.total + gap + dr, fy: base - dr, sx: x0 - 70 };
  // when does the rolling dot pass each letter's centre?
  WM.pass = L.xs.map((x, i) => {
    const target = x0 + x + L.ws[i] / 2;
    for (let s = 0; s <= 400; s++) { const tt = 13.72 + (s / 400) * 0.42; if (dotX(tt) >= target) return tt; }
    return 14.14;
  });
  return WM;
}
function dotX(t) { return lerp(WM.sx, WM.fx, E.outQuart(prog(t, 13.72, 14.14))); }
function scramble(str, t, t0, step = 0.012, dur = 0.16) {
  const glyphs = '!<>-_\\/[]{}—=+*^?#01ABCDEFXYZ';
  let s = '';
  for (let i = 0; i < str.length; i++) {
    const r = t0 + i * step;
    if (t < r - dur) s += ' ';
    else if (t < r && str[i] !== ' ') s += glyphs[Math.floor(hash(i, Math.floor(t * 30)) * glyphs.length)];
    else s += str[i];
  }
  return s;
}

function sResolve(ctx, t) {
  bg(ctx, C.ink);
  const M = wordmark(ctx);
  const push = 1 + E.inOutSine(prog(t, 13.3, 14.8)) * 0.035;
  const ex = prog(t, 14.78, 15.0);                                        // loop-out
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(push, push); ctx.translate(-CX, -CY);

  // letters roll out behind the dot and fall away at the end
  ctx.font = M.fnt;
  for (let i = 0; i < 6; i++) {
    const s = spring(t - M.pass[i], 3, 0.42);
    if (s <= 0) continue;
    const fall = E.inQuad(prog(t, 14.76 + i * 0.014, 14.9 + i * 0.01));
    ctx.save();
    ctx.translate(M.x0 + M.L.xs[i] + M.L.ws[i] / 2, M.base + fall * 820);
    ctx.rotate(fall * (i % 2 ? 0.6 : -0.5));
    ctx.scale(lerp(0.4, 1, s), lerp(0.4, 1, s));
    ctx.translate(0, (1 - s) * 40);
    ctx.fillStyle = rgba(C.paper, clamp(s * 2) * (1 - fall));
    ctx.fillText('claude'[i], -M.L.ws[i] / 2, 0);
    ctx.restore();
  }

  // hairline
  const hl = E.outExpo(prog(t, 14.16, 14.6)) * (1 - E.inOutCubic(prog(t, 14.76, 14.9)));
  if (hl > 0) {
    ctx.fillStyle = rgba(C.paper, 0.28);
    const hw = (M.fx + M.dr - M.x0) * hl;
    ctx.fillRect(CX - hw / 2, M.base + 70, hw, 2);
  }

  // credits: scramble-decoded
  const fa = 1 - prog(t, 14.78, 14.9);
  ctx.font = font(24, F.mono, 500); ctx.letterSpacing = '7px';
  ctx.fillStyle = rgba(C.paper, 0.85 * fa);
  const sub = 'MOTION DESIGN  —  SHOWREEL 2026';
  const sw = ctx.measureText(sub).width;
  ctx.fillText(scramble(sub, t, 14.2), CX - sw / 2, M.base + 132);
  ctx.letterSpacing = '0px';
  const tp = E.outExpo(prog(t, 14.4, 14.75));
  ctx.font = font(46, F.serif, 400, 'italic');
  ctx.fillStyle = rgba(C.coral, tp * fa);
  const tag = 'every frame, written in code.', tw = ctx.measureText(tag).width;
  ctx.fillText(tag, CX - tw / 2, M.base + 210 + (1 - tp) * 24);

  // the dot: iris-in → rest → hop → roll → land → return to centre → vanish
  let x = CX, y = CY, r, sx = 1, sy = 1;
  const iris = E.inOutExpo(prog(t, 13.0, 13.32));
  r = lerp(1250, M.dr, iris);
  const w1 = wobble(t - 13.32, 4, 8) * 0.25; sx += w1; sy -= w1;
  const ant = Math.sin(Math.PI * prog(t, 13.36, 13.46)) * 0.28; sx += ant; sy -= ant;   // crouch
  const hop = prog(t, 13.46, 13.72);
  if (hop > 0) {
    const e = E.inOutCubic(hop);
    x = lerp(CX, M.sx, e); y = lerp(CY, M.fy, e) - 190 * 4 * e * (1 - e);
    const st = Math.sin(Math.PI * hop) * 0.3; sx = 1 - st * 0.4; sy = 1 + st;
  }
  if (t >= 13.72) {
    x = dotX(t); y = M.fy;
    const v = 1 - prog(t, 13.72, 14.14); sx = 1 + v * 0.35; sy = 1 - v * 0.2;
  }
  const land = wobble(t - 14.14, 4.5, 9) * 0.3; sx += land; sy -= land;
  if (ex > 0) {
    const e = E.inOutCubic(prog(t, 14.8, 14.96));
    x = lerp(M.fx, CX, e); y = lerp(M.fy, CY, e);
    r = M.dr * (1 - E.inBack(prog(t, 14.86, 14.975), 2.5)) * (18 / 26 + (1 - 18 / 26) * (1 - e));
  }
  ctx.restore();
  // dot drawn outside the push so the iris edge is exact
  if (r > 0) {
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(push, push); ctx.translate(-CX, -CY);
    ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // landing ring
  if (t > 14.14 && t < 14.7) {
    const u = (t - 14.14) / 0.56, p = E.outExpo(u);
    ctx.strokeStyle = rgba(C.coral, Math.pow(1 - u, 1.5)); ctx.lineWidth = 3 * (1 - p) + 0.75;
    ctx.beginPath(); ctx.arc(CX + (M.fx - CX) * push, CY + (M.fy - CY) * push, M.dr + p * 120, 0, TAU); ctx.stroke();
  }
  return { tone: 'light' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  Timeline, camera energy, HUD
// ═════════════════════════════════════════════════════════════════════════════
const SCENES = [
  { id: '01', name: 'IGNITION', a: 0.0, fn: sIgnite },
  { id: '02', name: 'KINETIC TYPE', a: 1.5, fn: sType },
  { id: '03', name: 'SHAPE & RHYTHM', a: 4.0, fn: sShapes },
  { id: '04', name: 'PARTICLE SYSTEMS', a: 6.0, fn: sParticles },
  { id: '05', name: 'DIMENSION', a: 8.0, fn: sCubes },
  { id: '06', name: 'INTERFACE', a: 9.75, fn: sUI },
  { id: '07', name: 'SHADERS', a: 11.5, fn: sLiquid },
  { id: '08', name: 'THE CUT', a: 12.25, fn: sMontage },
  { id: '09', name: 'RESOLVE', a: 13.0, fn: sResolve },
];
const sceneIndex = (t) => { let k = 0; for (let i = 0; i < SCENES.length; i++) if (t >= SCENES[i].a - 1e-9) k = i; return k; };

// impact energy drives shake, zoom punch, chromatic aberration and lens warp
const IMPACTS = [[0.5, 0.35], [1.5, 0.55], [2.0, 1.0], [2.5, 0.5], [3.0, 0.6], [4.0, 0.8], [6.0, 1.1], [8.0, 0.9],
  [9.75, 0.5], [11.1, 0.25], [11.5, 0.7], [13.0, 0.9], [14.14, 0.45], ...CUTS.map((c) => [c[0] / FPS, 0.5])];
function impact(t, k = 9) { let s = 0; for (const [ti, a] of IMPACTS) if (t >= ti) s += a * Math.exp(-(t - ti) * k); return s; }
const FLASHES = [[6.0, 0.45], [8.0, 0.6], [11.5, 0.2], [13.0, 0.25]];
function flash(t) { let s = 0; for (const [ti, a] of FLASHES) if (t >= ti) s += a * Math.exp(-(t - ti) * 16); return s; }

function timecode(t) {
  const f = Math.floor(t * FPS + 1e-6), ff = f % FPS, ss = Math.floor(f / FPS);
  const p = (n) => String(n).padStart(2, '0');
  return `00:00:${p(ss)}:${p(ff)}`;
}

function hud(ctx, t, tone, si) {
  const a = prog(t, 0.3, 0.7) * (1 - prog(t, 13.0, 13.2)) + prog(t, 14.2, 14.5) * (1 - prog(t, 14.78, 14.92)) * 0.8;
  if (a <= 0.001) return;
  const col = tone === 'dark' ? C.ink : C.paper;
  ctx.save();
  ctx.font = font(15, F.mono, 500); ctx.letterSpacing = '3px';
  ctx.fillStyle = rgba(col, 0.85 * a);
  ctx.fillText('CLAUDE  ·  MOTION REEL ’26', 64, 70);
  ctx.textAlign = 'right';
  ctx.fillText(`TC ${timecode(t)}`, W - 64, 70);
  // beat meter
  const beat = Math.floor(t / BEAT + 1e-6), ph = t / BEAT - beat;
  for (let k = 0; k < 4; k++) {
    const on = beat % 4 === k;
    ctx.fillStyle = rgba(on ? C.coral : col, on ? a : 0.3 * a);
    const s = on ? 10 + 6 * Math.exp(-ph * 6) : 10;
    ctx.fillRect(W - 64 - (3 - k) * 26 - s, H - 76 - s / 2, s, s);
  }
  ctx.fillStyle = rgba(col, 0.6 * a);
  ctx.fillText('120 BPM', W - 64 - 4 * 26 - 14, H - 70);
  // scene slate with a slot-machine change
  ctx.textAlign = 'left';
  const sc = SCENES[si], cur = sceneIndex(t), since = t - (cur === 7 ? cutAt(t)[0] / FPS : SCENES[cur].a);
  const e = E.outExpo(clamp(since / 0.3));
  ctx.save(); ctx.beginPath(); ctx.rect(56, H - 100, 700, 44); ctx.clip();
  ctx.fillStyle = rgba(col, 0.9 * a);
  ctx.fillText(`${sc.id} — ${sc.name}`, 64, H - 70 + (1 - e) * 30);
  ctx.restore();
  // crop marks
  ctx.strokeStyle = rgba(col, 0.45 * a); ctx.lineWidth = 1.5;
  const m = 34, l = 22;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [W - m, H - m, -1, -1], [m, H - m, 1, -1]]) {
    ctx.moveTo(x, y + dy * l); ctx.lineTo(x, y); ctx.lineTo(x + dx * l, y);
  }
  ctx.stroke();
  ctx.restore();
}

// Render one instant into the 2D canvas. Returns lens settings.
function drawInstant(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  const si = sceneIndex(t), sc = SCENES[si];
  const imp = impact(t);
  const shk = imp * 14;
  const sx = noise2(t * 24, 3.1) * shk, sy = noise2(t * 24, 9.7) * shk;
  const zoom = 1 + impact(t, 14) * 0.03;
  ctx.save();
  ctx.translate(CX + sx, CY + sy); ctx.scale(zoom, zoom); ctx.translate(-CX, -CY);
  const r = sc.fn(ctx, t) || {};
  ctx.restore();
  hud(ctx, t, r.tone || 'light', r.hudScene !== undefined ? r.hudScene : si);
  return {
    chroma: 0.12 + imp * 1.5, warp: imp * 0.9, grain: 0.055, vig: 0.38,
    liquid: r.liquid || 0, liqT: r.liqT || 0, refract: r.refract || 0,
    flash: flash(t), invert: r.invert || 0,
  };
}
