# Phase 06 — Hotel and county pages

**Goal:** a statically generated page for every hotel and every county, so the content is
crawlable and every marker is deep-linkable.

**Depends on:** Phases 01 and 02 — the `MiniMap` needs the patched style object and the
PMTiles protocol; the back link needs `lib/url-state.ts`. Can be built in parallel with
Phases 04–05.

---

## A note on scope

Be honest about what this page can be. The dataset has a name, a county, coordinates and a
list of themes — no photos, no description, no rating, no price, no booking link. A detail
page built from that is thin, and dressing it up with placeholder imagery and filler copy
would make it worse, not better.

So build it small and useful: it exists to be the deep-link target for a marker, to give
search engines a crawlable page per hotel, and to be the natural place to add real content
later. Do not invent content to fill space.

## Files to create

```
app/hotels/[slug]/page.tsx
app/hotels/[slug]/not-found.tsx
app/hotels/[slug]/opengraph-image.tsx
app/florida/[county]/page.tsx
app/florida/page.tsx                 # index of counties
components/hotel/hotel-header.tsx
components/hotel/theme-list.tsx
components/hotel/mini-map.tsx
components/hotel/nearby-stays.tsx
lib/data/server.ts                   # reads the generated JSON at build time
app/sitemap.ts
tests/e2e/hotel-detail.spec.ts
```

## Requirements

### Data access on the server

`lib/data/server.ts` reads `public/data/pois.v1.json` from disk with `node:fs` at build time
and caches it in a module variable. Do not `fetch` your own origin during the build — it is
slower and fails in some build environments. The client's `lib/data/load.ts` stays separate.

### Rendering

Server Component with `generateStaticParams()` over every slug and `export const revalidate = false`
— the data only changes on deploy, so there is nothing to revalidate. ~155 pages build in
under a second.

In Next 16, `params` is a **Promise** and must be awaited in `page.tsx`, `generateMetadata`
and `opengraph-image.tsx`: `const { slug } = await params`, typed as
`{ params: Promise<{ slug: string }> }`.

Unknown slug → `notFound()`.

### Metadata

- Title: `<Hotel Name> — <County> County, Florida | Florida Stays`
- Description: generated from the themes, in real prose:
  "A family-friendly, outdoor-adventure stay in Orange County, Florida." For unclassified
  hotels, fall back to "A hotel in Orange County, Florida." Do not write a fake review
- Canonical URL, OpenGraph and Twitter card
- `opengraph-image.tsx` via `ImageResponse`, 1200×630: hotel name, county, and the theme
  icons in their family colours on a clean background. The themes are the only distinctive
  content we have, so make them the image

### Structured data

`Hotel` JSON-LD with `name`, `address` as `PostalAddress` (`addressRegion: "FL"`,
`addressLocality: <county>`), `geo` as `GeoCoordinates`, and `url`. Plus a `BreadcrumbList`:
Home → Florida → County → Hotel.

**Omit `aggregateRating`, `priceRange` and `starRating` entirely.** We have no such data, and
emitting empty or invented values is both a lie and a structured-data violation that Google
will flag. Validate with the Rich Results Test.

### Page layout, mobile-first

1. **Header bar.** Back button, 44×44, returning to `/search` with the previous state —
   `document.referrer` when same-origin, otherwise `/search?hotel=<slug>&bbox=<point bbox>&z=15`
2. **Title block.** H1 name, county as a link to the county page, and the primary theme's
   coloured circle repeating the map marker
3. **Themes.** Every theme as a full-size row: icon in a family-coloured circle, full label,
   and a one-line plain-language description of the theme pulled from the catalog (add a
   `blurb` field to `themes.json` in this phase — 13 short sentences, written once).
   Unclassified hotels get an honest line: "This stay hasn't been classified into a theme yet."
4. **Location.** `MiniMap`, 240 px tall, centred on the hotel at zoom 14, one non-clustered
   marker, interaction disabled except a tap that deep-links back into `/search`. County name
   below it. No street address, because we do not have one
5. **Nearby stays.** Up to 6 hotels within 15 km, computed with a plain haversine over the
   in-memory array, ordered by distance, excluding self, shown as the same `ResultCard`.
   Horizontally scrollable. This is the most useful part of the page — it turns a dead end
   into a browse path

No booking bar. There is no booking URL in the data, and a disabled or fake "Book" button is
worse than its absence. When a real link arrives, this is where it goes.

### Mini-map performance

Do not load the full PMTiles basemap for a 240 px map on a text page. Lazy-init the MapLibre
instance on `IntersectionObserver`, or render a static placeholder that swaps on tap. Either
way it must not affect LCP — verify the LCP element is the H1 or the theme list.

### County pages

`/florida/[county]` — H1 "<County> County hotels", the count, a grid of every hotel in that
county as `ResultCard`s, a theme breakdown for the county, and a link into `/search` prefilled
with the county bbox. `/florida` lists all 23 counties with counts.

These are cheap to build and they are where organic traffic actually lands.

### Sitemap

`app/sitemap.ts` — every hotel slug, every county, `/search`, and the root, with
`lastModified` from the dataset's `generatedAt`.

### E2E

- A hotel page renders with the correct name, county and every one of its themes
- JSON-LD is present, parses, and has `@type: Hotel` with **no** `aggregateRating` or
  `priceRange` keys
- Nearby stays are within 15 km and exclude the current hotel
- The back button returns to the search page
- An unknown slug renders the 404 page
- A county page lists exactly the hotels in that county

## Acceptance checklist

- [ ] All hotel and county pages build statically — visible as prerendered in the build output
- [ ] Lighthouse mobile: performance ≥ 95, SEO = 100, accessibility ≥ 95
- [ ] JSON-LD passes the Rich Results Test with no errors and no invented fields
- [ ] The OG image renders with the hotel's theme icons
- [ ] The mini-map does not affect LCP — confirm the LCP element is text
- [ ] Unclassified hotels read honestly rather than looking broken
- [ ] Nearby stays are correct and make the page a browse path rather than a dead end
- [ ] Back from a hotel page returns to the map with viewport and filters intact
- [ ] `/sitemap.xml` lists every hotel and county
- [ ] The E2E test passes
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass
- [ ] Commit: `feat(phase-6): hotel and county pages`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/DATA-MODEL.md, docs/DESIGN-SYSTEM.md and specs/06-hotel-detail.md.

Implement Phase 06 — hotel and county pages.

Read the "note on scope" section first and take it seriously. The dataset has a name, a
county, coordinates and themes. Build a small honest page from exactly that. Do not add
placeholder images, lorem descriptions, fake ratings, a disabled Book button, or a
priceRange in the JSON-LD. An unclassified hotel should read as honestly unclassified, not
as a broken page.

Technical points:
- Server Components, generateStaticParams over every slug, revalidate false.
- In Next 16, params is a Promise and must be awaited in page.tsx, generateMetadata and
  opengraph-image.tsx.
- lib/data/server.ts reads the generated JSON from disk with node:fs at build time. Do not
  fetch your own origin during the build.
- The mini-map must NOT be part of initial page load — lazy-init on intersection so it
  cannot affect LCP.
- JSON-LD includes only fields we actually have.

Add a `blurb` field to data/themes.json in this phase: one short plain-language sentence per
theme, written by you, for the theme rows on the detail page.

Run the acceptance checklist including the Lighthouse and Rich Results checks, and report the
actual scores. Commit with "feat(phase-6): hotel and county pages".
```
