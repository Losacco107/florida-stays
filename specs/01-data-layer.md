# Phase 01 — Data pipeline

**Goal:** the spreadsheet becomes a validated, geocoded, typed dataset that the app can load
in one request. No UI. At the end of this phase, `public/data/pois.v1.json` exists and every
Florida hotel in it has real coordinates.

**Depends on:** Phase 00.

This is the phase that determines whether the product is trustworthy. A hotel at the wrong
coordinates is worse than a hotel that is missing, so the geocoding review is not optional
polish — it is the deliverable.

---

## Files to create

```
lib/types.ts                  # Zod schemas from docs/DATA-MODEL.md §6
lib/themes.ts                 # typed accessors over the theme catalog
lib/data/load.ts              # module-level cached fetch + Zod parse
lib/data/selectors.ts         # filterByThemes, filterByQuery, filterByViewport, counts
lib/geo/bbox.ts               # parse, round, clamp, centerOf, pointInBbox
scripts/ingest.ts             # xlsx (P0 + P1) → data/fl-pois.csv
scripts/geocode.ts            # fills lat/lng, writes the review report
scripts/build-dataset.ts      # data/ → public/data/pois.v1.json, with quality gates
data/themes.json              # committed catalog (shipped with this plan)
data/fl-pois.csv              # committed dataset (shipped with this plan, un-geocoded)
data/geocode-report.md        # generated, committed so review is reviewable in PRs
tests/data/selectors.test.ts
tests/data/dataset.test.ts
```

`data/themes.json` and `data/fl-pois.csv` ship with this plan already built from the P0 tab —
155 Florida rows, themes parsed, primary theme derived, zero unmapped labels. Copy them in
rather than regenerating from scratch, then run `ingest` to fold in the P1 tab.

## Requirements

### `scripts/ingest.ts`

Reads the source workbook, tabs **P0 and P1**, keeps `State === "Florida"`, and writes
`data/fl-pois.csv` with the column set in `docs/DATA-MODEL.md` §3.

- **`POI ID` stays a string.** It is 17 digits, past `Number.MAX_SAFE_INTEGER`. Reading the
  sheet with a library that coerces numerics will silently corrupt the last digits — force
  the column to text and assert `/^\d{17}$/`.
- Split themes on `|`, trim, **preserve source order**, drop exact repeats within a cell.
  Map each label through `themes.json`. An unmapped label is a **hard error** that stops the
  run and prints the offending value — a new theme in a future export is a catalog decision,
  not something to silently drop.
- `#N/A`, `N/A`, empty → no themes, `primary_theme = unclassified`, `theme_family = none`.
- `primary_theme = themes[0]`. Do not sort.
- `slug = slugify(name + '-' + county)`, deduped with `-2`, `-3`. **Never change a published
  slug** — if a re-ingest would change one, print a warning and keep the old value by matching
  on `poi_id` against the existing CSV.
- Merge, do not overwrite: preserve `lat`, `lng`, `geocode_*` for rows whose `poi_id` already
  exists. Re-running ingest must not destroy geocoding work.
- Sort output by `poi_id` so the diff is readable.
- Print a summary: rows read per tab, Florida rows, written, dropped by reason, unclassified
  count and percentage, theme frequency table.

### `scripts/geocode.ts`

Implements `docs/DATA-MODEL.md` §4 exactly.

- Nominatim, query `"<name>, <county> County, Florida, USA"`, `countrycodes=us`, `limit=3`,
  `addressdetails=1`
- **1 request per second, enforced**, with a descriptive `User-Agent` including a contact
  email. This is a hard requirement of their usage policy, not a guideline
- Confidence scoring per the four levels in the data model
- Cache raw responses under `data/.geocode-cache/<poi_id>.json` (gitignored); a re-run must
  not re-hit the network for a row already resolved
- Only fill rows where `lat`/`lng` are empty, unless `--force`
- Write `data/geocode-report.md`: counts per confidence, plus a table of every `low` and
  `failed` row with its query and the candidates that came back
- Never write a `failed` row's coordinates as `0,0` or a county centroid. Leave them empty

**Then the human step.** Look up every `low` and `failed` row by hand, write the coordinates
into the CSV, set `geocode_source = manual` and set `geocode_confidence = high` only after
actually verifying the location. With 155 rows this is roughly an hour of work and it is the
difference between a demo and a product.

### `scripts/build-dataset.ts`

Reads `data/fl-pois.csv` + `data/themes.json`, emits `public/data/pois.v1.json` in the shape
in `docs/DATA-MODEL.md` §5.

