# ARCHITECTURE.md

## The shape of the thing

```
┌──────────────────── Browser (mobile) ─────────────────────┐
│  /search                                                   │
│  ┌──────────────────────────────┐                          │
│  │ MapCanvas (MapLibre, WebGL2) │◀─ PMTiles basemap (R2)   │
│  │  ├ basemap                   │                          │
│  │  ├ cluster circles           │◀─ GeoJSON source, built  │
│  │  ├ theme icon markers        │   in memory from the     │
│  │  └ selected marker           │   filtered POI array     │
│  └──────────────────────────────┘                          │
│  ┌──────────────────────────────┐                          │
│  │ ResultSheet (Vaul, 3 snaps)  │◀─ same filtered array    │
│  └──────────────────────────────┘                          │
│  ┌──────────────────────────────┐                          │
│  │ Legend · Filters · Search    │                          │
│  └──────────────────────────────┘                          │
│         ▲ URL: bbox, z, themes, q, hotel                   │
│         ▲ one fetch: /data/pois.v1.json  (immutable)       │
└────────────────────────────────────────────────────────────┘
                      ▲ build time
┌─────────────────────┴──────────────────────────────────────┐
│  data/fl-pois.csv + data/themes.json                       │
│      → scripts/build-dataset.ts                            │
│      → public/data/pois.v1.json  +  static hotel pages     │
└────────────────────────────────────────────────────────────┘
```

There is no application server doing work at request time. Vercel serves static assets and
prerendered HTML.

## Why no database

The dataset is ~155 Florida hotels today, maybe ~250 with the P1 tab. It has no prices, no
availability and no user-generated content, so nothing about it changes between deploys.
Compressed, the whole thing is around 8 KB.

Against that, a database buys latency on every interaction, a connection pool to manage,
migrations to run in CI, a second environment to keep in sync for previews, and an API layer
whose only job is to hand back data the browser could already be holding. The viewport-query
architecture that a hotel search normally needs — debounce, abort in-flight, cache by rounded
bbox, keep-previous-data to avoid blank frames — exists to hide network latency. Delete the
network and all of it goes away with it.

What we get instead: **filtering is synchronous**. Toggling a theme chip re-renders from an
in-memory array in well under a frame. There is no loading state after first paint, no race
condition between a pan and a filter, and no way for the map and the list to disagree,
because they are two views of the same array.

### When to add a database

Revisit this decision when any of these becomes true:

- The dataset passes ~5,000 POIs (roughly 250 KB gzipped) — at that point the one-shot
  payload starts to hurt on a cold mobile connection
- Someone needs to edit data without a deploy
- Content becomes per-user (saved hotels, notes) or per-request (live rates, availability)
- You need full-text search over descriptions that do not exist yet

None of those is close today. When one arrives, the migration path is contained: `lib/data`
is the only module that knows where POIs come from, so it grows a fetch layer and everything
above it keeps its interface. `docs/DATA-MODEL.md` §3 already describes the row shape a table
would have.

## Rendering strategy per route

| Route | Rendering | Why |
|---|---|---|
| `/` | Static | Marketing shell, redirects to `/search` |
| `/search` | Static shell + client island | The map needs WebGL. The shell, legend and filter chips are server-rendered so first paint is not blank |
| `/hotels/[slug]` | Static, `generateStaticParams` over every slug | SEO is the point. ~155 prerendered pages cost nothing to build |
| `/florida/[county]` | Static | 23 county landing pages, where organic traffic lands |

No route handlers return data. The only thing resembling an API is `/api/health` in Phase 08,
which exists for the uptime monitor.

## Loading the dataset

```ts
// lib/data/load.ts — module-level promise, so N components share one fetch
let cache: Promise<Dataset> | null = null

export function loadDataset(): Promise<Dataset> {
  cache ??= fetch('/data/pois.v1.json')
    .then(r => r.json())
    .then(j => Dataset.parse(j))       // zod, once, at the boundary
  return cache
}
```

Consumed with React's `use()` inside a Suspense boundary. No TanStack Query, no SWR — one
immutable resource fetched once does not need a cache library.

In `app/layout.tsx`:

```tsx
<link rel="preload" href="/data/pois.v1.json" as="fetch" crossOrigin="anonymous" />
```

so the fetch starts during HTML parse rather than after hydration.

Served with `Cache-Control: public, max-age=31536000, immutable` — safe because the filename
carries the version. Bump `v1` → `v2` when the shape changes; content changes ride along with
a normal deploy and a new build hash if you prefer, but versioning by shape is enough here.

## The derived-state pipeline

Everything the UI shows is a pure function of (dataset, URL params). Compute it once per
render in one place and pass it down:

```
dataset.pois
  → filter by themes      (OR semantics; empty selection = no filter)
  → filter by q           (name or county, case-insensitive substring)
  → visible[]             ← this feeds the map's GeoJSON source and the legend counts
  → filter by viewport    (point-in-bbox against the current map bounds)
  → inViewport[]          ← this feeds the result sheet list and the "N stays" count
```

