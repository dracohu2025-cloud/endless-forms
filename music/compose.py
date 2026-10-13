#!/usr/bin/env python3
"""
EUROPA — procedural orchestral score.

Every sample of the soundtrack is synthesised here from first principles
(band-limited oscillators, Karplus-Strong strings, additive bells/pianos,
formant-filtered choirs, synthetic convolution reverb). No samples, no
external audio of any kind.

Tempo is fixed at 120 BPM so one bar == 2 s == 60 video frames at 30 fps;
the video timeline in src/timeline.ts relies on that.

Outputs:
  public/bgm.wav               stereo 44.1 kHz / 16-bit
  src/data/audio.json          per-frame loudness envelopes + hit events
"""

import json
import os
import wave
from functools import lru_cache

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 46
DUR = BARS * BAR
N = int(DUR * SR)
FPS = 30
TAIL = 6 * SR

rng = np.random.default_rng(1789)

# --------------------------------------------------------------------------
# pitch helpers
# --------------------------------------------------------------------------
_NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(n):
    if not isinstance(n, str):
        return int(n)
    letter, rest, acc = n[0], n[1:], 0
    while rest and rest[0] in "#b":
        acc += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + _NOTE[letter] + acc


def hz(n):
    return 440.0 * 2 ** ((midi(n) - 69) / 12)


def T(bar, beat=0.0):
    return bar * BAR + beat * BEAT


