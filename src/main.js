// ─────────────────────────────────────────────────────────────────────────────
//  main.js — boot, the offline frame renderer used by tools/render.mjs, and a
//  realtime preview player (space = play/pause, ←/→ = step, drag to scrub).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const SAMPLES = 8, SHUTTER = 0.5;                  // 8 sub-frames, 180° shutter
const REEL_STATS = { subframes: (DUR * FPS * SAMPLES).toLocaleString('en-US') };

let cv2d, ctx2d, lens;

async function boot() {
  const fams = ['900 40px "Inter"', '500 40px "Inter"', '600 40px "Inter"', '700 40px "Inter"', 'italic 400 40px "Instrument Serif"',
    '500 40px "JetBrains Mono"', '700 40px "Space Grotesk"'];
  await Promise.all(fams.map((f) => document.fonts.load(f, 'AaZz09•→')));
  await document.fonts.ready;
  cv2d = document.createElement('canvas');
  cv2d.width = W; cv2d.height = H;
  ctx2d = cv2d.getContext('2d', { willReadFrequently: true });   // CPU raster: far faster than emulated-GPU canvas when rendering headless
  lens = new Lens(document.getElementById('out'));
  initParticles();
}

// Render output frame f with K shutter-weighted sub-frames.
function renderFrame(f, K = SAMPLES, shutter = SHUTTER) {
  lens.begin();
  for (let k = 0; k < K; k++) {
    const t = f / FPS + (k / K) * (shutter / FPS);
    const fx = drawInstant(ctx2d, t);
    lens.add(cv2d, fx, 1 / K, f);
  }
  lens.end(f);
}

function grabPixels() {
  const gl = lens.gl, px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

window.REEL = { W, H, FPS, DUR, SAMPLES, ready: boot(), renderFrame, grabPixels, drawInstant, get float() { return lens.float; } };

// ── preview player ───────────────────────────────────────────────────────────
if (!new URLSearchParams(location.search).has('capture')) {
  REEL.ready.then(() => {
    const scrub = document.getElementById('scrub'), tc = document.getElementById('tc'), btn = document.getElementById('play');
    const audio = document.getElementById('audio');
    let playing = false, t0 = 0, tStart = 0, cur = 0, quality = 1;
    const total = DUR * FPS;
    const show = (f) => {
      cur = Math.max(0, Math.min(total - 1, f | 0));
      renderFrame(cur, playing ? quality : 4);
      scrub.value = cur; tc.textContent = timecode(cur / FPS);
    };
    const tick = (now) => {
      if (!playing) return;
      let t = audio && !audio.paused && audio.readyState > 2 ? audio.currentTime : tStart + (now - t0) / 1000;
      if (t >= DUR) { t = t % DUR; tStart = t; t0 = now; if (audio) { audio.currentTime = t; } }
      show(Math.floor(t * FPS));
      requestAnimationFrame(tick);
    };
    const play = () => {
      playing = true; btn.textContent = '❚❚'; tStart = cur / FPS; t0 = performance.now();
      if (audio) { audio.currentTime = tStart; audio.play().catch(() => {}); }
      requestAnimationFrame(tick);
    };
    const pause = () => { playing = false; btn.textContent = '▶'; if (audio) audio.pause(); show(cur); };
    btn.onclick = () => (playing ? pause() : play());
    scrub.max = total - 1;
    scrub.oninput = () => { if (playing) pause(); show(+scrub.value); };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); btn.click(); }
      if (e.code === 'ArrowRight') { pause(); show(cur + 1); }
      if (e.code === 'ArrowLeft') { pause(); show(cur - 1); }
    });
    show(Math.round(14.5 * FPS));
  });
}
