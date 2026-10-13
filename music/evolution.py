#!/usr/bin/env python3
"""
ENDLESS FORMS — procedural electronic score for the evolution film.

Everything is synthesised from oscillators and noise. The lead melody is not
written out: it is *evolved*. A genetic algorithm (cumulative selection, as in
Dawkins' "weasel" program) starts from random notes and breeds towards a
target theme; each 2-bar phrase of the track plays the fittest melody of a
later generation, so the music literally evolves from chaos into a tune.

Tempo is 120 BPM so one bar == 2 s == 60 frames at 30 fps.

Outputs:
  public/evolution.wav          stereo 44.1 kHz / 16-bit
  src/evolution/data/audio.json per-frame envelopes + musical events for sync
"""

import json
import os
import wave

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

rng = np.random.default_rng(1859)

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
_sos_cache = {}


def _sos(kind, f, order):
    key = (kind, f, order)
    if key not in _sos_cache:
        if kind == "bandpass":
            lo, hi = f
            _sos_cache[key] = signal.butter(order, (max(lo, 10), min(hi, SR * 0.45)), btype="bandpass", fs=SR, output="sos")
        else:
            _sos_cache[key] = signal.butter(order, min(f, SR * 0.45), btype=kind, fs=SR, output="sos")
    return _sos_cache[key]


def lp(x, f, order=2):
    return signal.sosfilt(_sos("lowpass", float(f), order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(_sos("highpass", float(f), order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", (float(lo), float(hi)), order), x, axis=0)


def tvec(n):
    return np.arange(n) / SR


def env(dur, a=0.01, d=0.1, s=1.0, r=0.3):
    a, d = max(a, 1e-4), max(d, 1e-4)
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


def norm_peak(x, target):
    return x / (np.max(np.abs(x)) + 1e-12) * target


def sweep_filter(x, f0, f1, n_chunks=48, order=2):
    """Lowpass whose cutoff glides exponentially from f0 to f1 over the signal."""
    out = np.zeros_like(x)
    edges = np.linspace(0, len(x), n_chunks + 1).astype(int)
    pad = int(0.02 * SR)
    for i in range(n_chunks):
        a, b = edges[i], edges[i + 1]
        fc = f0 * (f1 / f0) ** ((i + 0.5) / n_chunks)
        s = max(0, a - pad)
        y = lp(x[s:b], fc, order)
        out[a:b] = y[a - s:]
    return out


# --------------------------------------------------------------------------
# Instruments
# --------------------------------------------------------------------------
def bubble(f0=None):
    """Minnaert bubble: a sine whose pitch rises as it decays."""
    f0 = f0 or rng.uniform(380, 1600)
    dur = rng.uniform(0.05, 0.14)
    n = int(dur * SR)
    t = tvec(n)
    f = f0 * (1 + 2.2 * t / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.3)) * np.clip(t / 0.002, 0, 1)
    return y * 0.5


def bloop(f, dur=1.2):
    """Round sine 'cell' tone: slight downward pitch dip and soft FM shimmer."""
    f = hz(f)
    n = int(dur * SR)
    t = tvec(n)
    fr = f * (1 + 0.5 * np.exp(-t / 0.012))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    y = np.sin(ph + 0.6 * np.exp(-t / 0.15) * np.sin(2 * ph))
    return y * np.exp(-t / (dur * 0.35)) * np.clip(t / 0.003, 0, 1)


def fm(f, dur, ratio=3.5, index=2.4, idx_tau=0.25, a=0.002, r=0.6, tau=None):
    """Two-operator FM. ratio 1 → e-piano, 3.5 → glass, 1.4 → metallic."""
    f = hz(f)
    e = env(dur, a, 0.4, 0.7, r) if tau is None else None
    n = int((dur + r) * SR)
    t = tvec(n)
    if e is None:
        e = np.exp(-t / tau) * np.clip(t / a, 0, 1)
    I = index * np.exp(-t / idx_tau) + 0.15
    y = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * ratio * t))
    return y * e[:n]


def arp_pluck(f, dur=0.22, bright=1.0):
    """Filtered dual-saw pluck — the pulsing arpeggio voice."""
    f = hz(f)
    n = int((dur + 0.35) * SR)
    t = tvec(n)
    src = saw(f, n, rng.random()) + 0.6 * saw(f * 1.005, n, rng.random()) + 0.4 * np.sign(np.sin(2 * np.pi * f * 0.5 * t))
    dark = lp(src, 380 + 300 * bright, 2)
    brt = lp(src, 1600 + 4200 * bright, 2)
    w = np.exp(-t / 0.06)
    e = np.exp(-t / (dur * 0.6)) * np.clip(t / 0.002, 0, 1)
    return (dark * (1 - w) + brt * w) * e * 0.4


def supersaw(f, dur, voices=7, spread=0.18, cutoff=3200, a=0.02, r=0.5):
    f = hz(f)
    e = env(dur, a, 0.5, 0.85, r)
    n = len(e)
    L = np.zeros(n)
    R = np.zeros(n)
    for v in range(voices):
        u = (v / (voices - 1) - 0.5) * 2
        y = saw(f * 2 ** (u * spread / 12), n, rng.random())
        aa = (u * 0.9 + 1) * np.pi / 4
        L += y * np.cos(aa)
        R += y * np.sin(aa)
    st = lp(np.stack([L, R], 1) / np.sqrt(voices), cutoff, 2)
    return st * e[:, None]


def warm_pad(notes, dur, cutoff=1400, a=1.2, r=2.0, voices=5):
    out = None
    for nt in notes:
        s = supersaw(nt, dur, voices=voices, spread=0.22, cutoff=cutoff, a=a, r=r)
        out = s if out is None else out[: len(s)] + s[: len(out)]
    return out / np.sqrt(len(notes))


def glass_lead(f, dur, vib=True):
    f = hz(f)
    e = env(dur, 0.012, 0.25, 0.75, 0.45)
    n = len(e)
    t = tvec(n)
    v = 1 + (0.005 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.15) / 0.3, 0, 1) if vib else 0)
    ph = 2 * np.pi * np.cumsum(f * v) / SR
    y = np.sin(ph + 0.9 * np.exp(-t / 0.08) * np.sin(3 * ph)) + 0.25 * np.sin(2 * ph)
    y += 0.18 * lp(saw(f * v, n), f * 4, 2)
    return y * e


