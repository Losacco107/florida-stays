# Phase 03 — Theme markers, clustering and the hover tooltip

**Goal:** the real hotels on the map as coloured theme markers that cluster at low zoom,
select on tap, and show a tooltip on desktop hover. This is milestone M1 — after this phase
the product is worth showing to someone.

**Depends on:** Phases 01 and 02.

**Recommended:** run this in plan mode (`Shift+Tab` twice) and review the approach before it
writes code. Highest-risk phase in the build.

---

## Files to create

```
components/map/marker-images.ts       # generates the 28 sprites at runtime
components/map/marker-layer.tsx       # source + layers, imperative
components/map/cluster-layer.tsx
components/map/marker-tooltip.tsx     # desktop hover only
components/map/use-selection.ts       # ?hotel=<slug> ↔ feature id ↔ map
lib/data/use-dataset.ts               # use() + Suspense wrapper
tests/e2e/map-markers.spec.ts
```

## Requirements

### Sprite generation (`marker-images.ts`)

Draw to an `OffscreenCanvas` at `devicePixelRatio` and register with `map.addImage`. Two
sprites per theme (default and selected) across 13 themes plus the neutral = **28 images**.
Generate them in one pass at map load; it takes a few milliseconds.

Each sprite: filled circle in the family colour, 2 px white ring (3 px ink ring for
selected), soft shadow, and the theme's lucide glyph in white at 16 px, centred. Pull the
glyph paths from `lucide-static` or inline the 14 SVG paths in a constants file — do not
render React components to canvas.

Sizes from `docs/DESIGN-SYSTEM.md`: 32 px default, 40 px selected. Regenerate on
`devicePixelRatio` change.

### Source and layers

```js
map.addSource('pois', {
  type: 'geojson',
  data: featureCollection,          // from toFeatureCollection(visible)
  cluster: true, clusterRadius: 44, clusterMaxZoom: 12,
  // NO promoteId — the id is emitted at the top level of each Feature
})
```

Four layers in this order (later draws on top):

1. `clusters` — circle, `filter: ['has','point_count']`, ink fill, white 2 px stroke, radius
   stepped 18/22/28 at counts 10/25/50
2. `cluster-count` — symbol, `['get','point_count_abbreviated']`, white, 12 px, 700
3. `poi-markers` — the symbol layer in `docs/MAP-UX.md` §3, with
   `'icon-image': ['concat', 'marker-', ['get','primary']]`
4. `poi-marker-selected` — same source, `filter: ['==', ['id'], -1]`,
   `icon-allow-overlap: true`, `icon-ignore-placement: true`, drawn last

Three expression rules, all easy to get wrong and all silent when wrong:

- Use **`['id']`**, not `['get','id']`. The latter reads `properties.id`, which does not
  exist in our payload
- Do **not** set `promoteId` — it would replace the feature id with `properties.<name>` and
  blank it out
- `icon-image` is a **layout** property and cannot read `feature-state`. That is why the
  selected marker is a separate layer driven by `setFilter`, not a state on the base layer.
  `icon-opacity` is paint, so the visited state uses `setFeatureState`

### Updating data

When filters change, call `map.getSource('pois').setData(newCollection)`. Never remove and
re-add the source or the layers — that causes a visible flash and leaks the sprite bindings.

### Selection (`use-selection.ts`)

`?hotel=<slug>` is the URL form; the map needs a numeric feature id. `lib/data` exposes a
`slugToId` map built once at load.

- Tap a marker → `router.push` with `?hotel=<slug>` → `setFilter` on the selected layer →
  `easeTo({ center, offset: [0, -sheetHeight/3], duration: 400 })`
- Tap a cluster → `getClusterExpansionZoom` → `easeTo({ center, zoom, duration: 500 })`
- Tap empty map → clear `?hotel`
- Hit area: query with a 6 px box, `queryRenderedFeatures([[x-6,y-6],[x+6,y+6]], { layers: ['poi-markers'] })`
- Visited: a `Set<number>` in a ref seeded from `sessionStorage`, applied with
  `setFeatureState({ source: 'pois', id }, { visited: true })`

Before relying on feature-state, spike it: clustering re-indexes the source through
supercluster and id propagation to unclustered leaves is not guaranteed across versions.
Cluster a source, `setFeatureState` a leaf, confirm `icon-opacity` changes. If it does not
work, drop the visited styling rather than restructuring selection — it is a nice-to-have.