# --------------------------------------------------------------------------
# DSP primitives
# --------------------------------------------------------------------------
@lru_cache(None)
def _sos(kind, f, order):
    if kind == "bandpass":
        lo, hi = f
        hi = min(hi, SR * 0.45)
        lo = max(lo, 10)
        return signal.butter(order, (lo, hi), btype="bandpass", fs=SR, output="sos")
    return signal.butter(order, min(f, SR * 0.45), btype=kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(_sos("lowpass", float(f), order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(_sos("highpass", float(f), order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", (float(lo), float(hi)), order), x, axis=0)


def tvec(n):
    return np.arange(n) / SR


def env(dur, a=0.01, d=0.1, s=1.0, r=0.3):
    """ADSR. Returns length (dur + r) seconds. Release is exponential."""
    a = max(a, 1e-4)
    d = max(d, 1e-4)
    n = int((dur + r) * SR)
    t = tvec(n)
    e = np.empty(n)
    att = t < a
    e[att] = t[att] / a
    dec = (~att) & (t < dur)
    e[dec] = s + (1 - s) * np.exp(-(t[dec] - a) / d)
    lvl = dur / a if dur <= a else s + (1 - s) * np.exp(-(dur - a) / d)
    rel = t >= dur
    e[rel] = lvl * np.exp(-(t[rel] - dur) / (r / 5 + 1e-6))
    return e


def saw(freq, n, phase=0.0):
    """PolyBLEP band-limited sawtooth. freq may be scalar or per-sample array."""
    dt = np.full(n, freq / SR) if np.isscalar(freq) else np.asarray(freq) / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def noise(n):
    return rng.uniform(-1, 1, n)


def pan_st(x, pan):
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)


def rms(x):
    return float(np.sqrt(np.mean(np.square(x))) + 1e-12)


def calibrated(target=0.1, mode="rms", **ref):
    """Scale an instrument so a reference note hits a fixed RMS / peak."""

    def deco(fn):
        scale = [None]

        def wrap(*a, **k):
            if scale[0] is None:
                r = fn(**ref)
                lvl = rms(r) if mode == "rms" else float(np.max(np.abs(r)))
                scale[0] = target / lvl
            return fn(*a, **k) * scale[0]

        return wrap

    return deco


# --------------------------------------------------------------------------
# Instruments
# --------------------------------------------------------------------------
@calibrated(f="A3", dur=1.5)
def supersaw(f, dur, voices=7, spread=0.14, cutoff=2400, a=0.5, d=0.6, s=0.9, r=1.2,
             vib=0.0, width=0.85, order=4):
    f = hz(f)
    e = env(dur, a, d, s, r)
    n = len(e)
    t = tvec(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for v in range(voices):
        u = (v / (voices - 1) - 0.5) * 2 if voices > 1 else 0.0
        fv = f * 2 ** (u * spread / 12)
        if vib:
            fv = fv * (1 + vib * np.sin(2 * np.pi * (4.8 + rng.random()) * t + rng.random() * 6.3)
                       * np.clip(t / 0.5, 0, 1))
        y = saw(fv, n, rng.random())
        aa = (u * width + 1) * np.pi / 4
        L += y * np.cos(aa)
        R += y * np.sin(aa)
    st = np.stack([L, R], 1) / np.sqrt(voices)
    st = lp(st, cutoff, order)
    return st * e[:, None]


def pad(notes, t0, dur, gain=1.0, rev=0.5, **kw):
    for nt in notes:
        play(supersaw(nt, dur, **kw), t0, 0.0, gain / np.sqrt(len(notes)), rev)


@calibrated(f="A4", dur=1.0, a=0.1, r=0.5, cutoff=4500)
def strings(f, dur, a=0.1, r=0.5, cutoff=4500, voices=5):
    f = hz(f)
    e = env(dur, a, 0.4, 0.9, r)
    n = len(e)
    t = tvec(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for v in range(voices):
        u = (v / (voices - 1) - 0.5) * 2
        vib = 1 + 0.0045 * np.sin(2 * np.pi * (5.2 + 0.6 * rng.random()) * t + rng.random() * 6.3) \
            * np.clip((t - 0.15) / 0.4, 0, 1)
        y = saw(f * 2 ** (u * 0.07 / 12) * vib, n, rng.random())
        aa = (u * 0.6 + 1) * np.pi / 4
        L += y * np.cos(aa)
        R += y * np.sin(aa)
    st = np.stack([L, R], 1) / np.sqrt(voices)
    st = lp(st, cutoff, 4)
    st = st + 0.25 * bp(st, 2500, 5000)
    return st * e[:, None]


@calibrated(f="A3", dur=0.12, mode="peak", target=0.6)
def spiccato(f, dur=0.12):
    f = hz(f)
    e = env(dur, 0.004, 0.07, 0.2, 0.09)
    n = len(e)
    y = sum(saw(f * 2 ** (u * 0.08 / 12), n, rng.random()) for u in (-1, 0, 1)) / 3
    y = lp(y, 2800, 2)
    return y * e


FORMANTS = {
    "a": [(800, 80, 1.0), (1150, 90, 0.5), (2900, 120, 0.25), (3900, 130, 0.1)],
    "o": [(450, 70, 1.0), (800, 80, 0.55), (2830, 100, 0.12), (3500, 120, 0.06)],
}


@calibrated(f="A3", dur=1.5)
def choir(f, dur, vowel="a", voices=6, a=0.5, r=1.4):
    f = hz(f)
    e = env(dur, a, 0.5, 1.0, r)
    n = len(e)
    t = tvec(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for v in range(voices):
        fv = f * 2 ** (rng.normal(0, 0.09) / 12)
        vib = 1 + 0.006 * np.sin(2 * np.pi * (5 + rng.random()) * t + rng.random() * 6.3)
        y = saw(fv * vib, n, rng.random())
        aa = ((v / (voices - 1) - 0.5) * 1.6 + 1) * np.pi / 4
        L += y * np.cos(aa)
        R += y * np.sin(aa)
    src = np.stack([L, R], 1)
    out = np.zeros_like(src)
    for fc, bw, g in FORMANTS[vowel]:
        out += g * bp(src, fc - bw, fc + bw)
    breath = bp(np.stack([noise(n), noise(n)], 1), 2000, 7000) * 0.03
    return (out + breath) * e[:, None]


@calibrated(f="D4", dur=1.0)
def brass(f, dur, a=0.05, r=0.3, bright=1.0, voices=3):
    f = hz(f)
    e = env(dur, a, 0.35, 0.8, r)
    n = len(e)
    t = tvec(n)
    scoop = 1 - 0.025 * np.exp(-t / 0.035)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.25) / 0.4, 0, 1)
    src = sum(saw(f * 2 ** (u * 0.06 / 12) * scoop * vib, n, rng.random())
              for u in np.linspace(-1, 1, voices)) / voices
    dark = lp(src, f * 2.2, 2)
    brt = lp(src, min(f * 9 * bright, 11000), 2)
    b = np.clip(e * 1.1, 0, 1) ** 1.6 * 0.75 + 0.35 * np.exp(-t / 0.12)
    b = np.clip(b, 0, 1)
    y = np.tanh(1.6 * (dark * (1 - b) + brt * b))
    return y * e


@calibrated(f="A3", dur=2.0, mode="peak", target=0.7)
def pluck(f, dur=2.5, bright=0.6, decay=0.997):
    f = hz(f)
    n = int(dur * SR)
    D = max(2, int(round(SR / f - 0.5)))
    exc = lp(noise(D), 600 + 9000 * bright, 1)
    exc -= exc.mean()
    P = D + 1
    y = np.zeros(n + P)
    y[1:P] = exc
    k = 0.5 * decay
    for s in range(P, n + P, D):
        e_ = min(s + D, n + P)
        y[s:e_] = k * (y[s - D:e_ - D] + y[s - D - 1:e_ - D - 1])
    y = y[1:n + 1]
    fade = np.ones(n)
    fl = int(0.08 * SR)
    fade[-fl:] = np.linspace(1, 0, fl)
    y = hp(y, 60, 1)
    return y * fade


@calibrated(f="D4", dur=4.0, mode="peak", target=0.7)
def bell(f, dur=6.0):
    f = hz(f)
    n = int(dur * SR)
    t = tvec(n)
    parts = [(0.5, 0.55, 4.5), (1.0, 1.0, 3.2), (1.183, 0.55, 2.4), (1.506, 0.45, 2.0),
             (2.0, 0.42, 1.7), (2.514, 0.3, 1.1), (2.662, 0.26, 1.0), (3.011, 0.22, 0.8),
             (4.166, 0.16, 0.55), (5.433, 0.11, 0.4), (6.796, 0.08, 0.28), (8.215, 0.05, 0.2)]
    y = np.zeros(n)
    for ratio, amp, tau in parts:
        for det in (-0.6, 0.6):
            y += amp * np.sin(2 * np.pi * (f * ratio + det) * t + rng.random() * 6.3) * np.exp(-t / tau)
    y += lp(noise(n), 4000, 1) * np.exp(-t / 0.01) * 0.6
    return y


@calibrated(f="A4", dur=1.5, mode="peak", target=0.6)
def piano(f, dur=1.5, vel=0.8):
    f = hz(f)
    n = int((dur + 1.8) * SR)
    t = tvec(n)
    y = np.zeros(n)
    B = 0.00035
    for k in range(1, 18):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 15000:
            break
        amp = (1 / k ** 1.15) * (0.55 + 0.45 * vel) ** (k * 0.35)
        tau = 3.2 / (1 + 0.35 * k) * (220 / f) ** 0.35
        tau2 = tau * 4
        e = 0.7 * np.exp(-t / tau) + 0.3 * np.exp(-t / tau2)
        for det in (-0.35, 0.35):
            y += amp * 0.5 * np.sin(2 * np.pi * (fk + det * k) * t + rng.random() * 6.3) * e
    damp = np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.25))
    y = y * damp * np.clip(t / 0.002, 0, 1)
    y += lp(noise(n), 2500, 1) * np.exp(-t / 0.008) * 0.08
    return y


@calibrated(f="A4", dur=1.0)
def aulos(f, dur, a=0.08, r=0.35):
    f = hz(f)
    e = env(dur, a, 0.3, 0.85, r)
    n = len(e)
    t = tvec(n)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.3 * t) * np.clip((t - 0.2) / 0.4, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    y = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + 0.05 * np.sin(5 * ph)
    breath = bp(noise(n), f * 1.5, min(f * 6, 12000)) * 0.12
    chiff = bp(noise(n), 1500, 6000) * np.exp(-t / 0.03) * 0.4
    return (y + breath + chiff) * e


@calibrated(f="D3", dur=2.0)
def organ(f, dur, a=0.25, r=0.8):
    f = hz(f)
    e = env(dur, a, 0.3, 1.0, r)
    n = len(e)
    t = tvec(n)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 5.5 * t)
    y = np.zeros(n)
    for ratio, amp in [(0.5, 0.6), (1, 1.0), (2, 0.55), (3, 0.35), (4, 0.3), (6, 0.12), (8, 0.1)]:
        y += amp * np.sin(2 * np.pi * f * ratio * t + rng.random() * 6.3)
    return y * e * trem


@calibrated(f="D2", dur=2.0)
def bass(f, dur, a=0.01, r=0.25, drive=1.2):
    f = hz(f)
    e = env(dur, a, 0.25, 0.75, r)
    n = len(e)
    t = tvec(n)
    y = np.sin(2 * np.pi * f * t) + 0.35 * lp(saw(f, n), f * 3, 2)
    return np.tanh(drive * y) * e


# ---- percussion -----------------------------------------------------------
@calibrated(mode="peak", target=0.9)
def taiko(size=1.0):
    n = int(1.8 * SR)
    t = tvec(n)
    f = 42 / size ** 0.4 + 120 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.32 * size ** 0.7))
    skin = lp(noise(n), 1400, 2) * np.exp(-t / 0.045) * 0.7
    click = hp(noise(n), 3000, 2) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.9 * (body + skin + click))


