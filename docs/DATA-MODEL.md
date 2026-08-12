# DATA-MODEL.md

The entire dataset is a committed CSV plus a committed theme catalog, compiled at build time
into one typed JSON file. No database. See `docs/ARCHITECTURE.md` § "When to add a database"
for the threshold that reverses this.

---

## 1. Source spreadsheet

`Top POI Target List — August 2026.xlsx`, tabs **P0** and **P1**, filtered to
`State == "Florida"`.

Columns present in the source:

| Column | Notes |
|---|---|
| `POI ID` | 17-digit string from the upstream POI system. Stable, unique. **Keep it as a string** — it exceeds `Number.MAX_SAFE_INTEGER`, so parsing it as a number silently corrupts the last digits |
| `POI Name` | 7–107 chars, median 33 |
| `State` | We keep only `Florida` |
| `County` | 23 distinct counties in the P0 Florida set |
| `Does the POI fulfill the key top-selling themes?` | Pipe-separated theme labels, or `#N/A` |

What the source does **not** have, and what we therefore do not build: coordinates, address,
price, star rating, reviews, images, description, phone, website, booking URL.

### Profile of the P0 Florida set (155 rows, measured)

- 53 rows (34%) are `#N/A` — no themes at all
- Of the rest: 1–7 themes each, median 3
- 12 of the 13 catalog themes appear; all labels matched the catalog exactly, zero unknowns
- Counties are concentrated: Orange 28, Miami-Dade 27, Monroe 16, Osceola 14, Okaloosa 10

Orange + Osceola (Orlando area) is 42 hotels in a small radius. That density is the case the
marker collision and clustering rules have to survive.

## 2. The theme catalog — `data/themes.json`

Committed, hand-maintained, and the single source of truth for labels, icons and colours.
13 themes in 4 colour families, plus one neutral for unclassified hotels.

| Theme slug | Label | Short | Family | Icon (lucide) |
|---|---|---|---|---|
| `city-escapes` | City Escapes | City | urban | `building-2` |
| `business-travel` | Business Travel Stays | Business | urban | `briefcase` |
| `roadside-motels` | Roadside Motels | Roadside | urban | `car-front` |
| `family-friendly` | Family-Friendly Stays | Family | family | `users-round` |
| `pet-friendly` | Pet-Friendly Stays | Pet-friendly | family | `paw-print` |
| `casino-entertainment` | Casino & Entertainment Resorts | Casino | family | `dice-5` |
| `all-inclusive` | All-Inclusive Resorts | All-inclusive | family | `concierge-bell` |
| `outdoor-adventure` | Outdoor Adventure Stays | Outdoor | outdoors | `mountain` |
| `natural-wonder` | Natural Wonder Stays | Nature | outdoors | `sunrise` |
| `national-park` | National Park Stays | National park | outdoors | `trees` |
| `romantic-getaways` | Romantic Getaways | Romantic | indulgence | `heart` |
| `food-wine` | Food & Wine Stays | Food & wine | indulgence | `wine` |
| `onsen-hot-spring` | Onsen & Hot Spring Stays | Hot springs | indulgence | `droplets` |
| `unclassified` | Unclassified stay | Hotel | none | `bed-double` |

Family colours are in `docs/DESIGN-SYSTEM.md` and are validated — do not change one without
re-running the validator.

`label` must match the spreadsheet string **exactly**. The ingest script fails loudly on any
label it cannot map, rather than silently dropping it; a new theme in a future export is a
catalog change, not a data error to swallow.

## 3. `data/fl-pois.csv` — the committed dataset

One row per hotel, sorted by `poi_id` so diffs are readable.

| Column | Type | Filled by | Notes |
|---|---|---|---|
| `poi_id` | string | ingest | Upstream id. Unique. Idempotency key |
| `slug` | string | ingest | `slugify(name + '-' + county)`, deduped with `-2`, `-3`. URL identity — **once published, never change it** |
| `name` | string | ingest | Whitespace-collapsed |
| `state` | `"FL"` | ingest | |
| `county` | string | ingest | |
| `themes` | string | ingest | Pipe-separated slugs, **source order preserved**. Empty when `#N/A` |
| `theme_count` | int | ingest | Convenience for sorting and QA |
| `primary_theme` | string | ingest | `themes[0]`, or `unclassified` when empty. Drives the pin icon |
| `theme_family` | string | ingest | Family of `primary_theme`. Drives the pin colour |
| `lat` | float | geocode | |
| `lng` | float | geocode | |
| `geocode_confidence` | `high\|medium\|low\|failed` | geocode | |
| `geocode_source` | string | geocode | `nominatim`, `manual` |
| `geocode_query` | string | geocode | The exact query string used — makes failures debuggable |

**Source order is load-bearing.** `primary_theme` is the first theme listed in the
spreadsheet cell, so the ingest must not sort, dedupe-reorder, or normalise theme order. It
may drop an exact repeat within one cell.

## 4. Geocoding

The one genuinely manual step in the project. 155 rows (plus P1) is small enough to reach
100% coverage with review, and coordinates are the one thing a map cannot fake.

**Strategy** (`scripts/geocode.ts`):

1. Query Nominatim with a structured search: `q = "<name>, <county> County, Florida, USA"`,
   `countrycodes=us`, `limit=3`, `addressdetails=1`.
2. Respect the usage policy: **1 request per second, hard**, and a real `User-Agent` with a
   contact address. Violating this gets the IP blocked, and there is no way to rush 155
   sequential requests below ~3 minutes anyway.
