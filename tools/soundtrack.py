#!/usr/bin/env python3
"""
soundtrack.py — a 15 s, 120 BPM score synthesised from scratch (numpy/scipy),
hit-for-hit locked to the picture: every cut, slam, pop, click and landing in
src/scenes.js has a sound at the same timestamp. Writes out/soundtrack.wav.
Key of A minor. No samples — every sound is an oscillator or filtered noise.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR, DUR, BEAT = 48000, 15.0, 0.5
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)          # dry bus
VL = np.zeros(N); VR = np.zeros(N)        # reverb send
DUCK = np.ones(N)                         # sidechain envelope for pads/bass

def note(n):  # midi → Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def put(sig, t0, pan=0.0, gain=1.0, verb=0.0):
    i = int(round(t0 * SR))
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[: N - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gl * 1.41; R[i:i + len(sig)] += sig * gr * 1.41
    if verb:
        VL[i:i + len(sig)] += sig * gl * verb; VR[i:i + len(sig)] += sig * gr * verb

def tt(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))

# ── instruments ──────────────────────────────────────────────────────────────
def kick(t0, g=1.0, duck=True):
    t = tt(0.45)
    f = 48 + 120 * np.exp(-t * 32)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    s += hp(noise(0.45), 3000) * np.exp(-t * 120) * 0.25
    put(np.tanh(s * 1.6) * 0.9, t0, 0, g)
    if duck:
        i = int(t0 * SR); d = tt(0.3); env = 1 - 0.75 * np.exp(-d * 11)
        DUCK[i:i + len(env)] = np.minimum(DUCK[i:i + len(env)], env[: N - i])

def clap(t0, g=1.0):
    t = tt(0.35); n = bp(noise(0.35), 900, 5000)
    env = np.exp(-t * 18)
    for k in (0.0, 0.011, 0.022): env += np.exp(-np.maximum(t - k, 0) * 140) * (t >= k) * 0.8
    s = n * env * 0.5 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.3
    put(s, t0, 0.05, g, verb=0.25)

def hat(t0, g=1.0, open_=False, pan=0.25):
    d = 0.22 if open_ else 0.05; t = tt(d)
    put(hp(noise(d), 7500) * np.exp(-t * (14 if open_ else 90)) * 0.35, t0, pan, g)

def tick(t0, g=1.0, f=3200, pan=0.0):
    t = tt(0.03)
    put((np.sin(2 * np.pi * f * t) * 0.6 + hp(noise(0.03), 5000) * 0.4) * np.exp(-t * 260), t0, pan, g)

def pluck(t0, n, g=1.0, dec=5.0, pan=0.0, verb=0.35, bright=1.0):
    f = note(n); d = min(2.0, 6 / dec); t = tt(d); s = np.zeros_like(t)
    for k in range(1, 9):
        s += np.sin(2 * np.pi * f * k * t * (1 + 0.0007 * k * k)) * (bright ** (k - 1)) / k * np.exp(-t * dec * (0.6 + 0.5 * k))
    s *= np.minimum(1, t * 800)
    put(s * 0.35, t0, pan, g, verb)

def bell(t0, n, g=1.0, pan=0.0, verb=0.6):
    f = note(n); t = tt(2.0)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dcy) for r, a, dcy in
            [(1, 1, 2.2), (2.76, 0.45, 4), (5.4, 0.25, 7), (8.93, 0.12, 11), (2, 0.3, 3)])
    put(s * np.minimum(1, t * 2000) * 0.22, t0, pan, g, verb)

def boom(t0, g=1.0, dur=2.2):
    t = tt(dur)
    f = 36 + 70 * np.exp(-t * 7)
    s = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 2.2)
    s += lp(noise(dur), 900) * np.exp(-t * 9) * 0.6
    put(s * 0.8, t0, 0, g, verb=0.25)
    kick(t0, 0.6)

def riser(t0, t1, g=1.0, f0=250, f1=9000, tone=True):
    d = t1 - t0; t = tt(d); x = noise(d); out = np.zeros_like(x)
    blk = 512
    for b in range(0, len(x), blk):
        u = b / len(x); fc = f0 * (f1 / f0) ** (u ** 1.6)
        sos = butter(2, [fc * 0.7, min(fc * 1.4, SR / 2 - 100)], 'bandpass', fs=SR, output='sos')
        out[b:b + blk] = sosfilt(sos, x[b:b + blk])
    env = (t / d) ** 2.2
    s = out * env * 1.3
    if tone:
        f = 110 * 2 ** (3 * (t / d) ** 1.5)
        s += np.sin(2 * np.pi * np.cumsum(f) / SR) * env * 0.12
    put(s, t0, 0, g, verb=0.3)

def whoosh(t0, d=0.35, g=1.0, up=False, pan=0.0):
    t = tt(d); x = noise(d); out = np.zeros_like(x); blk = 256
    for b in range(0, len(x), blk):
        u = b / len(x); u = u if up else 1 - u
        fc = 300 * (6000 / 300) ** u
        out[b:b + blk] = sosfilt(butter(2, [fc * 0.6, min(fc * 1.6, 23000)], 'bandpass', fs=SR, output='sos'), x[b:b + blk])
    env = np.sin(np.pi * t / d) ** 1.5
    put(out * env * 0.9, t0, pan, g, verb=0.2)

def revcym(t1, d=0.5, g=1.0):
    t = tt(d); s = hp(noise(d), 4000) * (t / d) ** 3
    put(s * 0.5, t1 - d, 0, g, verb=0.3)

def glass(t0, g=1.0):
    for k in range(26):
        f = rng.uniform(2500, 9000); dt = rng.uniform(0, 0.35); t = tt(0.4)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t * rng.uniform(15, 40))
        put(s * 0.08, t0 + dt ** 1.5, rng.uniform(-0.9, 0.9), g, verb=0.5)
    t = tt(0.6); put(hp(noise(0.6), 5000) * np.exp(-t * 9) * 0.45, t0, 0, g, verb=0.4)

def stutter(t0, g=1.0, f=90):
    t = tt(0.12)
    s = np.sin(2 * np.pi * np.cumsum(f * (1 + 2 * np.exp(-t * 60))) / SR) * np.exp(-t * 25)
    s += bp(noise(0.12), 1500, 9000) * np.exp(-t * 40) * 0.5
    put(np.tanh(s * 1.5) * 0.6, t0, 0, g)

# ── harmonic bed: bass + pad (sidechained) ───────────────────────────────────
CHORDS = [(57, [57, 60, 64, 71]), (53, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (55, [55, 59, 62, 69])]
BASS = np.zeros(N); PAD = np.zeros(N)
def saw(f, t, parts=12):
    return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, parts))

def lay_bed(t0, t1, bass=True, pad=True, bass_g=1.0, pad_g=1.0, eighths=True):
    bar = 2.0
    b = t0
    while b < t1 - 1e-6:
        ci = int(((b - 1.5) // bar) % 4)
        root, ch = CHORDS[ci]
        seg = min(bar - ((b - 1.5) % bar), t1 - b)
        if pad:
            t = tt(seg); s = np.zeros_like(t)
            for n in ch:
                for det in (-0.08, 0.08):
                    s += saw(note(n + det), t, 6)
            s = lp(s, 2400) * np.minimum(1, t * 30) * np.minimum(1, (seg - t) * 30)
            i = int(b * SR); PAD[i:i + len(s)] += s[: N - i] * 0.03 * pad_g
        if bass:
            step = BEAT / 2 if eighths else BEAT
            k = b
            while k < b + seg - 1e-6:
                d = min(step, b + seg - k); t = tt(d)
                s = np.tanh(2.5 * saw(note(root - 24), t, 8)) * np.exp(-t * 4) * np.minimum(1, (d - t) * 200)
                s = lp(s, 700)
                i = int(k * SR); BASS[i:i + len(s)] += s[: N - i] * 0.28 * bass_g
                k += step
        b += seg

# ── the score, scene by scene ────────────────────────────────────────────────
# 01 IGNITION
t = tt(1.5); drone = saw(55, t, 10) * (t / 1.5) ** 1.5
put(lp(drone, 500) * 0.15, 0.0)
for i in range(32): tick(0.26 + i * 0.012 + 0.1, 0.35, 2400 + i * 60, pan=np.sin(i) * 0.6)
bell(0.05, 81, 0.6)
kick(0.5, 0.55, duck=False); bell(0.5, 76, 0.5); bell(0.75, 83, 0.35, pan=0.4)
kick(1.0, 0.45, duck=False)
riser(0.8, 1.5, 0.8); whoosh(1.0, 0.3, 0.8, up=True)
# 02 KINETIC TYPE
boom(1.5, 0.9); clap(1.5, 0.6)
for b in np.arange(1.5, 4.0, BEAT): kick(b)
for b in (2.0, 3.0): clap(b)
for b in np.arange(1.75, 4.0, BEAT): hat(b, 0.8)
for b in np.arange(3.0, 3.5, BEAT / 4): hat(b, 0.5, pan=-0.3)
t = tt(0.25); put(lp(noise(0.25), 400) * np.exp(-t * 10) * 0.8, 2.0, 0, 1.0)    # IT slam thud
for i in range(4): tick(2.5 + i * 0.04 + 0.1, 0.8, 900 + i * 200, pan=-0.5 + i * 0.33); pluck(2.5 + i * 0.04 + 0.1, 69 + [0, 3, 7, 12][i], 0.6, 9)
whoosh(3.0, 0.3, 0.7, pan=-0.4); whoosh(3.05, 0.3, 0.6, pan=0.4)
revcym(4.0, 0.6, 1.0)
lay_bed(1.5, 4.0)
# 03 SHAPE & RHYTHM
kick(4.0, 1.0); clap(4.0, 0.5)
PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]
for i, n in enumerate(PENTA): pluck(4.02 + i * 0.03, n, 0.45, 7, pan=np.sin(i * 1.3) * 0.7)
for w in (4.3, 4.8, 5.05):
    for i, n in enumerate([69, 72, 76, 79, 84]): pluck(w + i * 0.05, n, 0.4, 8, pan=(i - 2) * 0.3, bright=0.5)
for b in np.arange(4.0, 6.0, BEAT): kick(b, 0.95)
for b in (4.5, 5.5): clap(b, 0.9)
for b in np.arange(4.25, 6.0, BEAT): hat(b, 0.8)
whoosh(5.3, 0.4, 0.8); whoosh(5.6, 0.22, 0.6, up=False)
riser(5.66, 6.0, 1.0, 400, 12000)
lay_bed(4.0, 6.0, bass_g=0.9)
# 04 PARTICLE SYSTEMS
boom(6.0, 1.1); glass(6.0, 1.0)
for k in range(40):
    tk = 6.1 + rng.uniform(0, 1.7)
    pluck(tk, rng.choice([81, 84, 86, 88, 91, 93]), 0.18, 10, pan=rng.uniform(-1, 1), verb=0.8, bright=0.3)
for b in (6.5, 7.0, 7.5): kick(b, 0.7)
for b in (7.0,): clap(b, 0.7)
for b in np.arange(6.75, 8.0, BEAT): hat(b, 0.5, open_=True)
t = tt(0.7); put(lp(saw(note(45), t, 10), 300) * np.sin(np.pi * t / 0.7) * 0.3, 6.95)   # sphere swell
riser(7.4, 8.0, 1.2, 200, 14000)
lay_bed(6.0, 8.0, bass=False, pad_g=1.4)
# 05 DIMENSION
boom(8.0, 0.85)
for b in np.arange(8.0, 9.75, BEAT): kick(b)
for b in (8.5, 9.5): clap(b)
for b in np.arange(8.25, 9.75, BEAT): hat(b, 0.8)
for b in np.arange(8.0, 9.25, BEAT / 4): hat(b + 0.02, 0.25, pan=-0.4)
for tb in (8.5, 9.0):
    for i, n in enumerate([57, 64, 69, 72, 76]): pluck(tb + i * 0.035, n, 0.45, 5, pan=(i - 2) * 0.25, verb=0.4)
whoosh(9.25, 0.5, 1.0, up=True); revcym(9.75, 0.4, 0.7)
lay_bed(8.0, 9.75)
# 06 INTERFACE
kick(9.75, 0.9); clap(9.75, 0.5)
for b in np.arange(10.25, 11.5, BEAT): kick(b, 0.8)
for b in np.arange(10.0, 11.5, BEAT): hat(b, 0.6)
for i in range(22):                                                  # odometer ticks, decelerating
    tk = 10.0 + 0.85 * (i / 22) ** 1.8
    tick(tk, 0.25, 4000, pan=0.6)
for ft in (10.4, 10.62, 10.84): tick(ft, 0.9, 1800, pan=0.5); pluck(ft + 0.02, 81, 0.3, 14, pan=0.5)
tick(11.08, 1.2, 1200, pan=0.4); tick(11.1, 0.8, 900, pan=0.4)                     # mouse click
bell(11.24, 88, 0.7, pan=0.3); bell(11.32, 93, 0.6, pan=0.3)                     # success
whoosh(11.28, 0.24, 1.0, up=True)
lay_bed(9.75, 11.5, pad_g=0.8, bass_g=0.8)
# 07 SHADERS — a wobbling filtered bass under the liquid
t = tt(0.75); lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 6 * t)
wob = np.tanh(2 * saw(note(33), t, 20)); out = np.zeros_like(wob)
for b in range(0, len(t), 256):
    out[b:b + 256] = sosfilt(butter(2, 150 + 1600 * lfo[b], 'lowpass', fs=SR, output='sos'), wob[b:b + 256])
put(out * 0.45, 11.5); boom(11.5, 0.6)
for i, n in enumerate([76, 79, 83, 88]): pluck(11.55 + i * 0.09, n, 0.3, 4, pan=(i - 1.5) * 0.4, verb=0.9)
riser(11.8, 12.25, 0.9)
lay_bed(11.5, 12.25, bass=False)
# 08 THE CUT — one stutter hit per cut, pitching up
CUTS = [735, 743, 750, 757, 762, 766, 770, 774, 777]
for i, f in enumerate(CUTS): stutter(f / 60, 0.9, 70 * 2 ** (i / 8)); hat(f / 60, 0.5, pan=(-1) ** i * 0.5)
revcym(13.0, 0.75, 1.1)
# 09 RESOLVE
boom(13.0, 1.2, dur=2.0)
t = tt(2.0); ch = sum(saw(note(n), t, 8) for n in [45, 57, 64, 71, 72, 76])
put(lp(ch, 1800) * np.exp(-t * 1.4) * np.minimum(1, t * 40) * 0.05, 13.0, 0, 1.0, verb=0.6)
whoosh(13.46, 0.26, 0.8, up=True)
for i, (tp, n) in enumerate(zip([13.74, 13.78, 13.83, 13.88, 13.95, 14.03], [69, 72, 76, 79, 81, 84])):
    pluck(tp, n, 0.55, 6, pan=-0.6 + i * 0.24, verb=0.5)
kick(14.14, 0.6, duck=False); bell(14.14, 81, 0.9, verb=0.8); bell(14.16, 88, 0.4, pan=0.4, verb=0.8)
for i in range(30): tick(14.2 + i * 0.012, 0.18, rng.uniform(2000, 6000), pan=rng.uniform(-0.5, 0.5))
whoosh(14.76, 0.22, 0.7); tick(14.95, 0.5, 2600)

# ── mix ──────────────────────────────────────────────────────────────────────
bed = (BASS + PAD) * DUCK
L += bed; R += bed
VL += PAD * DUCK * 0.5; VR += PAD * DUCK * 0.5
# synthetic stereo hall: exponentially decaying filtered noise IR
ir_t = np.arange(int(1.8 * SR)) / SR
irL = lp(rng.standard_normal(len(ir_t)), 6000) * np.exp(-ir_t * 3.2); irR = lp(rng.standard_normal(len(ir_t)), 6000) * np.exp(-ir_t * 3.2)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
L += fftconvolve(VL, irL)[:N] * 0.5; R += fftconvolve(VR, irR)[:N] * 0.5
mix = np.stack([L, R], 1)
mix = hp(mix.T, 25).T                                   # clean sub rumble
mix = np.tanh(mix * 0.9 / np.max(np.abs(mix)) * 1.8)    # glue / soft limit
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
fade = np.minimum(1, np.arange(N)[::-1] / (0.02 * SR))
mix *= fade[:, None]
os.makedirs('out', exist_ok=True)
wavfile.write('out/soundtrack.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/soundtrack.wav', mix.shape, 'peak', np.max(np.abs(mix)))