def sub_bass(f, dur, drive=1.6):
    f = hz(f)
    e = env(dur, 0.005, 0.2, 0.85, 0.12)
    n = len(e)
    t = tvec(n)
    y = np.sin(2 * np.pi * f * t) + 0.3 * lp(saw(f, n), f * 4, 2)
    return np.tanh(drive * y) * e


def kick(punch=1.0):
    n = int(0.55 * SR)
    t = tvec(n)
    f = 46 + 140 * np.exp(-t / 0.035) * punch
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    click = hp(noise(n), 2500) * np.exp(-t / 0.003) * 0.4
    return np.tanh(1.8 * (body + click)) * 0.9


def clap():
    n = int(0.45 * SR)
    t = tvec(n)
    e = np.zeros(n)
    for k, off in enumerate((0, 0.009, 0.019, 0.03)):
        tt = t - off
        e += np.where(tt >= 0, np.exp(-np.maximum(tt, 0) / (0.006 if k < 3 else 0.12)), 0)
    return bp(noise(n), 900, 4200) * e * 0.55


def hat(open_=False):
    n = int((0.3 if open_ else 0.06) * SR)
    t = tvec(n)
    y = hp(noise(n), 7500, 2) * np.exp(-t / (0.09 if open_ else 0.014))
    return y * 0.35


def shaker():
    n = int(0.09 * SR)
    t = tvec(n)
    e = np.clip(t / 0.015, 0, 1) * np.exp(-t / 0.03)
    return bp(noise(n), 4000, 11000) * e * 0.3


def tom(f=58, size=1.0):
    n = int(1.4 * SR)
    t = tvec(n)
    fr = f + 90 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / (0.45 * size))
    skin = lp(noise(n), 900, 2) * np.exp(-t / 0.05) * 0.6
    return np.tanh(2.2 * (body + skin)) * 0.9


def impact():
    n = int(6.0 * SR)
    t = tvec(n)
    f = 24 + 70 * np.exp(-t / 0.3)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.6)
    boom = lp(noise(n), 260, 2) * np.exp(-t / 0.6) * 1.4
    crack = hp(noise(n), 1500, 2) * np.exp(-t / 0.05) * 0.8
    debris = bp(noise(n), 300, 3000) * np.exp(-t / 2.2) * 0.25 * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t) ** 2)
    y = np.tanh(1.6 * (sub + boom + crack)) + debris
    return np.stack([y, np.roll(y, int(0.011 * SR))], 1) * 0.95


