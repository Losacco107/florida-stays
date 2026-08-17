@AGENTS.md

# CLAUDE.md — Florida Stays

Project instructions for Claude Code. Read this at the start of every session.

## What we are building

A mobile-first website for exploring a curated list of Florida hotels on an interactive map,
in the style of Airbnb's map search. Each hotel is a coloured icon marker on the map. The
icon encodes the hotel's **primary top-selling theme**; hovering it on desktop shows a
tooltip with all of its themes, and tapping it on mobile opens a card in the bottom sheet.

Scope of the MVP is **discovery only**: map, list, theme filters, place search, hotel detail
page. No prices, no availability, no reviews, no accounts, no booking.

## Language rule (non-negotiable)

**Everything is in English.** UI strings, code identifiers, comments, commit messages, data
columns, error messages, file names. No Portuguese anywhere in the codebase, even in
comments. If the user writes to you in Portuguese, reply in Portuguese but write English
into the files.

## There is no price anywhere

The source data has no rates and we do not invent them. Do not add a price field, a price
filter, a "from $X" label, a currency, or a sort-by-price option. If a design reference shows
a price pill, that part of the reference does not apply.

## There is no database

The whole dataset is ~250 hotels and changes at most monthly. It is a spreadsheet that
becomes a typed JSON file at build time and is loaded once by the browser. There is no
Postgres, no PostGIS, no ORM, no connection string, no migrations, and no data-fetching API
routes. Do not add any of them. See `docs/ARCHITECTURE.md` for the threshold at which this
decision should be revisited.

## Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router | 16.x |
| UI | React + TypeScript (strict) | 19.x / 5.x |
| Styling | Tailwind CSS | 4.x |
| Primitives | Radix UI + Vaul (bottom sheet) | latest |
| Map | MapLibre GL JS (direct, no wrapper) | 5.x |
| Basemap | Protomaps PMTiles on Cloudflare R2 | — |
| Data | Build-time generated JSON from a committed CSV | — |
| Validation | Zod | 4.x |
| Tests | Vitest + Playwright | latest |
| Hosting | Vercel | — |

Also pre-approved: `pmtiles`, `@protomaps/basemaps`, `lucide-react`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `prettier-plugin-tailwindcss`,
`@sentry/nextjs`, `@axe-core/playwright`, `@next/bundle-analyzer`, `papaparse` (ingest only),
`xlsx` (ingest only).

Do not add anything beyond those lists without asking. In particular: no `react-map-gl` (it
reaches into MapLibre internals in ways that break across major versions — see the pinned
5.x note above), no state-management library, no data-fetching library (there is one static
fetch in the whole app), no component kit beyond Radix, no carousel library, no
virtualization library.

## Directory layout

```
app/
  (marketing)/page.tsx          # landing → redirects to /search
  search/page.tsx               # THE app: map + sheet
  hotels/[slug]/page.tsx        # detail page, statically generated
  florida/[county]/page.tsx     # county landing pages for SEO
components/
  map/  sheet/  filters/  search/  hotel/  ui/
  # Authoritative component inventory: docs/DESIGN-SYSTEM.md. Do not invent parallel names.
lib/
  data/          # loadPois(), the in-memory index, derived selectors
  geo/           # bbox.ts, viewport.ts
  themes.ts      # theme catalog accessors, typed from data/themes.json
  url-state.ts   # parse/serialize search params
  types.ts       # zod schemas + inferred types
data/
  fl-pois.csv        # committed source of truth, human-editable
  themes.json        # committed theme catalog
scripts/
  ingest.ts          # spreadsheet → data/fl-pois.csv
  geocode.ts         # fills lat/lng, flags rows for review
  build-dataset.ts   # data/*.csv+json → public/data/pois.v1.json + types
public/data/pois.v1.json   # generated, not committed
docs/  specs/                # this plan
```

## Hard rules

### Mobile-first, always

- Write the base styles for a 390×844 viewport. Add `sm:`/`md:`/`lg:` only to *widen*.
- Use `100dvh`, never `100vh`. Use `env(safe-area-inset-*)` on anything touching a screen edge.
- Every interactive target is at least 44×44 CSS px.
- **Hover is desktop-only enrichment.** The marker tooltip is a hover affordance; on touch,
  the equivalent information arrives by tapping the marker and reading the card. Never put
  information behind hover alone.
