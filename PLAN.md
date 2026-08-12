# PLAN.md — Florida Stays

Master build plan. Read alongside `CLAUDE.md` and the relevant `specs/NN-*.md`.

---

## 1. The product in one paragraph

A visitor opens the site on their phone and lands on a map of Florida covered in small
coloured markers, one per hotel. The colour tells them what kind of stay it is at a glance —
green for outdoors, orange for family, blue for city and business, violet for romance and
food — and the icon inside says which theme specifically. They pinch to Orlando, and the
sheet at the bottom lists the hotels now on screen. They tap a marker; the sheet rises and
shows that hotel's card with all of its themes. They tap "Family-Friendly" in the chip bar
and everything else fades out of the map instantly. On a desktop, hovering a marker shows the
same information as a tooltip without a click. Tapping through takes them to a page for that
hotel, which links out to the county and to nearby stays.

## 2. What the data is, and what it is not

The source is a curated POI target list: **155 Florida hotels** in the P0 tab (plus the P1
tab), each with a name, a county, and a pipe-separated list of top-selling themes drawn from
a 13-value controlled vocabulary. 34% of the Florida rows have no themes at all.

There are **no prices, no ratings, no reviews, no photos, no descriptions and no
coordinates**. Three consequences run through the whole plan:

1. **Nothing shows a price.** Not on the marker, not on the card, not in a filter. Inventing
   plausible-looking rates would be the single fastest way to destroy trust in the product.
2. **Geocoding is a real phase of work**, not a footnote. Coordinates are the one thing a map
   cannot fake, and 155 rows is small enough to get to 100% with a human review pass.
3. **The theme is the product.** It is the only differentiating attribute in the dataset, so
   the marker, the card, the tooltip, the filter and the legend are all built around it.

## 3. Why this architecture

**No database.** The whole dataset is ~8 KB gzipped and changes at most monthly. It ships as
a JSON file built from a committed CSV, the browser fetches it once, and every filter, search
and viewport change after that is synchronous work over an in-memory array. The
viewport-query machinery a hotel search normally needs — debounce, abort in-flight, cache by
rounded bbox, keep-previous-data — exists to hide network latency; delete the network and all
of it goes with it. `docs/ARCHITECTURE.md` documents the threshold at which this should be
revisited (roughly 5,000 POIs, or the day someone needs to edit data without a deploy).

**MapLibre GL JS over Google Maps.** Google's markers are DOM nodes, its styling is limited,
and it bills per map load, which turns your own traffic into a liability. MapLibre is vector
-tile based, GPU-rendered, fully restylable, MIT licensed and free.

**Protomaps PMTiles over a tile subscription.** A single archive the browser reads via HTTP
range requests — no tile server, no per-request cost. A Florida-only extract at zoom 0–14
sits in a Cloudflare R2 free bucket with zero egress. If you later want global coverage, the
style URL swaps to MapTiler or Stadia in one line.

**No `react-map-gl`.** It depends on MapLibre internals (`map.transform`) that v6 removed,
and it puts a reconciliation layer between React state and a fundamentally imperative map. A
short custom hook gives more control and fewer surprises.

**Static Next.js.** Server Components prerender every hotel and county page as crawlable
HTML. The map page is a thin client island. Nothing runs at request time.

## 4. Architecture at a glance

```
┌──────────────────── Browser (mobile) ─────────────────────┐
│  /search                                                   │
│  ┌──────────────────────────────┐                          │
│  │ MapCanvas (MapLibre, WebGL2) │◀─ PMTiles basemap (R2)   │
│  │  ├ cluster circles           │                          │
│  │  ├ theme icon markers        │◀─ GeoJSON built in       │
│  │  └ selected marker           │   memory from filters    │
│  └──────────────────────────────┘                          │
│  ┌──────────────────────────────┐                          │
│  │ ResultSheet · Legend · Chips │◀─ same in-memory array   │
│  └──────────────────────────────┘                          │
│    URL: bbox, z, themes, q, hotel                          │
│    one fetch, ever: /data/pois.v1.json                     │
└────────────────────────────────────────────────────────────┘
                       ▲ build time
        data/fl-pois.csv + data/themes.json
          → scripts/build-dataset.ts
          → public/data/pois.v1.json + static pages
```

Full detail in `docs/ARCHITECTURE.md`.

## 5. The phases