@calibrated(mode="peak", target=0.6)
def frame_drum():
    n = int(0.8 * SR)
    t = tvec(n)
    f = 110 + 90 * np.exp(-t / 0.02)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    jingle = bp(noise(n), 5000, 11000) * np.exp(-t / 0.08) * 0.35
    return body + jingle


@calibrated(mode="peak", target=0.6)
def snare(tight=1.0):
    n = int(0.5 * SR)
    t = tvec(n)
    nz = bp(noise(n), 1500, 8000) * np.exp(-t / (0.11 * tight))
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.6
    return nz + tone


@calibrated(mode="peak", target=0.4)
def tick(f=2600):
    n = int(0.12 * SR)
    t = tvec(n)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.007) + hp(noise(n), 6000) * np.exp(-t / 0.01) * 0.5


@calibrated(mode="peak", target=0.6)
def anvil(f=620):
    n = int(1.2 * SR)
    t = tvec(n)
    y = np.zeros(n)
    for ratio, amp, tau in [(1, 1, 0.35), (2.76, 0.6, 0.2), (5.4, 0.4, 0.12), (8.93, 0.25, 0.07)]:
        y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    y += hp(noise(n), 2500) * np.exp(-t / 0.006)
    return y


@calibrated(mode="peak", target=0.5)
def hiss(dur=0.6):
    n = int(dur * SR)
    t = tvec(n)
    e = np.clip(t / 0.04, 0, 1) * np.exp(-t / (dur * 0.45))
    return bp(noise(n), 2500, 10000) * e


@calibrated(mode="peak", target=0.5)
def chug():
    n = int(0.25 * SR)
    t = tvec(n)
    return bp(noise(n), 150, 1100) * np.exp(-t / 0.05)


@calibrated(f="D2", mode="peak", target=0.8)
def timpani(f="D2", dur=2.0):
    f = hz(f)
    n = int(dur * SR)
    t = tvec(n)
    y = np.zeros(n)
    for ratio, amp, tau in [(1, 1, 0.9), (1.504, 0.5, 0.6), (1.742, 0.3, 0.45), (2.0, 0.25, 0.4), (2.245, 0.15, 0.3)]:
        y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    y += lp(noise(n), 900, 2) * np.exp(-t / 0.03) * 0.5
    return y


@calibrated(mode="peak", target=0.6)
def crash(dur=4.0):
    n = int(dur * SR)
    t = tvec(n)
    nz = np.stack([noise(n), noise(n)], 1)
    body = hp(nz, 3500, 2) * np.exp(-t / 1.1)[:, None]
    shimmer = bp(nz, 6000, 14000) * np.exp(-t / 1.8)[:, None] * 0.5
    ring = np.zeros(n)
    for fr in (3150, 4620, 5980, 7410):
        ring += np.sin(2 * np.pi * fr * t + rng.random() * 6) * np.exp(-t / 0.9)
    return body + shimmer + (ring * 0.06)[:, None]


def rev_cymbal(dur=2.0):
    c = crash(dur + 0.5)[: int(dur * SR)][::-1]
    t = tvec(len(c))
    return c * (np.clip(t / dur, 0, 1) ** 1.5)[:, None]


def riser(dur=4.0):
    n = int(dur * SR)
    t = tvec(n)
    x = t / dur
    nz = noise(n)
    bands = [(200, 800), (800, 2200), (2200, 5500), (5500, 13000)]
    y = np.zeros(n)
    for i, (lo, hi) in enumerate(bands):
        c = (i + 0.5) / len(bands)
        w = np.exp(-((x - c) ** 2) / 0.06)
        y += bp(nz, lo, hi) * w
    glide = np.sin(2 * np.pi * np.cumsum(180 * 2 ** (x * 3.5)) / SR) * 0.25
    out = (y + glide) * x ** 2.2
    return out / (np.max(np.abs(out)) + 1e-9) * 0.6


def impact(size=1.0):
    n = int(3.5 * SR)
    t = tvec(n)
    f = 28 + 60 * np.exp(-t / 0.25)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.1)
    boom = lp(noise(n), 300, 2) * np.exp(-t / 0.35) * 1.2
    y = np.tanh(1.5 * (sub + boom)) * 0.8 * size
    st = pan_st(y, 0.0) + crash(3.5) * 0.55 * size
    tk = taiko(2.0)
    st[: len(tk)] += pan_st(tk, 0) * 0.6 * size
    return st


@calibrated(mode="peak", target=0.9)
def braam(notes=("D1", "D2", "A2", "D3", "Eb3"), dur=3.0):
    n = int((dur + 1.0) * SR)
    t = tvec(n)
    e = env(dur, 0.04, 0.8, 0.6, 1.0)[:n]
    src = np.zeros(n)
    for nt in notes:
        f = hz(nt)
        for u in (-1, 0, 1):
            src += saw(f * 2 ** (u * 0.12 / 12), n, rng.random())
    dark = lp(src, 180, 2)
    brt = lp(src, 2600, 2)
    w = np.clip(np.exp(-t / 0.6) * 1.2, 0, 1)
    y = np.tanh(0.25 * (dark * (1 - w) + brt * w))
    return y * e


def siren(dur=4.0):
    n = int(dur * SR)
    t = tvec(n)
    f = 420 + 260 * (0.5 - 0.5 * np.cos(2 * np.pi * t / dur))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    e = np.sin(np.pi * t / dur) ** 2
    return lp(y, 1800) * e * 0.12