- Assign `id` as a dense 0-based index in `poi_id` sort order. Positive integers only —
  MapLibre feature ids require it, and `poiId` is not safely representable as a number
- Derive `counties[]`: name, slug, count, centroid, and bbox over that county's hotels
- Derive the dataset `bbox` from the actual points
- **Enforce every quality gate in `docs/DATA-MODEL.md` §8 and exit non-zero on violation.**
  A build that ships bad coordinates is the failure mode this phase exists to prevent
- Also emit `lib/data/generated-types.ts` with the theme slug union, so a typo in a theme slug
  anywhere in the app is a type error
- Wire it into `prebuild` so `pnpm build` can never ship a stale dataset

### `lib/data/`

`load.ts` — the module-level cached promise from `docs/ARCHITECTURE.md`, Zod-parsed once.

`selectors.ts` — pure functions, no React:

```ts
filterByThemes(pois, selected: string[]): Poi[]   // OR semantics; empty selection = all
filterByQuery(pois, q: string): Poi[]             // case/diacritic-insensitive substring
                                                  // over name and county
filterByViewport(pois, bbox): Poi[]
themeCounts(pois): Record<string, number>         // for the legend
toFeatureCollection(pois): GeoJSON.FeatureCollection  // top-level numeric `id`, props:
                                                  // { primary, sortKey }
```

Keep these dumb and synchronous. They are the whole data layer.

**OR semantics for themes** is deliberate and unusual — write the comment explaining it. With
a median of 3 themes out of 13, AND would return almost nothing.

### Tests

`tests/data/selectors.test.ts`:

- Theme filter is OR: selecting two themes returns hotels having either
- Empty theme selection returns everything
- Query matches on name and on county, ignores case and accents
- Viewport filter excludes points outside the bbox, includes points exactly on the edge
- `toFeatureCollection` puts `id` at the feature level, not in `properties`
- Theme counts sum correctly and include zero-count themes

`tests/data/dataset.test.ts`, run against the real generated file:

- It parses against the `Dataset` Zod schema
- Every `lat`/`lng` is inside the Florida bbox
- `poi_id` and `slug` are unique
- `id` values are dense and 0-based
- Every theme slug referenced exists in the catalog
- Gzipped size is under 30 KB

## Acceptance checklist

- [ ] `pnpm data:ingest` produces `data/fl-pois.csv` with both P0 and P1 Florida rows
- [ ] Re-running ingest produces a byte-identical CSV and preserves existing coordinates
- [ ] An unmapped theme label stops the run with a clear message (test it by editing a cell)
- [ ] `pnpm data:geocode` resolves rows at ~1/s, caches, and writes `geocode-report.md`
- [ ] Every row in the final CSV has coordinates, and none is `failed`
- [ ] Spot-check 10 hotels against Google Maps — all within ~200 m of the real location
- [ ] `pnpm data:build` writes `public/data/pois.v1.json` and fails loudly on a seeded
      violation (test by blanking one row's `lat`)
- [ ] The generated file is under 30 KB gzipped
- [ ] All tests pass
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass
- [ ] Commit: `feat(phase-1): ingest, geocode and build the florida dataset`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/DATA-MODEL.md, docs/ARCHITECTURE.md and specs/01-data-layer.md.

Implement Phase 01 — the data pipeline. No UI in this phase, and no database: this project
has no Postgres, no ORM and no data API routes.

data/themes.json and data/fl-pois.csv are already in the repo, built from the P0 tab (155
Florida rows). Do not regenerate them from scratch — extend the pipeline around them.

Build in this order:
1. lib/types.ts (Zod schemas) and lib/themes.ts.
2. scripts/ingest.ts. Two things to be careful about: POI ID is a 17-digit string and must
   never be parsed as a number, and theme order within a cell is load-bearing because
   primary_theme is themes[0] — do not sort it. Re-running must preserve existing lat/lng.
3. scripts/geocode.ts against Nominatim at a strict 1 req/sec with a real User-Agent, with
   on-disk caching and the four-level confidence scoring. Write data/geocode-report.md.
   Then STOP and tell me how many rows need manual review — I will do that pass myself.
4. scripts/build-dataset.ts with every quality gate from docs/DATA-MODEL.md §8, exiting
   non-zero on violation, wired into prebuild.
5. lib/data/load.ts and lib/data/selectors.ts as pure synchronous functions.
6. The two test files.

Note the theme filter is OR, not AND — the opposite of the usual amenity convention. Comment
why in the code.

Run the acceptance checklist and report each item. Commit with
"feat(phase-1): ingest, geocode and build the florida dataset".
```