The distinction matters: the **map** shows everything matching the filters, including points
off-screen, so panning reveals them without a refetch. The **list** shows only what is
currently on screen, which is what makes the sheet feel connected to the map.

Memoize on `[dataset, themesKey, q]` and `[visible, bboxKey]`. With 155 items this is
microseconds; with 5,000 it is still under a millisecond. Do not prematurely add a spatial
index.

## The map ↔ URL loop

```
user pans/zooms
   → MapLibre 'moveend'
   → read getBounds() + getZoom(), round bbox to 5dp
   → window.history.replaceState(null, '', urlWithNewBbox)
   → useSearchParams re-renders the island
   → inViewport[] recomputed synchronously
   → the list updates. The map does NOT move.
```

**Why `history.replaceState` and not `router.replace`.** The App Router has no `shallow`
option; `router.replace` re-runs the server component and issues an RSC request on every
call, which is absurd at pan frequency. Next 15+ syncs `useSearchParams` from a native
`replaceState`.

Note that unlike the database version of this design, the URL bbox is now **only** a
view-state record — nothing fetches because of it. If the write were dropped entirely the app
would still work; it exists so a shared link restores the view.

**History policy — decide once, apply everywhere:**

| Action | Method | History entry? |
|---|---|---|
| Pan / zoom the map | `history.replaceState` | No |
| Select a place from search | `router.push` | Yes |
| Change theme filters | `router.push` | Yes |
| Select / deselect a hotel | `router.push` | Yes |

So "back" undoes the last deliberate action, not the last nudge of the map.

**The guard.** A URL change caused by map movement must never move the map:

```ts
const movingFromCode = useRef(false)
// before any code-driven flyTo / jumpTo:
movingFromCode.current = true
// inside 'moveend':
if (movingFromCode.current) { movingFromCode.current = false; return }
```

**Restoring on load.** Use `map.jumpTo({ center: centerOf(bbox), zoom: z })`, never
`fitBounds` — `fitBounds` applies padding and rounds the zoom down, so write→reload cycles
drift.

## Client state model

| State | Lives in | Notes |
|---|---|---|
| Viewport (`bbox`, `z`) | URL | Shareable, survives refresh |
| Theme filters (`themes`) | URL | Same |
| Text query (`q`) | URL | Same |
| Selected hotel (`hotel`) | URL, as slug | Deep-linkable |
| The dataset | Module-level promise | Fetched once, never invalidated |
| Sheet snap position | React state | Transient by design |
| Legend open/closed | React state + `localStorage` | Preference, not app state |

No Redux, Zustand or Jotai. If you want one, the state you are trying to store belongs in
the URL.

## Basemap delivery

```
Cloudflare R2 (public, custom domain)
  └── florida-2026-08.pmtiles     ~400 MB, zoom 0–14
        ↑ HTTP range requests, cached by the Cloudflare CDN
```

```ts
import * as pmtiles from 'pmtiles'
import * as maplibregl from 'maplibre-gl'

const protocol = new pmtiles.Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)
```

Build the extract once:

```bash
pmtiles extract https://build.protomaps.com/<date>.pmtiles florida-2026-08.pmtiles \
  --bbox=-87.7,24.3,-79.8,31.1 --maxzoom=14
```

The style is generated from `@protomaps/basemaps` and committed as `public/map-style.json`
with a **placeholder** source URL. At runtime, patch
`style.sources.protomaps.url = 'pmtiles://' + process.env.NEXT_PUBLIC_TILES_URL` and pass the
object to `new maplibregl.Map({ style: styleObject })`. A committed static file cannot carry
an environment-specific URL.

Keep the style muted: desaturated land, soft water, thin roads, no POI icons below zoom 14.
The theme markers are the only saturated colour on screen, and that is what makes them
readable.

## Failure modes

| Failure | Behaviour |
|---|---|
| No WebGL2 | Map area replaced by a notice; the list renders at full height with all filters working. The whole app is usable without a map |
| PMTiles fetch fails | Markers render over a flat background colour. Log it, do not block |
| `pois.v1.json` fetch fails | Full-page error state with retry. This is the one hard dependency — without it there is no app |
| Dataset fails Zod validation | Same, plus a console error naming the failing field. This should be impossible in production because the build validates too |
| Geolocation denied | Silent. Default viewport stays Florida-wide |

## Security

There is almost no attack surface: no database, no user input reaching a server, no
authentication, no secrets in the client (the tiles URL is public by design). The remaining
items:

- Validate URL params with Zod before use; a malformed bbox falls back to the default view
  rather than throwing
- The text query `q` only ever does an in-memory `String.includes` — it is never interpolated
  into HTML, a URL, or a query language
- Set a strict CSP; MapLibre v6 needs `worker-src blob:`