@calibrated(f="D2", dur=4.0)
def drone(f, dur, a=2.0, r=2.0):
    f = hz(f)
    e = env(dur, a, 1.0, 1.0, r)
    n = len(e)
    t = tvec(n)
    y = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t + 1) + 0.3 * np.sin(2 * np.pi * f * 2.002 * t)
    return y * e


def tremolo_strings(notes, dur, rate=12.0):
    n = int((dur + 0.6) * SR)
    t = tvec(n)
    am = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * rate * t))
    am = lp(am, 60, 1)
    out = None
    for nt in notes:
        s = strings(nt, dur, 0.3, 0.6, 3800, 5)[:n]
        out = s if out is None else out[: len(s)] + s
    return out * am[: len(out), None]


# --------------------------------------------------------------------------
# Mixing buses
# --------------------------------------------------------------------------
class Bus:
    def __init__(self):
        self.x = np.zeros((N + TAIL, 2))

    def add(self, sig, t, pan=0.0, gain=1.0):
        i0 = int(round(t * SR))
        if i0 < 0:
            sig = sig[-i0:]
            i0 = 0
        if sig.ndim == 1:
            sig = pan_st(sig, pan)
        n = min(len(sig), len(self.x) - i0)
        if n > 0:
            self.x[i0:i0 + n] += sig[:n] * gain


dry = Bus()
hall = Bus()
events = []  # (time, strength) — drives visual pulses


SECTION_GAIN = {4: 1.4, 5: 1.4, 6: 1.4, 7: 1.4, 16: 1.35, 17: 1.4, 18: 1.4, 19: 1.4}


def play(sig, t, pan=0.0, gain=1.0, rev=0.3):
    gain *= SECTION_GAIN.get(int(t / BAR + 1e-6), 1.0)
    dry.add(sig, t, pan, gain)
    if rev > 0:
        hall.add(sig, t, pan, gain * rev)


def hit(t, strength):
    events.append((round(t, 4), round(strength, 3)))


# --------------------------------------------------------------------------
# Harmony
# --------------------------------------------------------------------------
CH = {
    "Dm": ["D3", "F3", "A3", "D4"], "Bb": ["Bb2", "F3", "Bb3", "D4"], "F": ["F2", "C3", "A3", "F4"],
    "C": ["C3", "G3", "C4", "E4"], "Gm": ["G2", "D3", "Bb3", "D4"], "A": ["A2", "E3", "A3", "C#4"],
    "D": ["D3", "A3", "D4", "F#4"], "Bm": ["B2", "F#3", "B3", "D4"], "G": ["G2", "D3", "B3", "D4"],
    "Asus": ["A2", "E3", "A3", "D4"],
}
ROOTS = {"Dm": "D2", "Bb": "Bb1", "F": "F2", "C": "C2", "Gm": "G1", "A": "A1", "D": "D2",
         "Bm": "B1", "G": "G1", "Asus": "A1"}


def tones(ch, lo, count):
    pcs = sorted({midi(x) % 12 for x in CH[ch]})
    out = []
    m = midi(lo)
    while len(out) < count:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


def melody(notes, bar0, fn, gain, pan=0.0, rev=0.35, shift=0, **kw):
    for beat, dur, nt in notes:
        play(fn(midi(nt) + shift, dur * BEAT, **kw), T(bar0, beat), pan, gain, rev)


# --------------------------------------------------------------------------
# Arrangement
# --------------------------------------------------------------------------
def intro():  # bars 0–4
    play(drone("D2", 8.5, a=3.0, r=2.5), 0, 0, 0.55, 0.4)
    pad(["D3", "A3", "E4"], T(0), 8.0, 0.5, 0.6, a=3.5, r=2.0, cutoff=900)
    pad(["D5", "A5", "E6"], T(1), 6.0, 0.18, 0.9, a=4.0, r=2.0, cutoff=6000, voices=5)
    play(impact(0.45), T(0), 0, 0.6, 0.5)
    hit(T(0), 0.5)
    twinkle = ["D5", "A5", "E6", "F5", "C6", "A5", "D6", "E5", "A6", "F6", "D6", "C6", "A5", "E6"]
    for i, nt in enumerate(twinkle):
        beat = 4 + i * 0.75 + (0.25 if i % 3 == 2 else 0)
        play(pluck(nt, 3.0, 0.85, 0.998), T(0, beat), rng.uniform(-0.8, 0.8), 0.22, 0.9)
    for nt in ["D4", "F4", "A4"]:
        play(choir(nt, 4.0, "a", a=1.5, r=1.0), T(2), 0, 0.28, 0.7)
    play(riser(4.0), T(2), 0, 0.5, 0.4)
    play(rev_cymbal(2.0), T(3), 0, 0.5, 0.2)


def greece():  # bars 4–8
    prog = ["Dm", "Bb", "F", "C"]
    play(impact(0.8), T(4), 0, 0.75, 0.5)
    hit(T(4), 0.9)
    for i, ch in enumerate(prog):
        b = 4 + i
        pad(CH[ch], T(b), 2.0, 0.42, 0.5, a=0.3, r=1.0, cutoff=1600)
        play(bass(ROOTS[ch], 1.9), T(b), 0, 0.5, 0.1)
        tl = tones(ch, "C4", 6)
        for k, idx in enumerate([0, 1, 2, 3, 4, 3, 2, 1]):
            play(pluck(tl[idx], 2.2, 0.55, 0.996), T(b, k * 0.5), -0.4 if k % 2 else 0.4,
                 0.33 if k % 4 == 0 else 0.24, 0.45)
        play(frame_drum(), T(b), -0.2, 0.35, 0.3)
        play(frame_drum(), T(b, 2.5), 0.2, 0.2, 0.3)
        hit(T(b), 0.35)
    mel = [(0, 2, "A4"), (2, 1, "D5"), (3, 1, "E5"), (4, 3, "F5"), (7, 1, "E5"), (8, 2, "C5"),
           (10, 1, "A4"), (11, 1, "C5"), (12, 1, "G4"), (13, 1, "C5"), (14, 2, "E5")]
    melody(mel, 4, aulos, 0.42, 0.1, 0.5)
    play(rev_cymbal(1.5), T(7, 2.5), 0, 0.45, 0.2)