def whoosh(dur=2.0, rise=True):
    n = int(dur * SR)
    t = tvec(n)
    x = t / dur if rise else 1 - t / dur
    nz = noise(n)
    y = sweep_filter(nz, 300, 9000, 32) if rise else sweep_filter(nz, 9000, 300, 32)
    e = x ** 2.5 if rise else np.exp(-t / (dur * 0.3))
    return y * e * 0.6


def riser(dur=4.0):
    n = int(dur * SR)
    t = tvec(n)
    x = t / dur
    nz = sweep_filter(noise(n), 400, 12000, 40)
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (x * 3)) / SR) * 0.25
    return (nz * 0.7 + tone) * x ** 2.4


def chirp():
    """FM bird call: a quick downward-upward pitch flick."""
    dur = rng.uniform(0.08, 0.18)
    n = int(dur * SR)
    t = tvec(n)
    f0 = rng.uniform(2600, 4200)
    f = f0 * (1 + 0.35 * np.sin(np.pi * t / dur * rng.uniform(1, 3)))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR + 1.5 * np.sin(2 * np.pi * 70 * t))
    return y * np.sin(np.pi * t / dur) ** 2 * 0.3


def drone(f, dur, a=3.0, r=3.0):
    f = hz(f)
    e = env(dur, a, 1.0, 1.0, r)
    n = len(e)
    t = tvec(n)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t)
    y = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.003 * t) * lfo + 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * (1 - lfo)
    return y * e


def ocean(dur):
    """Deep-water rumble: brown noise with slow swells."""
    n = int(dur * SR)
    t = tvec(n)
    br = np.cumsum(noise(n))
    br = hp(br - np.convolve(br, np.ones(4410) / 4410, "same"), 25, 2)
    br = lp(br, 420, 2)
    br = br / (np.max(np.abs(br)) + 1e-9)
    sw = 0.6 + 0.4 * np.sin(2 * np.pi * t / 7.3) * np.sin(2 * np.pi * t / 3.1 + 1)
    return np.stack([br * sw, np.roll(br, 3000) * sw], 1)


# --------------------------------------------------------------------------
# Buses: dry, reverb send, delay send, and a sidechained "pump" bus
# --------------------------------------------------------------------------
class Bus:
    def __init__(self):
        self.x = np.zeros((N + TAIL, 2))

    def add(self, sig, t, pan=0.0, gain=1.0):
        i0 = int(round(t * SR))
        if sig.ndim == 1:
            sig = pan_st(sig, pan)
        if i0 < 0:
            sig, i0 = sig[-i0:], 0
        n = min(len(sig), len(self.x) - i0)
        if n > 0:
            self.x[i0:i0 + n] += sig[:n] * gain


dry, pump, verb, delay = Bus(), Bus(), Bus(), Bus()
kick_env = np.zeros(N + TAIL)
events = []


def ev(kind, t, **data):
    events.append({"k": kind, "f": round(t * FPS, 2), **data})


def play(sig, t, pan=0.0, gain=1.0, rev=0.25, dly=0.0, side=False):
    (pump if side else dry).add(sig, t, pan, gain)
    if rev:
        verb.add(sig, t, pan, gain * rev)
    if dly:
        delay.add(sig, t, pan, gain * dly)


def play_kick(t, gain=1.0, punch=1.0):
    k = kick(punch)
    play(k, t, 0, gain, rev=0.05)
    i0 = int(t * SR)
    n = int(0.32 * SR)
    kick_env[i0:i0 + n] = np.maximum(kick_env[i0:i0 + n], np.exp(-tvec(n) / 0.11))
    ev("kick", t, s=round(gain, 2))


