# Phase 02 — Map shell

**Goal:** replace the grey placeholder with a real, fast, full-bleed MapLibre map of Florida
using a self-hosted PMTiles basemap, with mobile gestures tuned and the viewport wired to the
URL. No markers yet.

**Depends on:** Phase 00. Phase 01 is not strictly required here, but do it first anyway — a
map with nothing on it is hard to evaluate.

---

## Scope

The map instance and its lifecycle. This is the foundation everything else sits on, so get the
imperative/React boundary right here and the next three phases are easy.

## Files to create

```
components/map/map-canvas.tsx        # 'use client', owns the MapLibre instance
components/map/use-map-instance.ts   # creation, cleanup, ready state
components/map/use-map-viewport.ts   # moveend → debounced URL write, URL → map (guarded)
components/map/map-controls.tsx      # zoom +/- and locate FABs
components/map/map-attribution.tsx
components/map/no-webgl-fallback.tsx
lib/url-state.ts                     # parse/serialize search params, shallow router helpers
lib/geo/viewport.ts                  # bounds↔bbox, "moved meaningfully?" predicate
public/map-style.json                # Protomaps style, committed
scripts/build-tiles.md               # documented one-off tile build procedure
```

## Requirements

**Tiles.** Build the Florida PMTiles extract and upload it to Cloudflare R2:

```bash
pmtiles extract https://build.protomaps.com/<latest>.pmtiles florida.pmtiles \
  --bbox=-87.7,24.3,-79.8,31.1 --maxzoom=14
```