3. Score the result:
   - `high` — result is a `tourism=hotel/motel/resort` or `building=hotel`, inside the
     expected county, and the name similarity (token-set ratio) is ≥ 0.8
   - `medium` — inside the expected county, similarity ≥ 0.55
   - `low` — inside Florida but the county does not match, or similarity < 0.55
   - `failed` — no result, or the point falls outside the Florida bbox
4. Cache every raw response to `data/.geocode-cache/<poi_id>.json`, gitignored. Re-running
   must not re-hit the network for rows already resolved.
5. Write `data/geocode-report.md`: counts per confidence level, and a table of every
   `low`/`failed` row with its query and candidate results.

**Then review by hand.** Every `low` and `failed` row gets coordinates looked up manually
and written back into the CSV with `geocode_source = manual`. Set
`geocode_confidence = high` only when you have actually verified the location.

A row with `geocode_confidence = failed` and no manual fix is **excluded from the build**,
with a warning. A hotel at the wrong coordinates is worse than a hotel that is missing.

The `data/.geocode-cache/` directory and the Nominatim attribution requirement both matter:
the site already credits OpenStreetMap for the basemap, which covers this use too.

## 5. The generated artefact — `public/data/pois.v1.json`

Built by `scripts/build-dataset.ts`, not committed, regenerated in `prebuild`.

```jsonc
{
  "version": 1,
  "generatedAt": "2026-08-11T00:00:00.000Z",
  "themes": [ /* the catalog, inlined so the client needs one request */ ],
  "families": { /* slug → { label, color } */ },
  "bbox": [-87.6, 24.5, -80.0, 30.7],   // actual extent of the data, for "reset view"
  "counties": [ { "slug": "orange", "name": "Orange", "count": 28,
                  "center": [-81.4, 28.5], "bbox": [ /* … */ ] } ],
  "pois": [
    {
      "id": 0,                          // dense 0-based index — this is the map feature id
      "poiId": "20319181081752292",
      "slug": "universal-s-cabana-bay-beach-resort-orange",
      "name": "Universal's Cabana Bay Beach Resort",
      "county": "Orange",
      "lat": 28.4712, "lng": -81.4671,
      "themes": ["family-friendly"],
      "primary": "family-friendly",
      "family": "family"
    }
  ]
}
```

Two things about `id`:

- It is a **dense integer index**, assigned at build time in sorted order. MapLibre feature
  ids must be positive integers, and the 17-digit `poiId` is not safely representable as one.
  `poiId` stays alongside as a string for traceability.
- It is **not stable across builds** if rows are added or removed. Never put it in a URL or
  a bookmark. The URL uses `slug`; `lib/data` keeps a `slug → id` map for the map layer.

Size check: 155 rows at this shape is ~35 KB raw, ~8 KB gzipped. Even at 2,000 rows it is
~100 KB gzipped, which is still one cheap immutable request.

## 6. Types — `lib/types.ts`

Zod first, types inferred, validated once when the dataset loads:

```ts
export const Theme = z.object({
  slug: z.string(), label: z.string(), short: z.string(),
  family: z.enum(['urban','family','outdoors','indulgence','none']),
  icon: z.string(), color: z.string().regex(/^#[0-9a-f]{6}$/i),
})

export const Poi = z.object({
  id: z.number().int().nonnegative(),
  poiId: z.string(),
  slug: z.string(),
  name: z.string().min(1),
  county: z.string(),
  lat: z.number().min(24).max(31.2),      // Florida, not the planet
  lng: z.number().min(-88).max(-79.5),
  themes: z.array(z.string()),            // may be empty
  primary: z.string(),                    // 'unclassified' when themes is empty
  family: Theme.shape.family,
})

export const Dataset = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  themes: z.array(Theme),
  families: z.record(z.string(), z.object({ label: z.string(), color: z.string() })),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  counties: z.array(z.object({
    slug: z.string(), name: z.string(), count: z.number().int(),
    center: z.tuple([z.number(), z.number()]),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  })),
  pois: z.array(Poi),
})

export const SearchParams = z.object({
  bbox: z.string().regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/).optional(),
  z: z.coerce.number().min(5.5).max(18).default(6.2),  // matches the map's minZoom/maxZoom
  themes: z.string().optional(),        // "family-friendly,romantic-getaways" — OR semantics
  q: z.string().max(120).optional(),    // free-text name/county query
  hotel: z.string().optional(),         // slug
})

export type Poi = z.infer<typeof Poi>
export type Dataset = z.infer<typeof Dataset>
```

**Theme filtering is OR, not AND.** "Family-friendly or Romantic" is the question a traveller
actually asks; requiring every selected theme on one hotel would return almost nothing given
that the median hotel has 3 themes out of 13. This is the opposite of the usual amenity-filter
convention, so it is worth a comment in the code.

## 7. Reference values

Florida bounding box: `[-87.7, 24.3, -79.8, 31.1]` (W, S, E, N).
Default map view: center `[-81.6, 27.9]`, zoom `6.2`.
`maxBounds`: Florida bbox padded 1.5°, so users cannot pan to Kansas.

## 8. Data quality gates (enforced in `build-dataset.ts`, build fails on violation)

- Every row has a non-empty `poi_id`, `name` and `slug`
- `poi_id` and `slug` are both unique
- Every `lat`/`lng` is present, numeric, and inside the Florida bbox
- No row has `geocode_confidence = failed` (fix it or delete the row deliberately)
- Every theme slug in every row exists in `themes.json`
- `primary_theme` equals `themes[0]`, or `unclassified` when `themes` is empty
- Warn (do not fail) when the share of `unclassified` rows exceeds 40%
