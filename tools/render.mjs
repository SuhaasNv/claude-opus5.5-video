// ─────────────────────────────────────────────────────────────────────────────
//  render.mjs — offline renderer.
//    node tools/render.mjs                       → out/reel_silent.mp4 (1080p60)
//    node tools/render.mjs --stills 0.5,2.1      → out/stills/*.png
//    options: --workers 4 --samples 8 --from 0 --to 900 --crf 14
//  Spins up N headless Chromium workers (WebGL via SwiftShader), each renders an
//  interleaved subset of frames; frames are re-ordered and piped raw to ffmpeg.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const WORKERS = +arg('workers', 4), SAMPLES = +arg('samples', 8), CRF = arg('crf', '14');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const W = 1920, H = 1080, FPS = 60;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/src/index.html?capture`;

async function worker() {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(URL_);
  await page.evaluate(() => window.REEL.ready);
  return { browser, page };
}

async function grab(page, f, samples) {
  const b64 = await page.evaluate(([f, s]) => {
    window.REEL.renderFrame(f, s);
    const px = window.REEL.grabPixels();
    let bin = '';
    for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
    return btoa(bin);
  }, [f, samples]);
  return Buffer.from(b64, 'base64');
}

// ── stills mode: write PNGs (via ffmpeg) for visual QA ───────────────────────
const stills = arg('stills');
if (stills) {
  const times = stills.split(',').map(Number);
  fs.mkdirSync(path.join(ROOT, 'out/stills'), { recursive: true });
  const { browser, page } = await worker();
  console.log('float accumulation:', await page.evaluate(() => window.REEL.float));
  for (const t of times) {
    const f = Math.round(t * FPS);
    const t0 = Date.now();
    const buf = await grab(page, f, +arg('samples', 4));
    const out = path.join(ROOT, `out/stills/f${String(f).padStart(4, '0')}.png`);
    await new Promise((res, rej) => {
      const p = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1', out]);
      p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()));
      p.stdin.end(buf);
    });
    console.log(`t=${t.toFixed(3)}  f=${f}  ${Date.now() - t0}ms → ${path.relative(ROOT, out)}`);
  }
  await browser.close(); server.close();
  process.exit(0);
}

// ── full render ──────────────────────────────────────────────────────────────
const FROM = +arg('from', 0), TO = +arg('to', 15 * FPS);
const OUT = path.join(ROOT, arg('out', 'out/reel_silent.mp4'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-vf', 'vflip,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-tune', 'grain', '-profile:v', 'high',
  '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });

const workers = await Promise.all(Array.from({ length: WORKERS }, worker));
const done = new Map();
let next = FROM, written = 0;
const t0 = Date.now();
const flush = async () => {
  while (done.has(next)) {
    const buf = done.get(next); done.delete(next);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    next++; written++;
    if (written % 30 === 0 || next === TO) {
      const el = (Date.now() - t0) / 1000, rate = written / el;
      process.stdout.write(`\rframe ${next}/${TO}  ${rate.toFixed(2)} fps  eta ${((TO - next) / rate).toFixed(0)}s   `);
    }
  }
};
let flushing = Promise.resolve();
await Promise.all(workers.map(async ({ page }, wi) => {
  for (let f = FROM + wi; f < TO; f += WORKERS) {
    done.set(f, await grab(page, f, SAMPLES));
    flushing = flushing.then(flush);
    // back-pressure: don't let one worker run far ahead of the writer
    while (f - next > WORKERS * 6) await new Promise((r) => setTimeout(r, 20));
  }
}));
await flushing;
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log(`\nwrote ${path.relative(ROOT, OUT)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await Promise.all(workers.map((w) => w.browser.close()));
server.close();