def rome():  # bars 8–12
    prog = ["Dm", "Bb", "Gm", "A"]
    play(impact(1.0), T(8), 0, 0.85, 0.5)
    hit(T(8), 1.0)
    for i, ch in enumerate(prog):
        b = 8 + i
        pad(CH[ch], T(b), 2.0, 0.45, 0.4, a=0.08, r=0.8, cutoff=2000)
        play(bass(ROOTS[ch], 1.95), T(b), 0, 0.6, 0.1)
        r = midi(ROOTS[ch]) + 12
        for k in range(8):
            play(spiccato(r + (12 if k % 4 == 3 else 0)), T(b, k * 0.5), -0.3, 0.35 if k % 2 == 0 else 0.25, 0.25)
            play(spiccato(r + 7 if k % 2 else r), T(b, k * 0.5 + 0.25), 0.3, 0.16, 0.25)
        pat = [(0, 1.6, 1.0), (1.5, 1.0, 0.5), (2, 1.3, 0.75), (3, 1.0, 0.55), (3.5, 1.0, 0.6)]
        for beat, size, g in pat:
            play(taiko(size), T(b, beat), rng.uniform(-0.3, 0.3), g * 0.75, 0.35)
            hit(T(b, beat), g * 0.8)
        play(snare(), T(b, 1), 0.15, 0.22, 0.4)
        play(snare(), T(b, 3), 0.15, 0.22, 0.4)
    for k in range(8):
        play(taiko(0.8), T(11, 2 + k * 0.25), rng.uniform(-0.5, 0.5), 0.25 + k * 0.06, 0.3)
    fan = [(0, 1.5, "D4"), (1.5, 0.5, "A3"), (2, 1, "D4"), (3, 1, "F4"), (4, 1.5, "F4"), (5.5, 0.5, "E4"),
           (6, 1, "D4"), (7, 1, "Bb3"), (8, 1.5, "G4"), (9.5, 0.5, "F4"), (10, 1, "D4"), (11, 1, "Bb3"),
           (12, 1, "A3"), (13, 1, "C#4"), (14, 2, "E4")]
    melody(fan, 8, brass, 0.55, -0.15, 0.4)
    melody(fan, 8, brass, 0.35, 0.2, 0.35, shift=-12, bright=0.6)
    play(rev_cymbal(2.0), T(11), 0, 0.5, 0.2)


def middle_ages():  # bars 12–16
    prog = ["Dm", "C", "Dm", "C"]
    play(impact(0.6), T(12), 0, 0.6, 0.6)
    hit(T(12), 0.7)
    play(bell("D3", 7.0), T(12), -0.25, 0.55, 0.8)
    play(bell("A3", 6.0), T(14), 0.25, 0.4, 0.8)
    hit(T(14), 0.4)
    play(organ("D2", 8.0, a=0.6, r=1.5), T(12), 0, 0.35, 0.6)
    play(organ("A2", 8.0, a=0.6, r=1.5), T(12), 0, 0.22, 0.6)
    for i, ch in enumerate(prog):
        b = 12 + i
        for nt in CH[ch][1:]:
            play(choir(midi(nt) + 12, 2.0, "a", a=0.5, r=1.2), T(b), 0, 0.17, 0.75)
        pad(CH[ch], T(b), 2.0, 0.25, 0.6, a=0.6, r=1.2, cutoff=1100)
    chant = [(0, 1, "D3"), (1, 1, "E3"), (2, 1, "F3"), (3, 1, "G3"), (4, 2, "A3"), (6, 1, "G3"),
             (7, 1, "F3"), (8, 1, "E3"), (9, 1, "F3"), (10, 2, "D3"), (12, 1, "C3"), (13, 1, "D3"),
             (14, 2, "E3")]
    melody(chant, 12, choir, 0.42, 0, 0.7, vowel="o", a=0.15, r=0.6)
    melody(chant, 12, choir, 0.22, 0, 0.7, shift=12, vowel="a", a=0.15, r=0.6)
    play(timpani("D2", 2.5), T(12), 0, 0.5, 0.5)
    play(timpani("A1", 2.5), T(14), 0, 0.4, 0.5)
    play(riser(2.0), T(15), 0, 0.35, 0.3)


def renaissance():  # bars 16–20
    prog = [("F", 0, 4), ("C", 4, 4), ("Dm", 8, 4), ("Bb", 12, 2), ("A", 14, 2)]
    play(impact(0.6), T(16), 0, 0.55, 0.5)
    hit(T(16), 0.7)
    for ch, beat0, length in prog:
        t0 = T(16, beat0)
        pad(CH[ch], t0, length * BEAT, 0.32, 0.45, a=0.2, r=0.9, cutoff=2200)
        play(bass(ROOTS[ch], length * BEAT - 0.05), t0, 0, 0.42, 0.1)
        tl = tones(ch, "F3", 8)
        for bt in range(length):
            shift = [0, 1, 2, 1][(beat0 + bt) % 4]
            for k, idx in enumerate([0, 2, 1, 3]):
                play(pluck(tl[idx + shift], 1.6, 0.75, 0.995), t0 + (bt + k * 0.25) * BEAT,
                     0.45 if k % 2 else -0.45, 0.22 if k == 0 else 0.15, 0.35)
            play(pluck(midi(ROOTS[ch]) + 12, 1.0, 0.3, 0.99), t0 + bt * BEAT, 0, 0.28, 0.2)
            play(tick(7200), t0 + (bt + 0.5) * BEAT, 0.5, 0.12, 0.3)
    vio = [(0, 1, "C5"), (1, 1, "F5"), (2, 1.5, "A5"), (3.5, 0.5, "G5"), (4, 1, "G5"), (5, 1, "E5"),
           (6, 2, "C5"), (8, 1, "D5"), (9, 1, "F5"), (10, 1, "A5"), (11, 1, "D6"), (12, 1, "D6"),
           (13, 0.5, "C6"), (13.5, 0.5, "Bb5"), (14, 2, "A5")]
    melody(vio, 16, lambda f, d: strings(f, d, 0.1, 0.5, 4500, 5), 0.5, 0.1, 0.45)
    melody(vio, 16, lambda f, d: strings(f, d, 0.1, 0.5, 3000, 5), 0.22, -0.2, 0.45, shift=-12)
    play(rev_cymbal(1.5), T(19, 2.5), 0, 0.45, 0.2)


