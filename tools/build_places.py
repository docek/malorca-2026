#!/usr/bin/env python3
"""Build assets/places.json: skeleton from the HTML cards + enrichment files + hand-written extras.

Usage: python3 tools/build_places.py --enriched DIR
The enrichment JSONs (one-off research output) are merged by id over the skeleton. After the
first build, assets/places.json is the source of truth; re-running this without --enriched keeps
the existing enriched text and only refreshes the card-derived fields (name, what, card_facts...).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_skeleton import activities, venues  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "places.json"
EXTRA = ROOT / "tools" / "extra_places.json"
TERMS = ROOT / "tools" / "terms.json"
ENRICH_KEYS = ["why", "experience", "access", "tips", "warning", "facts", "links", "commons_query", "fun", "note", "anchor", "photo_is_area", "what_long"]
CARD_KEYS = ["name", "kind", "page", "region", "typ", "rain", "kids4", "what", "kids", "card_facts", "drive", "verdict", "card_links", "area", "status", "why_card"]

ALIASES = {
    "Cal Tio": "ubyt-cal-tio", "Tierramar": "ubyt-tierramar",
    "Palma katedrála": "catedral-la-seu-palma", "Palma": "palma-stare-mesto",
    "Bunyola nádraží": "tren-de-soller-palma-soller", "Sóller nádraží": "tren-de-soller-palma-soller", "Port de Sóller": "port-de-soller-plaz-a-promenada",
    "Sóller": "tren-de-soller-palma-soller", "Inca": "inca-ctvrtecni-trh", "Pollença": "pollen-a-schody-calvari-365-schodu", "Alcúdia": "alcudia-hradby-murallas",
    "Sineu": "sineu-stredecni-trh", "Artà": "art-talaiot-ses-pa-sses", "Lluc": "lluc-monestir-de-lluc", "Formentor maják": "cap-de-formentor-majak",
    "S'Albufera": "s-albufera-de-mallorca", "Santanyí": "santanyi-sobotni-trh", "Es Trenc": "es-trenc", "Valldemossa": "valldemossa",
    "Coves de Campanet": "coves-de-campanet", "Els Calderers": "els-calderers-sant-joan", "Natura Parc": "natura-parc-santa-eug-nia",
    "Safari Zoo": "safari-zoo-sa-coma", "PMI": "ubyt-tierramar",
    "Hřiště Barcarès": "hriste-barcares-alcudia", "Can Picafort – hřiště Son Bauló": "hriste-son-baulo-can-picafort",
    "Castell d'Alaró (Es Verger)": "castell-d-alaro-hike", "Es Colomer a Albercutx": "mirador-es-colomer", "Lloseta – laser tag": "laser-tag-lloseta",
    "Sa Cabaneta – siurells": "ca-mado-bet-dels-siurells", "Sa Calobra": "sa-calobra-zatoka-bez-kanonu", "Puig de Randa": "puig-de-randa-santuari-de-cura",
}


def scan_schedule() -> dict:
    """Map place id -> [{day, track, anchor}] from the week grid in index.html."""
    import re
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    out: dict = {}
    for day in re.finditer(r'<article class="day dayrow" id="([^"]+)" data-date="([^"]+)">(.*?)</article>', html, re.S):
        anchor, date, body = day.groups()
        for tr in re.finditer(r'<div class="track [^"]*"><span class="who [^"]*">(.*?)</span><span class="chips">(.*?)</span>', body, re.S):
            who, chips = tr.groups()
            for pid in re.findall(r'data-pl="([^"]+)"', chips):
                out.setdefault(pid, []).append({"day": date, "track": who, "anchor": anchor})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--enriched", type=Path, default=None, help="directory with enrichment JSON files")
    args = ap.parse_args()

    skeleton = {p["id"]: p for p in activities() + venues()}
    for p in skeleton.values():
        if p["kind"] == "výrobce":
            p["area"] = "za jídlem k výrobci"
    previous = {}
    if OUT.exists():
        previous = {p["id"]: p for p in json.loads(OUT.read_text(encoding="utf-8"))["places"]}
    enriched = {}
    if args.enriched:
        for f in sorted(args.enriched.glob("*.json")):
            for e in json.loads(f.read_text(encoding="utf-8")):
                enriched[e["id"]] = e
    extras = json.loads(EXTRA.read_text(encoding="utf-8")) if EXTRA.exists() else []

    places, missing = [], []
    for pid, sk in skeleton.items():
        p = {k: sk[k] for k in CARD_KEYS if k in sk}
        p["id"] = pid
        src = {**previous.get(pid, {}), **enriched.get(pid, {})}
        if not src:
            missing.append(pid)
        for k in ENRICH_KEYS:
            if k in src:
                p[k] = src[k]
        prev = previous.get(pid, {})
        p["img"] = prev.get("img")
        p["gallery"] = prev.get("gallery", [])
        places.append(p)
    for e in extras:
        prev = previous.get(e["id"], {})
        e = {**e, "img": prev.get("img"), "gallery": prev.get("gallery", [])}
        places.append(e)

    # validate aliases
    ids = {p["id"] for p in places}
    bad = [k for k, v in ALIASES.items() if v not in ids]
    if bad:
        print("aliases pointing to unknown ids:", bad, file=sys.stderr)
    terms = json.loads(TERMS.read_text(encoding="utf-8")) if TERMS.exists() else {}
    sched = scan_schedule()
    for p in places:
        if p["id"] in sched:
            p["schedule"] = sched[p["id"]]
        else:
            p.pop("schedule", None)
    data = {"places": places, "aliases": {k: v for k, v in ALIASES.items() if v in ids}, "terms": terms}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n_rich = sum(1 for p in places if p.get("why"))
    print(f"{len(places)} places written, {n_rich} enriched, {len(missing)} without enrichment", file=sys.stderr)
    if missing:
        print("missing:", ", ".join(missing), file=sys.stderr)


if __name__ == "__main__":
    main()