# --------------------------------------------------------------------------
# Harmony
# --------------------------------------------------------------------------
CH = {
    "Am": ["A2", "E3", "A3", "C4", "E4", "B4"],
    "F": ["F2", "C3", "A3", "C4", "E4", "G4"],
    "C": ["C3", "G3", "C4", "E4", "G4", "D5"],
    "G": ["G2", "D3", "B3", "D4", "G4", "A4"],
    "Dm": ["D3", "A3", "D4", "F4", "A4", "E5"],
    "E": ["E2", "B2", "G#3", "B3", "E4", "F#4"],
    "Esus": ["E2", "B2", "A3", "B3", "E4", "F#4"],
    "A": ["A2", "E3", "A3", "C#4", "E4", "B4"],
}
ROOT_OF = {"Am": "A1", "F": "F1", "C": "C2", "G": "G1", "Dm": "D2", "E": "E1", "Esus": "E1", "A": "A1"}
PROG = ["Am", "F", "C", "G"]


def arp_notes(ch, pattern=(2, 3, 4, 3, 5, 4, 3, 4)):
    tones = CH[ch]
    return [tones[i % len(tones)] for i in pattern]


# --------------------------------------------------------------------------
# The evolved melody
# --------------------------------------------------------------------------
SCALE = ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"]
H = -1  # hold previous note
TARGET = [
    7, H, 9, H, 11, H, H, 10,
    9, H, H, H, 7, H, 4, H,
    11, H, 13, H, 14, H, 13, 11,
    10, H, H, H, 9, H, 8, H,
]
GENES = list(range(len(SCALE))) + [H]