### Hover tooltip (`marker-tooltip.tsx`) — desktop only

Gate on `window.matchMedia('(hover: hover) and (pointer: fine)')`, not on screen width.

- `mousemove` on `poi-markers` sets the hovered feature; `mouseleave` clears it
- Position from `map.project(coordinates)`, recomputed on `move` so it tracks during a pan
- 240 px card: name (truncated to one line), county in muted text, then all themes as
  `ThemeBadge`s — coloured dot + short label — with the primary first and marked with a
  filled dot versus outline
- Unclassified hotels: "No theme classified yet", muted
- 120 ms delay in, immediate out. `pointer-events: none`. Flips below the marker when there
  is no room above
- Also scale the hovered marker: a second `setFilter`-driven layer, or simply skip the scale
  and rely on the tooltip. Do not add a third sprite set for hover unless the scale really
  earns it

On touch there is no tooltip at all — the sheet card in Phase 04 carries the same content.
Do not build a "tap to show tooltip" fallback; that is what the sheet is for.

### Loading

`use-dataset.ts` wraps `loadDataset()` with `use()` inside a Suspense boundary. While it
resolves, the map renders with the basemap and no markers, and the sheet shows three skeleton
rows. There is exactly one loading state in the app's lifetime and this is it.

### E2E (`tests/e2e/map-markers.spec.ts`)

Expose the map as `window.__map` in dev/test builds only, and assert via `page.evaluate`.

- Markers render after load; count matches the dataset size at a Florida-wide view
- Zooming out to state level produces cluster circles; tapping one zooms in
- Tapping a marker sets `?hotel=<slug>` and applies the selected filter
- Tapping the background clears it
- Desktop project only: hovering a marker shows a tooltip containing the hotel name
- Mobile project: hovering does nothing, and no tooltip element exists in the DOM

## Acceptance checklist

- [ ] All 155 Florida hotels render as coloured theme markers at the default view
- [ ] Marker colour matches the hotel's theme family and the glyph matches its primary theme
- [ ] Unclassified hotels show the neutral grey bed marker
- [ ] Clusters appear below zoom 12 and expand correctly on tap
- [ ] Tapping a marker selects it, and the selected marker is never hidden behind another
- [ ] Selected marker stays visible when it sits inside a dense group in Orlando
- [ ] Desktop hover shows the tooltip with every theme of that hotel, primary marked first
- [ ] The tooltip tracks the marker while panning and never covers it
- [ ] On a real phone, no tooltip ever appears and tapping selects cleanly
- [ ] **60 fps panning Orlando at zoom 13 with 4× CPU throttling** — measured in the
      Performance panel, with the frame timings reported, not an impression
- [ ] Markers are legible against pale sand, dark water and green parkland on the real basemap
- [ ] The E2E test passes on both the iPhone 15 and desktop Chrome projects
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass
- [ ] Commit: `feat(phase-3): theme icon markers, clustering and hover tooltip`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/MAP-UX.md (sections 3, 4, 5, 8), docs/DESIGN-SYSTEM.md and
specs/03-markers-clustering.md.

Enter plan mode first and propose your approach for Phase 03. Wait for approval.

Then implement it. Non-negotiable:
- Markers are a MapLibre SYMBOL layer with 28 sprites generated at runtime to an
  OffscreenCanvas. No HTML markers — they will not hold 60fps.
- Use ['id'] in expressions, never ['get','id']. Do not set promoteId.
- icon-image is a layout property and cannot read feature-state, so the selected marker is a
  separate top-most layer driven by setFilter. feature-state is used only for icon-opacity
  (the visited state), which is paint.
- Data updates go through source.setData(). Never re-add the source or layers.
- The hover tooltip is gated on matchMedia('(hover: hover) and (pointer: fine)'), not on
  screen width, and does not exist on touch devices at all.
- There is no price anywhere. The marker communicates theme, nothing else.

The performance criterion is the one that matters: 60fps panning Orlando at zoom 13 with 4x
CPU throttle. Measure it and report the actual frame timings.

Run the full acceptance checklist and report each item. Commit with
"feat(phase-3): theme icon markers, clustering and hover tooltip".
```
