#!/usr/bin/env python3
"""Fill `img` and `gallery` in assets/places.json from Wikimedia Commons.

For every place with a `commons_query`, search Commons (namespace File, bitmap only),
read author/license via imageinfo extmetadata, keep only free licenses, and store the
best hit as `img` and up to 5 more as `gallery`. Results are cached in .cache/commons.json
so re-runs are cheap. Run: python3 tools/fetch_commons.py [--force] [--only id,id]
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLACES = ROOT / "assets" / "places.json"
CACHE = ROOT / ".cache" / "commons.json"
API = "https://commons.wikimedia.org/w/api.php"
UA = "malorca-2026-site/1.0 (https://github.com/docek/malorca-2026; static travel site)"
OK_LICENSE = re.compile(r"^(CC0|CC[ -]BY|CC[ -]BY[ -]SA|Public domain|PD|GFDL|FAL|Attribution)", re.I)
BAD_NAME = re.compile(r"(map|karte|mapa|logo|coat of arms|escudo|escut|flag|bandera|diagram|plan\b|icon|svg|wappen|gravat|engraving|grabado|postcard|postal|model|maqueta|\.gif$)", re.I)
TAG = re.compile(r"<[^>]+>")


def api(params: dict) -> dict:
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    return {}


def search(query: str, limit: int = 12) -> list[str]:
    r = api({"action": "query", "list": "search", "srsearch": f"{query} filetype:bitmap", "srnamespace": "6", "srlimit": str(limit)})
    return [h["title"] for h in r.get("query", {}).get("search", [])]


def info(titles: list[str]) -> list[dict]:
    if not titles:
        return []
    r = api({"action": "query", "prop": "imageinfo", "iiprop": "extmetadata|size|mime", "titles": "|".join(titles)})
    out = []
    for p in r.get("query", {}).get("pages", []):
        ii = (p.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata", {})
        get = lambda k: html.unescape(TAG.sub("", em.get(k, {}).get("value", ""))).strip()  # noqa: E731
        out.append({
            "title": p.get("title", ""), "file": p.get("title", "").replace("File:", ""),
            "author": get("Artist") or get("Credit") or "neznámý autor",
            "license": get("LicenseShortName") or get("License"),
            "width": ii.get("width", 0), "height": ii.get("height", 0), "mime": ii.get("mime", ""),
            "desc": get("ImageDescription")[:300], "cats": get("Categories")[:300],
        })
    return out


STOP = {"mallorca", "majorca", "spain", "palma", "de", "del", "des", "la", "el", "es", "sa", "beach", "church", "street", "view"}


def fold(s: str) -> str:
    import unicodedata
    return "".join(ch for ch in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(ch) != "Mn")


def pick(query: str) -> tuple[dict | None, list[dict]]:
    titles = [t for t in search(query, 20) if not BAD_NAME.search(t)]
    tokens = [t for t in re.findall(r"[a-z0-9']+", fold(query)) if len(t) >= 3 and t not in STOP]
    cands = []
    for c in info(titles):
        if not OK_LICENSE.search(c["license"] or ""):
            continue
        if c["mime"] not in ("image/jpeg", "image/png", "image/webp"):
            continue
        if c["width"] < 800 or c["height"] < 500:
            continue
        hay = fold(c["title"] + " " + c.get("desc", "") + " " + c.get("cats", ""))
        c["score"] = sum(1 for t in tokens if t in hay)
        if tokens and c["score"] == 0:
            continue  # nothing from the query in title, description or categories
        cands.append(c)
    # most query tokens matched first, then landscape-ish, reasonably large
    cands.sort(key=lambda c: (-c["score"], abs((c["width"] / max(c["height"], 1)) - 1.5), -min(c["width"], 3000)))
    slim = lambda c: {"file": c["file"], "author": c["author"][:60], "license": c["license"]}  # noqa: E731
    if not cands:
        return None, []
    return slim(cands[0]), [slim(c) for c in cands[1:6]]


def main() -> None:
    force = "--force" in sys.argv
    only = set()
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    data = json.loads(PLACES.read_text(encoding="utf-8"))
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    n_img = 0
    for p in data["places"]:
        q = p.get("commons_query")
        if only and p["id"] not in only:
            continue
        if not q:
            p["img"], p["gallery"] = None, []
            continue
        key = q.strip().lower()
        if force or key not in cache:
            try:
                img, gal = pick(q)
            except Exception as e:  # noqa: BLE001
                print(f"! {p['id']}: {e}", file=sys.stderr)
                continue
            cache[key] = {"img": img, "gallery": gal}
            print(f"{'✓' if img else '–'} {p['id']:40s} {q!r} -> {img['file'] if img else 'nothing'} (+{len(gal)})", file=sys.stderr)
            time.sleep(0.3)
        p["img"] = cache[key]["img"]
        p["gallery"] = cache[key]["gallery"]
        n_img += 1 if p["img"] else 0
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    PLACES.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{n_img} places with a photo out of {len(data['places'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