Create a public R2 bucket with a custom domain (R2 has zero egress fees and sits behind
Cloudflare's CDN, which is what makes range requests fast). Set
`NEXT_PUBLIC_TILES_URL=https://tiles.<yourdomain>/florida.pmtiles`. Document the exact steps
in `scripts/build-tiles.md` so it is reproducible.

**Style.** Generate the style from `@protomaps/basemaps` and commit it as
`public/map-style.json`. The committed file uses a **placeholder** source URL; at runtime,
fetch (or statically import) the JSON, set
`style.sources.protomaps.url = 'pmtiles://' + process.env.NEXT_PUBLIC_TILES_URL`, and pass the
resulting **object** to `new maplibregl.Map({ style: styleObject })`. Do not pass
`style: '/map-style.json'` — a committed static file cannot carry an environment-specific
tiles URL, and hardcoding it there is how you end up unable to deploy to two environments.

Tune the style: desaturate land, soften water to a pale blue, thin the roads, drop POI icons
entirely below zoom 14. The basemap is a backdrop — the theme markers are the only saturated
colour on screen and that is what makes them readable. Point the glyphs at a self-hosted Inter
glyph set (or the Protomaps-hosted one) so cluster labels match the UI font.

**Map creation** (`use-map-instance.ts`):

```ts
map = new maplibregl.Map({
  container,
  style: styleObject,               // patched with the env tiles URL, see above
  center: [-81.6, 27.9],
  zoom: 6.2,
  maxBounds: [[-89.2, 22.8], [-78.3, 32.6]],   // Florida padded 1.5°
  minZoom: 5.5,
  maxZoom: 18,
  dragRotate: false,
  pitchWithRotate: false,
  attributionControl: false,        // custom, see below
  fadeDuration: 0,                  // snappier label transitions on mobile
  refreshExpiredTiles: false,
})
map.touchZoomRotate.disableRotation()
map.touchPitch.disable()
```

Register the PMTiles protocol **before** creating the map:

```ts
import * as pmtiles from 'pmtiles'
const protocol = new pmtiles.Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)
```

**MapLibre v6 specifics — get these right or nothing works:**

- ESM only: `import * as maplibregl from 'maplibre-gl'`, never a default import
- Import the CSS: `import 'maplibre-gl/dist/maplibre-gl.css'`
- WebGL2 is mandatory. Feature-detect before constructing:
  `document.createElement('canvas').getContext('webgl2')`. If null, render
  `<NoWebGLFallback />` instead of the map
- Attach `map.on('error', ...)` and log to console in dev — v6 surfaces WebGL failures here
- `map.transform` is gone; use only public APIs (`getBounds`, `getCenter`, `getZoom`,
  `project`, `unproject`)

**React integration — the rules:**

- `MapCanvas` is loaded with `next/dynamic(..., { ssr: false })` and a skeleton `loading`
- The container `<div ref>` mounts exactly once. It must have no `key` that can change and
  must not be conditionally rendered after mount
- The map instance lives in a ref, never in state. Expose a `ready` boolean state so children
  can wait for `load`
- Cleanup: `map.remove()` in the effect teardown, and guard against React 19 Strict Mode
  double-invocation (check the ref before creating)
- `ResizeObserver` on the container calling `map.resize()`, debounced 100 ms — necessary
  because the sheet changes the visual layout and mobile browsers resize on URL-bar collapse

**Viewport ↔ URL** (`use-map-viewport.ts`). Implement exactly the loop in
`docs/ARCHITECTURE.md`:

- On `moveend`: read bounds and zoom, round the bbox to 5dp, and write `?bbox=&z=` with
  **`window.history.replaceState`** after a 350 ms debounce. Not `router.replace` — see the
  history policy table in `docs/ARCHITECTURE.md`. Map movement must not create history
  entries and must not trigger an RSC request
- Note that nothing fetches because of this write. The URL bbox is a record of the view so a
  shared link restores it, not an input to a query. The list is recomputed directly from
  `moveend`, synchronously, without waiting for the debounce
- Guard with the `movingFromCode` ref so a code-driven `flyTo` never re-triggers a URL write
- On mount, if the URL already has `bbox` and `z`, restore with
  `map.jumpTo({ center: centerOf(bbox), zoom: z })`. Do **not** use `fitBounds` — it applies
  padding and rounds the zoom down, so repeated write→reload cycles drift
- On a URL bbox change originating outside the map (place search, a card tap, back/forward),
  `easeTo` the new center/zoom with the guard set and `duration: 400` — or `jumpTo` under
  reduced motion

**Controls** (`map-controls.tsx`). No default MapLibre controls — build custom FABs:

- Zoom in / zoom out, stacked, bottom-right, only rendered at `md:` and up (on a phone,
  pinch is the interaction; buttons waste thumb space)
- Locate FAB, always visible, bottom-right. Uses
  `maplibregl.GeolocateControl`'s behaviour but with your own button: on click request
  `navigator.geolocation`, `easeTo` to the position at zoom 13, drop a subtle blue dot. If
  permission is denied, do nothing visible except a one-time toast. Never block the UI on it
- All FABs 44×44, positioned relative to a `--sheet-height` CSS variable so they ride above
  the sheet in Phase 04

**Attribution.** Required by both OSM and Protomaps licences. A small, tappable "ⓘ" in the
bottom-left that expands to
`© OpenStreetMap contributors · Protomaps`. Do not hide it.

**Performance.** Preconnect to the tiles domain in `layout.tsx`. The map must not block first
paint — the shell renders, then the map fades in over ~150 ms.

## Out of scope

Markers, clustering, the dataset, the sheet, filters.

## Acceptance checklist

- [ ] Map of Florida renders full-bleed on `/search`, tiles load, labels are legible on a phone
- [ ] Pinch-zoom, one-finger pan and double-tap-zoom all work; rotation and pitch are
      impossible by any gesture
- [ ] Panning is smooth at 60fps on a real phone
- [ ] The user cannot pan outside the padded Florida bounds or zoom below 5.5
- [ ] Panning updates `?bbox=&z=` in the address bar after ~350 ms of stillness
- [ ] Small nudges (under the threshold) do **not** change the URL
- [ ] Reloading the page restores the exact viewport from the URL with no animation, and
      reload→pan→reload ten times shows no zoom drift
- [ ] Panning does **not** add history entries — pan twenty times, press back once, and you
      leave the page (this is correct; discrete actions in later phases are what back undoes)
- [ ] The map never remounts: add a temporary `console.count('map created')` and confirm it
      logs exactly once across a session of panning, filtering and navigating
- [ ] With WebGL2 disabled (`chrome://flags`), the fallback renders instead of a blank canvas
- [ ] Attribution is visible and correct
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass
- [ ] Commit: `feat(phase-2): maplibre map shell with pmtiles basemap`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/ARCHITECTURE.md, docs/MAP-UX.md (sections 1 and 7) and
specs/02-map-shell.md.

Implement Phase 02 — the MapLibre map shell. No hotel pins, no data fetching, no sheet.

Critical constraints, do not deviate:
- MapLibre GL JS v6 is ESM-only and requires WebGL2. Use `import * as maplibregl from
  'maplibre-gl'`, feature-detect WebGL2, and render a fallback when it is missing.
- Do NOT use react-map-gl. Write the imperative hook yourself.
- The map instance lives in a ref and is created exactly once. The container div must never
  remount. Handle React 19 Strict Mode double-invocation.
- A URL change caused by map movement must never move the map. Implement the
  `movingFromCode` ref guard described in docs/ARCHITECTURE.md.
- Viewport writes use window.history.replaceState, NOT router.replace. Follow the history
  policy table in docs/ARCHITECTURE.md exactly.
- Restore the viewport on load with jumpTo({center, zoom}), never fitBounds.
- The client island uses useSearchParams, so it must sit inside the Suspense boundary added
  in Phase 00.
- Rotation and pitch are disabled.

Build in this order: PMTiles protocol registration and the style, then use-map-instance,
then MapCanvas with dynamic ssr:false, then use-map-viewport with the debounced URL loop,
then the custom control FABs and attribution.

For the tiles: write scripts/build-tiles.md documenting the exact pmtiles extract command
and the R2 upload steps, and read the tiles URL from NEXT_PUBLIC_TILES_URL. If that env var
is unset, fall back to a demo style and log a warning rather than crashing.

Run the acceptance checklist and report each item. Pay particular attention to the "map
never remounts" check. Commit with "feat(phase-2): maplibre map shell with pmtiles basemap".
```
