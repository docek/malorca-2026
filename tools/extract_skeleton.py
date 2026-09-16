#!/usr/bin/env python3
"""Extract a skeleton of places (activities, venues, producers) from the HTML pages.

Output: JSON list with id, name, kind, page, and whatever structured text the cards
already carry. Used as input for content enrichment; not run at build time.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAG = re.compile(r"<[^>]+>")
CITE = re.compile(r"<sup class=\"cite\">.*?</sup>", re.S)


def text(s: str) -> str:
    s = CITE.sub("", s)
    s = TAG.sub("", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def dl_pairs(block: str) -> dict:
    out = {}
    for dt, dd in re.findall(r"<dt>(.*?)</dt>\s*<dd>(.*?)</dd>", block, re.S):
        out[text(dt)] = text(dd)
    return out


def activities():
    src = (ROOT / "vylety.html").read_text(encoding="utf-8")
    items = []
    for m in re.finditer(r'<article id="([^"]+)" class="act"([^>]*)>(.*?)</article>', src, re.S):
        pid, attrs, body = m.groups()
        a = dict(re.findall(r'data-([a-z0-9]+)="([^"]*)"', attrs))
        h3 = re.search(r"<h3>(.*?)</h3>", body, re.S)
        what = re.search(r'<p class="what">(.*?)</p>', body, re.S)
        kids = re.search(r'<p class="kids">(.*?)</p>', body, re.S)
        drive = re.search(r'<div class="drive">(.*?)</div>', body, re.S)
        verdict = re.search(r'<p class="verdict-line">(.*?)</p>', body, re.S)
        links = [(text(l), html.unescape(u)) for u, l in re.findall(r'<a href="(https?://[^"]+)"[^>]*>(.*?)</a>', body, re.S)]
        items.append({
            "id": pid, "name": text(h3.group(1)) if h3 else a.get("name", pid), "kind": "výlet", "page": "vylety.html",
            "region": a.get("region"), "typ": a.get("typ"), "rain": a.get("rain"), "kids4": a.get("kids4"),
            "what": text(what.group(1)) if what else "",
            "kids": text(kids.group(1)).replace("Pro děti 4–11: ", "") if kids else "",
            "card_facts": dl_pairs(body),
            "drive": text(drive.group(1)).replace("Dojezd ", "") if drive else "",
            "verdict": text(verdict.group(1)).replace("Verdikt: ", "") if verdict else "",
            "card_links": links,
        })
    return items


def venues():
    src = (ROOT / "jidlo.html").read_text(encoding="utf-8")
    items = []
    # remember the area heading each card sits under
    for m in re.finditer(r'<article class="card venue" id="([^"]+)">(.*?)</article>', src, re.S):
        pid, body = m.groups()
        before = src[: m.start()]
        h3s = re.findall(r"<h3[^>]*>(.*?)</h3>", before, re.S)
        area = text(h3s[-1]) if h3s else ""
        h4 = re.search(r"<h4>(.*?)</h4>", body, re.S)
        status = re.search(r'<span class="pill [^"]*">(.*?)</span>', body, re.S)
        vt = re.search(r'<p class="vt">(.*?)</p>', body, re.S)
        why = re.search(r'<p class="why">(.*?)</p>', body, re.S)
        links = [(text(l), html.unescape(u)) for u, l in re.findall(r'<a href="(https?://[^"]+)"[^>]*>(.*?)</a>', body, re.S)]
        items.append({
            "id": pid, "name": text(h4.group(1)) if h4 else pid,
            "kind": "výrobce" if pid.startswith("g-") else "restaurace", "page": "jidlo.html",
            "area": area, "status": text(status.group(1)) if status else "",
            "what": text(vt.group(1)) if vt else "",
            "card_facts": dl_pairs(body),
            "why_card": text(why.group(1)) if why else "",
            "card_links": links,
        })
    return items


if __name__ == "__main__":
    data = activities() + venues()
    json.dump(data, sys.stdout, ensure_ascii=False, indent=1)
    print(f"\n{len(data)} items", file=sys.stderr)