def exploration():  # bars 20–24
    prog = ["Dm", "Bb", "F", "A"]
    play(impact(0.9), T(20), 0, 0.8, 0.5)
    hit(T(20), 0.9)
    for i, ch in enumerate(prog):
        b = 20 + i
        pad(CH[ch], T(b), 2.0, 0.45, 0.45, a=0.1, r=0.9, cutoff=2600)
        play(bass(ROOTS[ch], 1.95), T(b), 0, 0.55, 0.1)
        r = midi(ROOTS[ch]) + 12
        for k in range(16):
            nt = r + [0, 0, 7, 12][k % 4]
            play(spiccato(nt), T(b, k * 0.25), -0.35 if k % 2 else 0.35, 0.32 if k % 4 == 0 else 0.2, 0.2)
        if b >= 22:
            for beat, s in [(0, 1.0), (1.5, 0.5), (2, 0.8), (3, 0.6)]:
                play(taiko(1.2), T(b, beat), rng.uniform(-0.3, 0.3), s * 0.7, 0.35)
                hit(T(b, beat), s * 0.7)
            for k in range(8):
                play(tick(3100), T(b, k * 0.5), 0.6, 0.18, 0.2)
        else:
            play(taiko(1.6), T(b), 0, 0.6, 0.4)
            hit(T(b), 0.6)
    mel = [(0, 2, "D5"), (2, 1, "A4"), (3, 1, "D5"), (4, 2, "F5"), (6, 1, "E5"), (7, 1, "D5"),
           (8, 2, "C5"), (10, 1, "A4"), (11, 1, "C5"), (12, 2, "E5"), (14, 1, "C#5"), (15, 1, "E5")]
    melody(mel, 20, lambda f, d: strings(f, d, 0.08, 0.45, 5000, 5), 0.48, 0.15, 0.45)
    melody(mel, 20, brass, 0.38, -0.15, 0.4, shift=-12)
    play(rev_cymbal(2.0), T(23), 0, 0.5, 0.2)


