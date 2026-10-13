#!/usr/bin/env python3
"""
Builds the web fonts in public/fonts/.

Noto Serif SC is ~25 MB, so it is subset to exactly the characters that
appear in src/ (plus ASCII and common CJK punctuation). The weight axis of
the variable font is preserved. Run again after changing any on-screen copy.
"""

import os
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-src")
OUT = os.path.join(ROOT, "public", "fonts")
GF = "https://github.com/google/fonts/raw/main/ofl/"
FONTS = {
    "NotoSerifSC.ttf": GF + "notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
    "Cinzel.ttf": GF + "cinzel/Cinzel%5Bwght%5D.ttf",
    "CormorantGaramond.ttf": GF + "cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
    "NotoSansSC.ttf": GF + "notosanssc/NotoSansSC%5Bwght%5D.ttf",
    "Unbounded.ttf": GF + "unbounded/Unbounded%5Bwght%5D.ttf",
    "JetBrainsMono.ttf": GF + "jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
}


def fetch(name):
    os.makedirs(SRC, exist_ok=True)
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        print(f"  downloading {name}…")
        urllib.request.urlretrieve(FONTS[name], p)
    return p


def used_text():
    chars = set()
    for d, _, files in os.walk(os.path.join(ROOT, "src")):
        for fn in files:
            if fn.endswith((".ts", ".tsx")):
                with open(os.path.join(d, fn), encoding="utf-8") as f:
                    chars |= set(f.read())
    chars |= {chr(c) for c in range(0x20, 0x7F)}
    chars |= set("「」《》，。、：；！？—…·“”‘’（）年")
    return "".join(sorted(c for c in chars if c.isprintable()))


def build(src_name, out_name, text=None):
    font = TTFont(fetch(src_name))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    if text is None:
        sub.populate(unicodes=list(range(0x20, 0x250)) + list(range(0x370, 0x400)) + list(range(0x2000, 0x20D0)) + [0x2212, 0x00B7])
    else:
        sub.populate(text=text)
    sub.subset(font)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, out_name)
    font.flavor = "woff2"
    font.save(path)
    print(f"  {out_name}: {os.path.getsize(path) // 1024} KB")


def main():
    text = used_text()
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    print(f"  {cjk} distinct CJK characters in use")
    build("NotoSerifSC.ttf", "NotoSerifSC-subset.woff2", text)
    build("Cinzel.ttf", "Cinzel.woff2")
    build("CormorantGaramond.ttf", "CormorantGaramond.woff2")
    build("NotoSansSC.ttf", "NotoSansSC-subset.woff2", text)
    build("Unbounded.ttf", "Unbounded.woff2")
    build("JetBrainsMono.ttf", "JetBrainsMono.woff2")


if __name__ == "__main__":
    main()
