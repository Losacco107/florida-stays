#!/usr/bin/env python3
"""Build the committed Florida dataset + theme catalog from the POI spreadsheet.

This is the one-off preparation script for the plan bundle. The repo's own
scripts/ingest.ts reimplements this in TypeScript (see specs/01-data-layer.md);
this version exists so the plan can ship with the real data already parsed.
"""
import csv, json, re, unicodedata, collections, pathlib, sys

SRC = sys.argv[1]
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path("data")
OUT.mkdir(parents=True, exist_ok=True)

THEME_KEY = "Does the POI fulfill the key top-selling themes?"
NA = {"#N/A", "N/A", "", "NA", "#n/a"}

# family -> validated categorical colour (see docs/DESIGN-SYSTEM.md)
FAMILIES = {
    "urban":      {"label": "Urban & Business",      "color": "#2a78d6"},
    "family":     {"label": "Family & Entertainment","color": "#cc4e1b"},
    "outdoors":   {"label": "Outdoors & Nature",     "color": "#0c8459"},
    "indulgence": {"label": "Romance & Indulgence",  "color": "#4a3aa7"},
    "none":       {"label": "Unclassified",          "color": "#75736d"},
}

# canonical theme catalog. `short` is for the legend and card badges, never the pin.
THEMES = [
    ("city-escapes",          "City Escapes",                   "City",          "urban",      "building-2"),
    ("business-travel",       "Business Travel Stays",          "Business",      "urban",      "briefcase"),
    ("roadside-motels",       "Roadside Motels",                "Roadside",      "urban",      "car-front"),
    ("family-friendly",       "Family-Friendly Stays",          "Family",        "family",     "users-round"),
    ("pet-friendly",          "Pet-Friendly Stays",             "Pet-friendly",  "family",     "paw-print"),
    ("casino-entertainment",  "Casino & Entertainment Resorts", "Casino",        "family",     "dice-5"),
    ("all-inclusive",         "All-Inclusive Resorts",          "All-inclusive", "family",     "concierge-bell"),
    ("outdoor-adventure",     "Outdoor Adventure Stays",        "Outdoor",       "outdoors",   "mountain"),
    ("natural-wonder",        "Natural Wonder Stays",           "Nature",        "outdoors",   "sunrise"),
    ("national-park",         "National Park Stays",            "National park", "outdoors",   "trees"),
    ("romantic-getaways",     "Romantic Getaways",              "Romantic",      "indulgence", "heart"),
    ("food-wine",             "Food & Wine Stays",              "Food & wine",   "indulgence", "wine"),
    ("onsen-hot-spring",      "Onsen & Hot Spring Stays",       "Hot springs",   "indulgence", "droplets"),
]
BY_LABEL = {label: slug for slug, label, _s, _f, _i in THEMES}

GENERIC = {
    "slug": "unclassified", "label": "Unclassified stay", "short": "Hotel",
    "family": "none", "icon": "bed-double",
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)[:80]


rows = list(csv.DictReader(open(SRC)))
fl = [r for r in rows if r["State"].strip() == "Florida"]

unknown = collections.Counter()
seen_slug, seen_poi = {}, set()
out, dropped = [], collections.Counter()

for r in fl:
    poi_id = r["POI ID"].strip()
    name = " ".join(r["POI Name"].split())
    if not poi_id or not name:
        dropped["missing id or name"] += 1
        continue
    if poi_id in seen_poi:
        dropped["duplicate POI ID"] += 1
        continue
    seen_poi.add(poi_id)

    raw = r[THEME_KEY].strip()
    themes = []
    if raw not in NA:
        for part in (p.strip() for p in raw.split("|")):
            if not part:
                continue
            slug = BY_LABEL.get(part)
            if slug is None:
                unknown[part] += 1
                continue
            if slug not in themes:          # preserve order, drop repeats
                themes.append(slug)

    base = slugify(f"{name}-{r['County'].strip()}")
    slug = base
    n = 2
    while slug in seen_slug:
        slug, n = f"{base}-{n}", n + 1
    seen_slug[slug] = poi_id

    primary = themes[0] if themes else GENERIC["slug"]
    family = next((f for s, _l, _sh, f, _i in THEMES if s == primary), "none")

    out.append({
        "poi_id": poi_id,
        "slug": slug,
        "name": name,
        "state": "FL",
        "county": r["County"].strip(),
        "themes": "|".join(themes),
        "theme_count": len(themes),
        "primary_theme": primary,
        "theme_family": family,
        # geocoding fills these in — see specs/01-data-layer.md
        "lat": "", "lng": "", "geocode_confidence": "", "geocode_source": "", "geocode_query": "",
    })

out.sort(key=lambda r: r["poi_id"])

fields = list(out[0].keys())
with open(OUT / "fl-pois.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(out)

catalog = {
    "families": FAMILIES,
    "themes": [
        {"slug": s, "label": l, "short": sh, "family": f, "icon": i,
         "color": FAMILIES[f]["color"]}
        for s, l, sh, f, i in THEMES
    ],
    "generic": {**GENERIC, "color": FAMILIES["none"]["color"]},
}
(OUT / "themes.json").write_text(json.dumps(catalog, indent=2) + "\n")

# ---- report -----------------------------------------------------------------
tc = collections.Counter(t for r in out for t in r["themes"].split("|") if t)
pc = collections.Counter(r["primary_theme"] for r in out)
fc = collections.Counter(r["theme_family"] for r in out)
cc = collections.Counter(r["county"] for r in out)

print(f"source rows            {len(rows)}")
print(f"florida rows           {len(fl)}")
print(f"written                {len(out)}")
print(f"dropped                {dict(dropped) or '{}'}")
print(f"unknown theme labels   {dict(unknown) or '{}'}")
print(f"unclassified (no theme){sum(1 for r in out if not r['themes']):5d}"
      f"  ({sum(1 for r in out if not r['themes'])/len(out)*100:.0f}%)")
print()
print("themes present (any position):")
for k, v in tc.most_common():
    print(f"  {v:4d}  {k}")
print("\nprimary theme (drives the pin icon):")
for k, v in pc.most_common():
    print(f"  {v:4d}  {k}")
print("\npin colour family:")
for k, v in fc.most_common():
    print(f"  {v:4d}  {k:11s} {FAMILIES[k]['color']}  {FAMILIES[k]['label']}")
print(f"\ncounties: {len(cc)} -> {cc.most_common(8)}")