def enlightenment():  # bars 24–28
    play(impact(0.7), T(24), 0, 0.6, 0.6)
    hit(T(24), 0.7)
    pad(CH["Bb"], T(24), 2.0, 0.4, 0.6, a=0.6, r=1.0, cutoff=2400)
    for nt in ["D4", "F4", "Bb4"]:
        play(choir(nt, 2.0, "a", a=0.8, r=0.8), T(24), 0, 0.22, 0.7)
    play(bass("Bb1", 1.9), T(24), 0, 0.45, 0.1)
    play(riser(2.0), T(24), 0, 0.45, 0.3)
    stabs = [(25, 0, ["C3", "G3", "C4", "E4", "G4"]), (25, 2, ["E3", "G3", "C4", "E4", "C5"]),
             (26, 0, ["D3", "A3", "D4", "F4", "A4", "D5"])]
    for bar, beat, notes in stabs:
        for nt in notes:
            play(brass(nt, 0.9, a=0.015, r=0.6), T(bar, beat), rng.uniform(-0.4, 0.4), 0.42, 0.5)
        play(impact(0.7), T(bar, beat), 0, 0.6, 0.4)
        play(taiko(1.8), T(bar, beat), 0, 0.7, 0.4)
        hit(T(bar, beat), 1.0)
    pad(CH["C"], T(25), 2.0, 0.3, 0.5, a=0.05, r=0.6, cutoff=2800)
    play(bass("C2", 1.95), T(25), 0, 0.5, 0.1)
    for b, ch in [(26, "Dm"), (27, "A")]:
        pad(CH[ch], T(b), 2.0, 0.42, 0.45, a=0.05, r=0.8, cutoff=3000)
        play(bass(ROOTS[ch], 1.95), T(b), 0, 0.55, 0.1)
        r = midi(ROOTS[ch]) + 12
        for k in range(16):
            play(spiccato(r + [0, 12, 7, 12][k % 4]), T(b, k * 0.25), -0.3 if k % 2 else 0.3, 0.22, 0.2)
    march = [0, 0.5, 0.75, 1, 1.5, 2, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
    for bt in march:
        play(snare(0.8), T(26, bt), 0.1, 0.25 + (0.15 if bt % 1 == 0 else 0), 0.35)
    for k in range(32):
        play(snare(0.6), T(27, k * 0.125), 0.1, 0.12 + 0.4 * (k / 32) ** 2, 0.35)
    for k in range(16):
        play(timpani("A1", 0.6), T(27, k * 0.25), 0, 0.15 + 0.4 * (k / 16) ** 2, 0.3)
    play(taiko(1.4), T(26), 0, 0.6, 0.3)
    play(taiko(1.4), T(26, 2), 0, 0.5, 0.3)
    hit(T(26, 2), 0.5)
    play(riser(2.0), T(27), 0, 0.6, 0.3)
    play(rev_cymbal(2.0), T(27), 0, 0.55, 0.2)
    rise = [(0, 2, "D5"), (2, 1, "E5"), (3, 1, "F5"), (4, 2, "E5"), (6, 2, "C#5")]
    melody(rise, 26, lambda f, d: strings(f, d, 0.06, 0.4, 5000, 5), 0.45, 0.1, 0.4)


def industrial():  # bars 28–32
    prog = ["Dm", "F", "Bb", "A"]
    play(impact(1.0), T(28), 0, 0.85, 0.5)
    hit(T(28), 1.0)
    for i, ch in enumerate(prog):
        b = 28 + i
        pad(CH[ch], T(b), 2.0, 0.32, 0.35, a=0.05, r=0.6, cutoff=1800)
        r = midi(ROOTS[ch])
        for k in range(8):
            play(bass(r + (12 if k % 2 else 0), 0.22, r=0.08, drive=2.0), T(b, k * 0.5), 0, 0.55, 0.05)
        for k in range(16):
            play(spiccato(r + 24 + [0, 7, 12, 7][k % 4]), T(b, k * 0.25), 0.4 if k % 2 else -0.4, 0.17, 0.15)
            play(tick(5200 if k % 2 else 4100), T(b, k * 0.25), 0.55, 0.1 + (0.08 if k % 4 == 2 else 0), 0.15)
            if k % 2 == 1:
                play(chug(), T(b, k * 0.25), -0.5, 0.3, 0.1)
        for beat in (0, 2):
            play(taiko(1.3), T(b, beat), 0, 0.75, 0.3)
            hit(T(b, beat), 0.75)
        for beat in (1, 3):
            play(anvil(620 if beat == 1 else 700), T(b, beat), -0.25 if beat == 1 else 0.25, 0.32, 0.4)
            hit(T(b, beat), 0.45)
        play(hiss(0.7), T(b, 3.5), 0.6, 0.3, 0.4)
    line = [(0, 4, "D5"), (4, 4, "C5"), (8, 2, "D5"), (10, 2, "F5"), (12, 4, "E5")]
    melody(line, 28, lambda f, d: strings(f, d, 0.25, 0.6, 4200, 5), 0.42, 0, 0.5)
    melody(line, 28, brass, 0.32, 0, 0.4, shift=-12)
    play(riser(2.0), T(31), 0, 0.55, 0.3)
    play(rev_cymbal(1.5), T(31, 1), 0, 0.6, 0.2)


def wars():  # bars 32–36
    play(impact(1.3), T(32), 0, 1.0, 0.6)
    hit(T(32), 1.3)
    play(braam(("D1", "D2", "A2", "D3", "Eb3"), 3.0), T(32), 0, 0.75, 0.5)
    play(braam(("Bb0", "Bb1", "F2", "Bb2", "Cb3"), 3.0), T(33), 0, 0.7, 0.5)
    play(impact(1.0), T(33), 0, 0.8, 0.6)
    hit(T(33), 1.1)
    for b in (32, 33):
        for beat in (0, 1.5, 2):
            play(taiko(2.0), T(b, beat), 0, 0.7, 0.5)
            hit(T(b, beat), 0.6)
    play(tremolo_strings(["D5", "Eb5"], 3.8), T(32), 0, 0.3, 0.5)
    play(siren(3.8), T(32, 0.5), 0.6, 0.6, 0.9)
    play(drone("D1", 4.0, a=0.05, r=1.5), T(32), 0, 0.6, 0.3)
    # silence, then a lone piano among the ruins
    pno = [(0, 1, "A4"), (1, 1, "F4"), (2, 2, "D4"), (4, 1, "Bb4"), (5, 1, "A4"), (6, 1, "G4"), (7, 1, "E4")]
    for beat, dur, nt in pno:
        play(piano(nt, dur * BEAT + 0.3, 0.6), T(34, beat), 0.05, 0.42, 0.7)
    for nt in ["D3", "A3", "F4"]:
        play(piano(nt, 2.0, 0.4), T(34), -0.1, 0.18, 0.7)
    for nt in ["Bb2", "F3", "D4"]:
        play(piano(nt, 1.0, 0.4), T(35), -0.1, 0.18, 0.7)
    for nt in ["A2", "E3", "C#4"]:
        play(piano(nt, 1.0, 0.4), T(35, 2), -0.1, 0.2, 0.7)
    pad(["D3", "A3"], T(34), 3.9, 0.12, 0.8, a=1.5, r=0.5, cutoff=700)
    play(riser(2.0), T(35), 0, 0.6, 0.4)
    play(rev_cymbal(1.8), T(35, 0.4), 0, 0.6, 0.3)


ODE = [(0, 1, "F#4"), (1, 1, "F#4"), (2, 1, "G4"), (3, 1, "A4"), (4, 1, "A4"), (5, 1, "G4"),
       (6, 1, "F#4"), (7, 1, "E4"), (8, 1, "D4"), (9, 1, "D4"), (10, 1, "E4"), (11, 1, "F#4")]
ODE_END_1 = [(12, 1.5, "F#4"), (13.5, 0.5, "E4"), (14, 2, "E4")]
ODE_END_2 = [(12, 1.5, "E4"), (13.5, 0.5, "D4"), (14, 2, "D4")]


def finale():  # bars 36–46
    harm = {36: ("D", "D"), 37: ("A", "A"), 38: ("D", "Bm"), 39: ("D", "A"),
            40: ("D", "D"), 41: ("A", "A"), 42: ("Bm", "G"), 43: ("A", "Asus")}
    play(impact(1.2), T(36), 0, 0.95, 0.6)
    hit(T(36), 1.2)
    for b, (h1, h2) in harm.items():
        big = b >= 40
        for half, ch in enumerate((h1, h2)):
            t0 = T(b, half * 2)
            pad(CH[ch], t0, 2 * BEAT, 0.5 if big else 0.42, 0.45, a=0.08, r=0.8, cutoff=3200 if big else 2400)
            for nt in CH[ch][1:]:
                play(choir(midi(nt) + 12, 2 * BEAT, "a", a=0.15, r=0.8), t0, 0, 0.15 if big else 0.11, 0.6)
            play(bass(ROOTS[ch], 2 * BEAT - 0.05), t0, 0, 0.6, 0.1)
            tl = tones(ch, "D4", 9)
            steps = 8 if big else 4
            seq = [0, 1, 2, 3, 4, 5, 6, 7] if big else [0, 2, 4, 6]
            for k in range(steps):
                play(pluck(tl[seq[k]] + 12, 1.4, 0.8, 0.995), t0 + k * (2 * BEAT / steps),
                     -0.5 if k % 2 else 0.5, 0.16, 0.5)
        for beat, size, g in [(0, 1.8, 1.0), (1.5, 1.0, 0.45), (2, 1.4, 0.75), (3, 1.0, 0.5), (3.5, 1.0, 0.5)]:
            play(taiko(size), T(b, beat), rng.uniform(-0.3, 0.3), g * (0.8 if big else 0.65), 0.35)
            hit(T(b, beat), g * 0.8)
        if big:
            play(snare(), T(b, 1), 0.1, 0.25, 0.4)
            play(snare(), T(b, 3), 0.1, 0.25, 0.4)
    play(crash(4.0), T(36), 0, 0.5, 0.5)
    play(crash(4.0), T(40), 0, 0.55, 0.5)
    hit(T(40), 1.1)

    p1 = ODE + ODE_END_1
    p2 = ODE + ODE_END_2
    vio = lambda f, d: strings(f, d, 0.06, 0.45, 5500, 5)
    melody(p1, 36, vio, 0.55, 0.1, 0.45, shift=12)
    melody(p1, 36, brass, 0.42, -0.15, 0.4)
    melody(p2, 40, vio, 0.55, 0.1, 0.45, shift=12)
    melody(p2, 40, vio, 0.3, -0.1, 0.45, shift=24)
    melody(p2, 40, brass, 0.48, -0.15, 0.4, shift=12)
    melody(p2, 40, brass, 0.4, 0.15, 0.4)
    melody(p2, 40, choir, 0.35, 0, 0.6, shift=12, vowel="a", a=0.08, r=0.5)
    for i, (beat, _, _) in enumerate(ODE):
        events.append((round(T(36, beat), 4), -1.0 - i))  # star markers (negative = star index)
    for k in range(16):
        play(timpani("A1", 0.6), T(43, 2 + k * 0.125), 0, 0.15 + 0.5 * (k / 16) ** 2, 0.3)
    play(rev_cymbal(2.0), T(43), 0, 0.6, 0.2)

    # bar 44: the final tonic, everything at once
    play(impact(1.4), T(44), 0, 1.0, 0.7)
    hit(T(44), 1.4)
    play(crash(5.0), T(44), 0, 0.6, 0.6)
    final = ["D2", "A2", "D3", "F#3", "A3", "D4", "F#4", "A4", "D5"]
    for nt in final:
        play(brass(nt, 2.6, a=0.03, r=1.6), T(44), rng.uniform(-0.5, 0.5), 0.3, 0.6)
        play(supersaw(nt, 3.0, a=0.05, r=2.5, cutoff=3500), T(44), 0, 0.22, 0.6)
    for nt in ["A4", "D5", "F#5", "A5"]:
        play(choir(nt, 3.0, "a", a=0.2, r=2.0), T(44), 0, 0.2, 0.7)
    play(strings("D6", 3.0, 0.1, 2.0, 6000, 5), T(44), 0, 0.4, 0.6)
    play(bass("D1", 3.0, r=1.5), T(44), 0, 0.6, 0.2)
    play(timpani("D2", 3.0), T(44), 0, 0.7, 0.4)
    gl = tones("D", "D4", 14)
    for k, m in enumerate(gl):
        play(pluck(m + 12, 2.0, 0.9, 0.997), T(44, 0.25 + k * 0.09), -0.7 + 1.4 * k / len(gl), 0.18, 0.7)
    play(bell("D4", 5.0), T(44), 0, 0.3, 0.8)


# --------------------------------------------------------------------------
# Reverb + master
# --------------------------------------------------------------------------
def hall_ir(seconds=3.6, predelay=0.03):
    n = int(seconds * SR)
    t = tvec(n)
    dec = np.exp(-6.9 * t / seconds)
    chans = []
    for _ in range(2):
        x = rng.normal(size=n) * dec
        dark = lp(x, 2200, 1)
        w = np.clip(t / seconds * 1.6, 0, 1)
        x = x * (1 - w) + dark * w
        for _k in range(10):
            i = int(rng.uniform(0.005, 0.08) * SR)
            x[i] += rng.uniform(-1, 1) * 3
        x = np.concatenate([np.zeros(int(predelay * SR)), x])
        chans.append(x / np.sqrt(np.sum(x * x)))
    return chans


def master():
    print("  convolving reverb…")
    irL, irR = hall_ir()
    wet = np.stack([signal.oaconvolve(hall.x[:, 0], irL)[: len(hall.x)],
                    signal.oaconvolve(hall.x[:, 1], irR)[: len(hall.x)]], 1)
    wet = hp(wet, 160, 2)
    wet = lp(wet, 9000, 2)
    mix = dry.x + wet * 1.1
    mix = hp(mix, 32, 2)
    mix = mix - 0.55 * lp(mix, 85, 2)
    mix = mix + 0.4 * bp(mix, 1800, 6500, 1)
    mix = mix[:N]

    # glue compressor
    lvl = np.max(np.abs(mix), axis=1)
    a = np.exp(-1 / (SR * 0.12))
    envl = signal.lfilter([1 - a], [1, -a], lvl)
    thr = np.percentile(envl, 80) * 0.9
    ratio = 2.5
    gain = np.where(envl > thr, (envl / thr) ** (1 / ratio - 1), 1.0)
    g2 = np.exp(-1 / (SR * 0.05))
    gain = signal.lfilter([1 - g2], [1, -g2], gain)
    mix = mix * gain[:, None]

    mix = mix / np.percentile(np.abs(mix), 99.95) * 0.95
    mix = np.tanh(mix * 1.05) / np.tanh(1.05)
    mix = mix / np.max(np.abs(mix)) * 0.93

    t = tvec(N)
    fade = np.clip((DUR - t) / 2.8, 0, 1) ** 1.5
    mix *= np.clip(t / 0.02, 0, 1)[:, None] * fade[:, None]
    return mix


def analyse(mix):
    spf = SR // FPS
    frames = N // spf
    mono = mix.mean(axis=1)
    low = lp(mono, 140, 2)
    high = hp(mono, 3500, 2)

    def env_of(x):
        e = np.sqrt(np.mean(np.square(x[: frames * spf]).reshape(frames, spf), axis=1))
        return e / (np.percentile(e, 98) + 1e-9)

    r, lo, hi = env_of(mono), env_of(low), env_of(high)
    hits = sorted([e for e in events if e[1] > 0])
    stars = sorted([[e[0], int(-e[1] - 1)] for e in events if e[1] < 0])
    return {
        "fps": FPS, "bpm": BPM, "bars": BARS, "frames": int(frames),
        "rms": [round(float(min(v, 1.5)), 3) for v in r],
        "low": [round(float(min(v, 1.5)), 3) for v in lo],
        "high": [round(float(min(v, 1.5)), 3) for v in hi],
        "hits": [[round(t * FPS, 2), s] for t, s in hits],
        "stars": [[round(t * FPS, 2), i] for t, i in stars],
    }


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    sections = [intro, greece, rome, middle_ages, renaissance, exploration,
                enlightenment, industrial, wars, finale]
    for s in sections:
        print(f"  composing {s.__name__}…")
        s()
    mix = master()
    os.makedirs(os.path.join(ROOT, "public"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "src", "data"), exist_ok=True)
    write_wav(os.path.join(ROOT, "public", "bgm.wav"), mix)
    with open(os.path.join(ROOT, "src", "data", "audio.json"), "w") as f:
        json.dump(analyse(mix), f, separators=(",", ":"))
    print(f"  wrote public/bgm.wav ({DUR:.1f}s) and src/data/audio.json")


if __name__ == "__main__":
    main()