- The map must never be inside a scrollable container.

### Map rendering

- Markers are a **MapLibre symbol layer** with runtime-generated sprites, not HTML markers.
- The icon carries the theme; colour carries the theme *family*. Four families plus a neutral
  for unclassified — the palette in `docs/DESIGN-SYSTEM.md` is validated for all-pairs
  colour-vision separation. Do not add a fifth colour or recolour a family.
- A legend is mandatory, not optional. Icon-only markers are meaningless without it.
- Clustering is MapLibre's built-in GeoJSON clustering.
- The map instance is created once and never re-created. React state changes call imperative
  MapLibre methods; they must never remount the container div.
- Pinned to MapLibre GL JS **5.x, not 6.x**. 6.3.0's ESM worker spawns and closes immediately
  under Next.js (both webpack and Turbopack) — every source silently never loads, no error
  surfaces. Confirmed with the same app code against 5.24.0, which works. Do not upgrade to 6
  without first confirming upstream has fixed the worker lifecycle issue.
- Import as `import * as maplibregl from 'maplibre-gl'`, load in a `'use client'` component
  via `next/dynamic` with `ssr: false`, and handle the no-WebGL2 case with a list-only
  fallback.

### Data flow

- The browser fetches `/data/pois.v1.json` **once**. Everything after that — viewport
  filtering, theme filtering, search, sorting, the list, the detail preview — is synchronous
  in-memory work over that array.
- No loading spinners after first load. Filtering is instant; treat any perceptible delay as
  a bug.
- The filename is versioned (`pois.v1.json`) and served immutable. Bump the version when the
  shape changes.

### State lives in the URL

`/search?bbox=…&z=…&themes=…&q=…&hotel=…`

Those key names are canonical — identical in the query string and in the Zod schema in
`lib/types.ts`. `hotel` is the hotel **slug**. Component state is for transient UI only
(is the sheet dragging, is a menu open). Never duplicate URL state into React state.

Writes follow the history policy in `docs/ARCHITECTURE.md`: map movement uses
`window.history.replaceState` (no history entry); deliberate actions — place search, filter
changes, selection — use `router.push`.

### Code style

- Server Components by default. `'use client'` only where interactivity requires it: the map,
  the sheet, the filter controls, the search overlay.
- No `any`. No non-null `!` assertions without a comment explaining why it is safe.
- Zod-validate the generated dataset at the boundary where it is loaded.
- Components under 200 lines. If one grows past that, split it.
- Comments explain *why*, never *what*.

### Accessibility

- The map is a supplementary view. Everything on the map is also in the list. The list is the
  accessible path, and a "Skip map, go to results" link is the first focusable element.
- The result sheet is **non-modal** (the map stays interactive behind it), so it is a
  labelled `role="region"` and does **not** trap focus. The filter drawer *is* modal and
  *does* trap focus. These differ on purpose.
- Theme identity is never colour-alone: every marker has a distinct icon, the legend pairs
  swatch + icon + label, and cards show text badges.
- Announce result counts via a polite live region when the filtered set changes.
- Respect `prefers-reduced-motion`: no fly-to animations, `jumpTo` instead.

## Commands

```bash
pnpm dev              # dev server
pnpm build            # runs build-dataset then next build — must pass before a phase is done
pnpm lint             # eslint, zero warnings
pnpm typecheck        # tsc --noEmit, zero errors
pnpm test             # vitest
pnpm test:e2e         # playwright
pnpm data:ingest      # spreadsheet → data/fl-pois.csv
pnpm data:geocode     # fill lat/lng, write the review report
pnpm data:build       # data/ → public/data/pois.v1.json (also runs in prebuild)
```

## Definition of done for any phase

1. `pnpm lint && pnpm typecheck && pnpm build` all pass clean.
2. The acceptance checklist in the phase spec passes, item by item.
3. Verified on a real phone or Chrome DevTools iPhone 15 emulation with 4G throttling.
4. Committed with a conventional-commit message: `feat(phase-3): theme icon markers`.

## Things to ask about rather than assume

- Adding any dependency not listed above.
- Adding a database, an API route that returns data, or a client data-fetching library.
- Changing the theme catalog, the colour families, or the primary-theme rule.
- Anything that would require a paid API key.
- Any change that makes the desktop layout better at the cost of mobile.