def evolve(pop_size=48, mut=0.035, max_gen=400, seed=7):
    """Cumulative selection towards TARGET. Returns [(gen, genome, fitness)]."""
    r = np.random.default_rng(seed)
    L = len(TARGET)
    target = np.array(TARGET)
    pop = r.choice(GENES, size=(pop_size, L))
    history = []
    for g in range(max_gen):
        fit = (pop == target).sum(1)
        best = int(np.argmax(fit))
        history.append((g, pop[best].tolist(), int(fit[best]) / L))
        if fit[best] == L:
            break
        order = np.argsort(-fit)
        parents = pop[order[: pop_size // 4]]
        kids = parents[r.integers(0, len(parents), pop_size)]
        mates = parents[r.integers(0, len(parents), pop_size)]
        cross = r.random((pop_size, L)) < 0.5
        kids = np.where(cross, kids, mates)
        m = r.random((pop_size, L)) < mut
        kids = np.where(m, r.choice(GENES, size=(pop_size, L)), kids)
        kids[0] = pop[best]
        pop = kids
    return history


HISTORY = evolve()
FINAL_GEN = HISTORY[-1][0]
print(f"  melody converged after {FINAL_GEN} generations")


def gen_for_phrase(k, n_phrases):
    """Ease generations so convergence lands on the last evolving phrase."""
    x = k / (n_phrases - 1)
    return min(FINAL_GEN, int(round(FINAL_GEN * x ** 1.7)))


def melody_events(genome):
    """Genome → [(eighth_index, length_in_eighths, note)]."""
    out = []
    for i, gnum in enumerate(genome):
        if gnum == H:
            if out:
                out[-1][1] += 1
            continue
        out.append([i, 1, SCALE[gnum]])
    return out


def play_phrase(genome, bar0, voice="glass", gain=0.3, octave=0, fit=1.0):
    for i, ln, note in melody_events(genome):
        t = T(bar0) + i * BEAT / 2
        nn = midi(note) + 12 * octave
        dur = ln * BEAT / 2 * 0.92
        if voice == "glass":
            s = glass_lead(nn, dur)
        elif voice == "bell":
            s = fm(nn, dur, ratio=3.5, index=1.6, idx_tau=0.2, tau=0.9)
        elif voice == "keys":
            s = fm(nn, dur, ratio=1.0, index=2.0, idx_tau=0.35, tau=1.4)
        else:
            s = fm(nn, dur, ratio=2.0, index=1.0, idx_tau=0.1, tau=0.25)
        play(s, t, pan=rng.uniform(-0.25, 0.25), gain=gain, rev=0.35, dly=0.35)
        ev("note", t, n=int(nn), l=ln)


# --------------------------------------------------------------------------
# Sections
# --------------------------------------------------------------------------
GA_PHRASES = []  # (bar, generation, fitness) — shown on the HUD


def ga_lead():
    """The evolving lead runs from bar 2 to bar 34 (16 phrases × 2 bars)."""
    voices = {2: "blip", 4: "blip", 6: "bell", 8: "bell", 10: "bell", 12: "glass", 14: "glass", 16: "bell",
              18: "glass", 20: "glass", 22: None, 24: None, 26: "keys", 28: "keys", 30: "glass", 32: "glass"}
    gains = {2: 0.16, 4: 0.18, 6: 0.2, 8: 0.22, 10: 0.24, 12: 0.27, 14: 0.27, 16: 0.24, 18: 0.27,
             20: 0.22, 26: 0.3, 28: 0.3, 30: 0.3, 32: 0.32}
    bars = list(range(2, 34, 2))
    for k, b in enumerate(bars):
        g = gen_for_phrase(k, len(bars))
        _, genome, fit = HISTORY[g]
        GA_PHRASES.append({"bar": b, "gen": g, "fit": round(fit, 3), "genome": genome})
        v = voices[b]
        if v:
            play_phrase(genome, b, voice=v, gain=gains[b], octave=0 if v != "blip" else 1, fit=fit)
    GA_PHRASES.append({"bar": 34, "gen": FINAL_GEN, "fit": 1.0, "genome": TARGET})


def primordial():  # bars 0–4
    play(ocean(10.0), 0, gain=0.5, rev=0.2)
    play(drone("A1", 8.0, a=2.5, r=2.0), 0, gain=0.35, rev=0.3)
    play(drone("E2", 6.0, a=3.0, r=2.0), T(1), gain=0.18, rev=0.4)
    t = 0.3
    while t < T(4):
        dens = 0.35 + 0.65 * (t / T(4))
        play(bubble(), t, pan=rng.uniform(-0.8, 0.8), gain=rng.uniform(0.1, 0.3) * dens, rev=0.4)
        t += rng.exponential(0.16 / dens)
    play(whoosh(2.0), T(3), gain=0.35, rev=0.3)


DIVISIONS = [(4, 0), (5, 0), (6, 0), (6, 2), (7, 0), (7, 2), (7, 3)]


def first_cell():  # bars 4–8
    play(warm_pad(["A2", "E3", "B3", "C4"], 8.0, cutoff=900, a=2.0, r=2.5), T(4), gain=0.22, rev=0.5)
    play(drone("A1", 8.0, a=0.5, r=2.0), T(4), gain=0.3, rev=0.2)
    pitches = ["A3", "E4", "A4", "C5", "E5", "A5", "B5"]
    for i, (b, beat) in enumerate(DIVISIONS):
        t = T(b, beat)
        play(bloop(pitches[i], 1.6), t, gain=0.5, rev=0.45, dly=0.2)
        play(bloop(midi(pitches[i]) - 12, 1.2), t, gain=0.25, rev=0.3)
        for _ in range(3 + i):
            play(bubble(), t + rng.uniform(0, 0.25), pan=rng.uniform(-0.6, 0.6), gain=0.15, rev=0.4)
        ev("div", t, n=2 ** i)
    # arpeggio density doubles with each division: whole, half, quarter, eighth notes
    rates = {4: 1, 5: 2, 6: 4, 7: 8}
    for b, per in rates.items():
        tones = arp_notes("Am", (2, 4, 3, 5, 4, 3, 5, 2))
        for k in range(per):
            t = T(b) + k * BAR / per
            play(fm(tones[k % 8], 0.4, ratio=3.5, index=1.4, tau=0.6), t, pan=0.4 * np.sin(k), gain=0.22, rev=0.4, dly=0.3)


def colony():  # bars 8–12
    for i, ch in enumerate(PROG):
        b = 8 + i
        play(warm_pad(CH[ch][1:5], BAR, cutoff=900 + 500 * i, a=0.3, r=1.2), T(b), gain=0.18, rev=0.45, side=True)
        play(sub_bass(ROOT_OF[ch], BAR * 0.95, drive=1.2), T(b), gain=0.25, rev=0, side=True)
        tones = arp_notes(ch)
        for k in range(16):
            play(arp_pluck(tones[k % 8], 0.2, bright=0.2 + 0.2 * i + k / 64), T(b) + k * BEAT / 4,
                 pan=0.35 * np.sin(k * 1.3), gain=0.24, rev=0.25, dly=0.2)
    for b in (10, 11):
        for q in range(4):
            play_kick(T(b, q), gain=0.45 + 0.15 * (b - 10))
    for k in range(16):
        play(clap(), T(11) + k * BEAT / 4, gain=0.1 + 0.4 * k / 16, rev=0.3)
    play(riser(4.0), T(10), gain=0.45, rev=0.3)


def groove(b0, bars, prog, arp_bright=0.8, hats=True, claps=True, kick_gain=1.0, pad_cut=2400, bass_gain=0.42):
    for i in range(bars):
        b = b0 + i
        ch = prog[i % len(prog)]
        play(warm_pad(CH[ch][1:5], BAR, cutoff=pad_cut, a=0.05, r=0.8), T(b), gain=0.2, rev=0.4, side=True)
        tones = arp_notes(ch)
        for k in range(16):
            play(arp_pluck(tones[k % 8], 0.18, bright=arp_bright), T(b) + k * BEAT / 4, pan=0.4 * np.sin(k * 1.3),
                 gain=0.2, rev=0.2, dly=0.18, side=True)
        for q in range(4):
            play_kick(T(b, q), gain=0.95 * kick_gain)
            play(sub_bass(ROOT_OF[ch], BEAT * 0.42), T(b, q + 0.5), gain=bass_gain, rev=0, side=True)
            if hats:
                play(hat(True), T(b, q + 0.5), pan=0.2, gain=0.85, rev=0.15)
                for s in (0.25, 0.75):
                    play(hat(), T(b, q + s), pan=-0.3, gain=0.6)
        if claps:
            for q in (1, 3):
                play(clap(), T(b, q), gain=0.55, rev=0.25)
                ev("clap", T(b, q))


def cambrian():  # bars 12–16
    play(impact(), T(12), gain=0.55, rev=0.3)
    ev("drop", T(12))
    groove(12, 4, PROG)


def to_land():  # bars 16–20 — underwater, then surfacing at bar 18
    seg = Bus()
    for i in range(4):
        b = 16 + i
        ch = ["F", "G", "Am", "C"][i]
        seg.add(warm_pad(CH[ch][1:5], BAR, cutoff=1600, a=0.2, r=1.0), T(b - 16), gain=0.22)
        tones = arp_notes(ch)
        for k in range(16):
            seg.add(arp_pluck(tones[k % 8], 0.2, bright=0.7), T(b - 16) + k * BEAT / 4, pan=0.4 * np.sin(k), gain=0.22)
        for q in range(4):
            if b >= 18 or q % 2 == 0:
                play_kick(T(b, q), gain=0.75 if b < 18 else 0.95)
            seg.add(sub_bass(ROOT_OF[ch], BEAT * 0.42), T(b - 16, q + 0.5), gain=0.38)
    x = seg.x[: int(T(4) * SR)]
    k = int(T(2) * SR)
    x[:k] = lp(x[:k], 650, 2) * 1.5
    x[k:] = sweep_filter(x[k:], 900, 16000, 24)
    play(x, T(16), gain=1.0, rev=0.3, side=True)
    for b in (18, 19):
        for q in range(4):
            play(hat(True), T(b, q + 0.5), gain=0.45)
    play(whoosh(1.5), T(17, 2), gain=0.4, rev=0.3)
    play(impact()[: int(2.5 * SR)], T(18), gain=0.3, rev=0.3)
    ev("surface", T(18))


def dinosaurs():  # bars 20–24
    prog = ["Am", "Am", "Dm", "Esus"]
    for i, ch in enumerate(prog):
        b = 20 + i
        play(warm_pad([n for n in CH[ch][:4]], BAR, cutoff=700, a=0.1, r=1.5, voices=7), T(b), gain=0.3, rev=0.5)
        play(sub_bass(ROOT_OF[ch], BAR * 0.9, drive=2.5), T(b), gain=0.35, rev=0)
        for q in (0, 2):
            play(tom(52, 1.3), T(b, q), gain=0.9, rev=0.35)
            play_kick(T(b, q), gain=0.7, punch=0.6)
            ev("step", T(b, q))
        play(tom(78, 0.8), T(b, 3.5), gain=0.45, rev=0.3)
        for k in range(8):
            play(shaker(), T(b) + k * BEAT / 2, pan=0.5, gain=0.4)
    play(whoosh(2.0), T(23), gain=0.7, rev=0.4)
    play(riser(2.0), T(23), gain=0.4, rev=0.3)


def extinction():  # bars 24–26
    play(impact(), T(24), gain=1.0, rev=0.6)
    play(impact(), T(24) + 0.02, gain=0.4, rev=0.3)
    ev("impact", T(24))
    n = int(3.5 * SR)
    t = tvec(n)
    ring = np.sin(2 * np.pi * 3520 * t) * np.exp(-t / 1.6) * np.clip(t / 0.4, 0, 1) * 0.05
    play(ring, T(24, 1), gain=1.0, rev=0.2)
    play(drone("A1", 3.5, a=1.0, r=1.5), T(24, 2), gain=0.25, rev=0.5)


def mammals():  # bars 26–30
    for i, ch in enumerate(PROG):
        b = 26 + i
        for j, nt in enumerate(CH[ch][1:5]):
            play(fm(nt, BAR * 0.9, ratio=1.0, index=1.6, idx_tau=0.4, tau=1.6), T(b) + j * 0.03, gain=0.12, rev=0.5)
        play(sub_bass(ROOT_OF[ch], BAR * 0.9, drive=0.8), T(b), gain=0.18, rev=0)
        for k in range(8):
            play(shaker(), T(b) + k * BEAT / 2, pan=-0.4, gain=0.25 + 0.15 * (k % 2))
        if b >= 28:
            for q in range(4):
                play_kick(T(b, q), gain=0.55)
    for _ in range(18):
        t = T(28) + rng.uniform(0, BAR * 2)
        for c in range(rng.integers(2, 5)):
            play(chirp(), t + c * 0.11, pan=rng.uniform(-0.8, 0.8), gain=0.5, rev=0.5)
    ev("bird", T(28))


def humans():  # bars 30–34
    groove(30, 4, PROG, arp_bright=0.5, hats=True, claps=False, kick_gain=0.75, pad_cut=1800, bass_gain=0.32)
    for b in (32, 33):
        for q in (1, 3):
            play(clap(), T(b, q), gain=0.45, rev=0.3)
    for k in range(32):
        play(clap(), T(33) + k * BEAT / 8, gain=0.05 + 0.3 * k / 32, rev=0.3)
    play(riser(4.0), T(32), gain=0.55, rev=0.3)


def climax(b0, bars, octave_lead=False):
    groove(b0, bars, PROG, arp_bright=1.1, pad_cut=4200, bass_gain=0.45)
    for i in range(bars):
        b = b0 + i
        ch = PROG[i % 4]
        play(warm_pad(CH[ch][2:6], BAR, cutoff=5200, a=0.02, r=0.6, voices=7), T(b), gain=0.16, rev=0.35, side=True)
    for p in range(0, bars, 4):
        play_phrase(TARGET, b0 + p, voice="glass", gain=0.46)
        if octave_lead:
            play_phrase(TARGET, b0 + p, voice="bell", gain=0.18, octave=1)


def dna():  # bars 34–38
    play(impact(), T(34), gain=0.6, rev=0.4)
    ev("drop", T(34))
    climax(34, 4)


def tree():  # bars 38–42
    play(impact()[: int(3 * SR)], T(38), gain=0.45, rev=0.4)
    ev("drop", T(38))
    climax(38, 4, octave_lead=True)
    play(riser(2.0), T(41), gain=0.4, rev=0.3)


def coda():  # bars 42–46
    play(warm_pad(["A2", "E3", "C4", "E4", "B4"], 4.0, cutoff=1500, a=0.2, r=3.0), T(42), gain=0.28, rev=0.6)
    play(warm_pad(["F2", "C3", "A3", "E4", "G4"], 4.0, cutoff=1300, a=0.6, r=3.0), T(44), gain=0.26, rev=0.6)
    for i, ln, note in melody_events(TARGET[:16]):
        play(fm(note, ln * BEAT * 0.9, ratio=1.0, index=1.4, idx_tau=0.5, tau=2.0), T(42) + i * BEAT, gain=0.22, rev=0.6, dly=0.3)
    play(sub_bass("A1", 3.8, drive=0.8), T(42), gain=0.2, rev=0)
    play(bloop("A4", 3.0), T(45), gain=0.45, rev=0.6, dly=0.4)
    play(bloop("A3", 3.0), T(45), gain=0.25, rev=0.5)
    ev("div", T(45), n=1)


# --------------------------------------------------------------------------
# Delay, reverb and master
# --------------------------------------------------------------------------
def pingpong(x, time=0.375, fb=0.42, n_taps=7):
    out = np.zeros_like(x)
    d = int(time * SR)
    src = lp(hp(x, 300, 1), 5000, 1)
    for k in range(1, n_taps + 1):
        g = fb ** k
        ch = k % 2
        sh = d * k
        out[sh:, ch] += src[:-sh, 0 if ch else 1] * g + src[:-sh, ch] * g * 0.3
    return out


def space_ir(seconds=4.5, predelay=0.04):
    n = int(seconds * SR)
    t = tvec(n)
    dec = np.exp(-6.9 * t / seconds)
    chans = []
    for _ in range(2):
        x = rng.normal(size=n) * dec
        dark = lp(x, 3000, 1)
        w = np.clip(t / seconds * 1.4, 0, 1)
        x = x * (1 - w) + dark * w
        x = np.concatenate([np.zeros(int(predelay * SR)), x])
        chans.append(x / np.sqrt(np.sum(x * x)))
    return chans


def master():
    print("  sidechain, delay, reverb…")
    duck = 1 - 0.72 * lp(kick_env, 40, 1)
    sc = pump.x * duck[:, None]
    dl = pingpong(delay.x)
    irL, irR = space_ir()
    wet_src = verb.x + dl * 0.35
    wet = np.stack([signal.oaconvolve(wet_src[:, 0], irL)[: len(wet_src)],
                    signal.oaconvolve(wet_src[:, 1], irR)[: len(wet_src)]], 1)
    wet = lp(hp(wet, 180, 2), 10000, 2)
    mix = dry.x + sc + dl * 0.55 + wet * 1.0
    mix = hp(mix, 28, 2)
    mix = mix - 0.5 * lp(mix, 70, 2)
    mix = mix + 0.5 * bp(mix, 2500, 9000, 1) + 0.35 * hp(mix, 9000, 1)
    mix = mix[:N]

    lvl = np.max(np.abs(mix), axis=1)
    a = np.exp(-1 / (SR * 0.1))
    envl = signal.lfilter([1 - a], [1, -a], lvl)
    thr = np.percentile(envl, 78) * 0.9
    gain = np.where(envl > thr, (envl / thr) ** (1 / 2.8 - 1), 1.0)
    g2 = np.exp(-1 / (SR * 0.04))
    gain = signal.lfilter([1 - g2], [1, -g2], gain)
    mix = mix * gain[:, None]

    mix = mix / np.percentile(np.abs(mix), 99.95) * 0.95
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix / np.max(np.abs(mix)) * 0.93
    t = tvec(N)
    fade = np.clip((DUR - t) / 2.5, 0, 1) ** 1.4
    mix *= np.clip(t / 0.05, 0, 1)[:, None] * fade[:, None]
    return mix


def analyse(mix):
    spf = SR // FPS
    frames = N // spf
    mono = mix.mean(axis=1)

    def env_of(x):
        e = np.sqrt(np.mean(np.square(x[: frames * spf]).reshape(frames, spf), axis=1))
        return e / (np.percentile(e, 98) + 1e-9)

    r, lo, hi = env_of(mono), env_of(lp(mono, 150, 2)), env_of(hp(mono, 4000, 2))
    q = lambda a: [round(float(min(v, 1.5)), 3) for v in a]
    return {
        "fps": FPS, "bpm": BPM, "bars": BARS, "frames": int(frames),
        "rms": q(r), "low": q(lo), "high": q(hi),
        "events": sorted(events, key=lambda e: e["f"]),
        "ga": GA_PHRASES,
        "scale": [midi(s) for s in SCALE],
    }


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    for s in (primordial, first_cell, ga_lead, colony, cambrian, to_land, dinosaurs, extinction,
              mammals, humans, dna, tree, coda):
        print(f"  composing {s.__name__}…")
        s()
    mix = master()
    out_dir = os.path.join(ROOT, "src", "evolution", "data")
    os.makedirs(out_dir, exist_ok=True)
    write_wav(os.path.join(ROOT, "public", "evolution.wav"), mix)
    with open(os.path.join(out_dir, "audio.json"), "w") as f:
        json.dump(analyse(mix), f, separators=(",", ":"))
    print(f"  wrote public/evolution.wav ({DUR:.1f}s) and src/evolution/data/audio.json")


if __name__ == "__main__":
    main()
