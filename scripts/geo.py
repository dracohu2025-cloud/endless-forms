#!/usr/bin/env python3
"""
Pre-computes the geographic layers used by the video from public-domain
Natural Earth land polygons (downloaded on demand into assets-src/).

  globe   — land points sampled on a Fibonacci sphere (for the dotted globe)
  europe  — Europe coastline polylines in a Lambert azimuthal projection
  cities  — historic cities projected into the same frame

Output: src/data/geo.json
"""

import json
import math
import os
import sys
import urllib.request

import numpy as np
from matplotlib.path import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-src")
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"


def load(name):
    os.makedirs(SRC, exist_ok=True)
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        urllib.request.urlretrieve(BASE + name, p)
    with open(p) as f:
        return json.load(f)


def rings(gj):
    for feat in gj["features"]:
        g = feat["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            yield np.array(poly[0])


def globe_points(n=10000):
    land = [Path(r) for r in rings(load("ne_110m_land.geojson"))]
    i = np.arange(n) + 0.5
    lat = np.degrees(np.arcsin(1 - 2 * i / n))
    lon = (np.degrees(np.pi * (1 + 5 ** 0.5) * i) % 360) - 180
    pts = np.stack([lon, lat], 1)
    inside = np.zeros(n, bool)
    for p in land:
        inside |= p.contains_points(pts)
    return [[round(float(a), 2), round(float(o), 2)] for o, a in pts[inside]]


LAT0, LON0 = math.radians(52), math.radians(14)


def laea(lon, lat):
    lam, phi = np.radians(lon), np.radians(lat)
    k = np.sqrt(2 / (1 + math.sin(LAT0) * np.sin(phi) + math.cos(LAT0) * np.cos(phi) * np.cos(lam - LON0)))
    x = k * np.cos(phi) * np.sin(lam - LON0)
    y = k * (math.cos(LAT0) * np.sin(phi) - math.sin(LAT0) * np.cos(phi) * np.cos(lam - LON0))
    return x, -y


def frame():
    corners = [(-11, 35), (-11, 60), (40, 36), (40, 66), (14, 71.5), (25, 34.5), (-10, 52)]
    xs, ys = laea(np.array([c[0] for c in corners]), np.array([c[1] for c in corners]))
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    s = 1000 / (x1 - x0)
    return x0, y0, s, int(round((y1 - y0) * s))


def dp(points, tol):
    """Douglas–Peucker simplification."""
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    ab = b - a
    L = np.hypot(*ab) + 1e-12
    rel = points - a
    d = np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / L
    i = int(np.argmax(d))
    if d[i] > tol:
        return np.vstack([dp(points[: i + 1], tol)[:-1], dp(points[i:], tol)])
    return np.array([a, b])


def europe():
    x0, y0, s, h = frame()
    pad = 60
    out = []
    for ring in rings(load("ne_50m_land.geojson")):
        lon, lat = ring[:, 0], ring[:, 1]
        if lon.max() < -30 or lon.min() > 60 or lat.max() < 28 or lat.min() > 75:
            continue
        x, y = laea(lon, lat)
        px, py = (x - x0) * s, (y - y0) * s
        ok = (px > -pad) & (px < 1000 + pad) & (py > -pad) & (py < h + pad) & (lon > -32) & (lon < 62)
        seg = []
        for i in range(len(px)):
            if ok[i]:
                seg.append((px[i], py[i]))
            elif seg:
                out.append(np.array(seg))
                seg = []
        if seg:
            out.append(np.array(seg))
    paths = []
    for seg in out:
        if len(seg) < 3:
            continue
        perim = np.sum(np.hypot(*np.diff(seg, axis=0).T))
        if perim < 18:
            continue
        far = int(np.argmax(np.hypot(*(seg - seg[0]).T)))
        sp = np.vstack([dp(seg[: far + 1], 0.9)[:-1], dp(seg[far:], 0.9)])
        d = "M" + "L".join(f"{p[0]:.1f},{p[1]:.1f}" for p in sp)
        paths.append({"d": d, "len": round(float(perim), 1)})
    paths.sort(key=lambda p: -p["len"])
    return {"w": 1000, "h": h, "paths": paths}


CITIES = [
    ("Athenae", 37.98, 23.73), ("Roma", 41.90, 12.50), ("Constantinopolis", 41.01, 28.98),
    ("Paris", 48.86, 2.35), ("Londinium", 51.51, -0.13), ("Berlin", 52.52, 13.40),
    ("Madrid", 40.42, -3.70), ("Lisboa", 38.72, -9.14), ("Vindobona", 48.21, 16.37),
    ("Praga", 50.08, 14.44), ("Varsovia", 52.23, 21.01), ("Bruxellae", 50.85, 4.35),
    ("Amstelodamum", 52.37, 4.90), ("Holmia", 59.33, 18.07), ("Hafnia", 55.68, 12.57),
    ("Dublinium", 53.35, -6.26), ("Budapestinum", 47.50, 19.04), ("Bucarestum", 44.43, 26.10),
    ("Helsingforsia", 60.17, 24.94), ("Osloa", 59.91, 10.75), ("Florentia", 43.77, 11.25),
    ("Venetiae", 45.44, 12.32), ("Kiovia", 50.45, 30.52), ("Edinburgum", 55.95, -3.19),
    ("Barcino", 41.39, 2.17), ("Massilia", 43.30, 5.37), ("Colonia", 50.94, 6.96),
    ("Mediolanum", 45.46, 9.19), ("Neapolis", 40.85, 14.27), ("Syracusae", 37.08, 15.29),
    ("Carthago", 36.85, 10.32), ("Riga", 56.95, 24.11), ("Sofia", 42.70, 23.32),
    ("Cracovia", 50.06, 19.94), ("Monacum", 48.14, 11.58), ("Tolosa", 43.60, 1.44),
]


def cities():
    x0, y0, s, _ = frame()
    out = []
    for name, lat, lon in CITIES:
        x, y = laea(np.array([lon]), np.array([lat]))
        out.append({"name": name, "x": round(float((x[0] - x0) * s), 1), "y": round(float((y[0] - y0) * s), 1)})
    return out


def main():
    sys.setrecursionlimit(100000)
    data = {"globe": globe_points(), "europe": europe(), "cities": cities()}
    os.makedirs(os.path.join(ROOT, "src", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "src", "data", "geo.json"), "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"globe dots: {len(data['globe'])}, europe paths: {len(data['europe']['paths'])}, "
          f"frame {data['europe']['w']}x{data['europe']['h']}")


if __name__ == "__main__":
    main()