One phase per Claude Code session, one git commit each. Ordered so the thing is demonstrable
as early as possible — a working themed map on your phone by Phase 3.

| # | Phase | Spec | Output |
|---|---|---|---|
| 00 | Bootstrap | `specs/00-bootstrap.md` | Next.js repo, Tailwind, lint, CI, mobile app shell |
| 01 | Data pipeline | `specs/01-data-layer.md` | Ingest, geocode, validate, build the typed dataset |
| 02 | Map shell | `specs/02-map-shell.md` | Full-bleed MapLibre map of Florida, PMTiles, gestures |
| 03 | Markers | `specs/03-markers-clustering.md` | Theme icon markers, clusters, selection, hover tooltip |
| 04 | Result sheet | `specs/04-result-sheet.md` | Draggable sheet, cards, map↔list sync |
| 05 | Search & filters | `specs/05-search-filters.md` | Place search, theme filters, legend |
| 06 | Detail pages | `specs/06-hotel-detail.md` | Hotel and county pages, SEO, structured data |
| 07 | Performance & a11y | `specs/07-performance-a11y.md` | Budgets met, keyboard/SR paths, reduced motion |
| 08 | Deploy | `specs/08-deploy.md` | Vercel + R2 live, monitoring, runbook |

Linear, except that 06 can run in parallel with 04–05.

## 6. Milestones

**M1 — "It's real" (after Phase 03).** A map of Florida on your phone with 155 themed
markers that cluster and select. Stop here and validate the feel — in particular whether the
icon-and-colour system reads without effort — before building on top of it.

**M2 — "It's usable" (after Phase 05).** Full loop: pan, filter by theme, search, browse,
select. Show it to five people who plan Florida trips. Watch whether they understand the
markers without being told.

**M3 — "It's live" (after Phase 08).**

## 7. Risks and how the plan handles them

| Risk | Impact | Mitigation |
|---|---|---|
| Geocoding puts hotels in the wrong place | Destroys trust; invisible until someone notices | Four-level confidence scoring, a generated review report, a mandatory manual pass on every low/failed row, and a build gate that refuses to ship a `failed` row |
| 13 themes cannot be told apart by colour | The map becomes decorative noise | Colour encodes 4 families, validated all-pairs including colour-vision simulation; the icon carries the theme; a mandatory legend carries the words |
| 34% of hotels have no theme | A third of the map is grey and meaningless | Neutral marker plus an honest "not classified yet" label, and a filter toggle to hide them. Also a signal back to whoever maintains the sheet |
| Icon-only markers are unreadable without the legend | Users bounce | The legend is a required component, reachable in one tap, docked open on desktop, and its rows double as filters so people actually open it |
| Hover has no touch equivalent | Half the users get less information | The sheet card carries exactly the same content as the tooltip, and shares the same components so they cannot drift |
| Marker rendering stutters on mid-range Android | Kills the core experience | Symbol layers with runtime sprites, never HTML markers; Phase 07 has an explicit 60 fps budget under 4× CPU throttle |
| Orlando's 42 hotels pile up | Dense areas unreadable | Clustering to zoom 12 with a tuned 44 px radius, and an explicit real-device check at zoom 13 |
| The dataset outgrows the static approach | Slow cold loads | Documented threshold (~5,000 POIs) and a contained migration path: `lib/data` is the only module that knows where POIs come from |
| Scope creep into bookings | Never ships | There is no booking link in the data. When one arrives, `docs/DATA-MODEL.md` says where it goes |

## 8. What is deliberately not in the MVP

Prices, availability, reviews, photos, accounts, wishlists, booking, other states, i18n,
dark mode. Each is a real product decision to make after M2, with evidence.

## 9. Post-MVP direction

Roughly in order of likely value:

1. **Fill in the 34%.** The biggest quality win available is upstream, in the spreadsheet:
   classifying the 53 unthemed Florida hotels. Costs no engineering.
2. **Photos.** One hero image per hotel would change the card and the detail page more than
   any feature on this list. It is a content problem, not a code problem.
3. **Beyond Florida.** The only Florida-specific things are the ingest filter, the PMTiles
   extract bbox, and the map's `maxBounds`. All three are parameters. The source file already
   holds 834 POIs across 40+ states.
4. **Real rates.** If an affiliate feed arrives, prices and a booking link slot into the card
   and the detail page — and that is also the point at which a database starts to earn its
   keep, because rates are per-request data.
