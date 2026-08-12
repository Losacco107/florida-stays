# MAP-UX.md — the interaction spec

Read this before writing a single line of map code. This is the difference between "a map
with dots on it" and the experience being asked for.

---

## 1. The layout, on a phone

```
┌─────────────────────────────┐  ← safe-area top
│  ⌕  Search hotels    [⚙ 2] │  floating search bar, over the map
│  [Family] [Outdoor] [City]…│  theme chips, horizontal scroll
├─────────────────────────────┤
│                             │
│         MAP                 │  fills 100dvh, absolute, z-0
│      ◉      ◉               │  theme icon markers
│         ⬤ 24                │  cluster
│    ◉         ◉              │
│                     [ ⓘ ]   │  legend toggle
│              [ ⌖ ]          │  locate FAB
│  ┌───────────────────────┐  │
│  │        ────           │  │  sheet handle
│  │  38 stays in view     │  │  PEEK snap, 12%
│  └───────────────────────┘  │
└─────────────────────────────┘  ← safe-area bottom
```

One screen, one sheet at three heights. The user never loses the map and never loses the
list.

## 2. Sheet snap points

| Snap | Height | What you see | When |
|---|---|---|---|
| `peek` | 12% (≈100 px) | Handle + "N stays in view" | Default |
| `half` | 55% | ~2 cards | After tapping a marker, or a light upward drag |
| `full` | 92% | Scrollable list, map still a visible sliver | Serious browsing |

- Past 60% of the distance to the next snap, **or** a flick faster than 0.5 px/ms, commits.
  Otherwise it springs back.
- 300 ms `cubic-bezier(0.32, 0.72, 0, 1)`. Under `prefers-reduced-motion`, 0 ms.
- The inner list scrolls **only** at `full`. At `peek` and `half`, a drag anywhere in the
  sheet moves the sheet. This is the thing implementations most often get wrong.
- At `full`, a downward drag moves the sheet only when the list is already at `scrollTop 0`.
- Dragging the sheet must never pan the map. `touch-action: none` on the drag surface.
- The sheet never fully covers the map — 8% always remains.

## 3. The marker

This is the product. Price pills are gone; the marker now answers "what kind of stay is
this?" at a glance.

**Anatomy.** A 32 px circle, filled with the **colour of the hotel's theme family**, holding
a 16 px white glyph — the **icon of the hotel's primary theme** — with a 2 px white ring and
a soft shadow so it reads against both pale sand and dark water.

**Primary theme** is the first theme listed in the spreadsheet cell (`primary_theme` in the
dataset). Hotels with no themes get the neutral grey circle and a generic bed icon.

**Why icon + family colour, and not 13 colours.** Thirteen categorical colours cannot be told
apart, and on a map any two markers can end up adjacent, so the palette has to survive
all-pairs comparison, not just neighbours in a legend. Four families plus a neutral is what
validates (see `docs/DESIGN-SYSTEM.md`). Colour gets you to the right *family* instantly;
the icon distinguishes within it; the legend and the card carry the words.

**States.**

| State | Appearance |
|---|---|
| Default | 32 px, family colour, white glyph, 2 px white ring |
| Hover (desktop) | Scale 1.12, shadow lifts, tooltip appears. Cursor `pointer` |
| Selected | Scale 1.25, 3 px ink ring, drawn above everything, never dropped by collision |
| Visited (session) | Ring goes to 70% opacity. Subtle — it should reward attention, not shout |
| Unclassified | Neutral grey `#75736d`, bed icon |

**Rendering.** A MapLibre symbol layer with sprites generated at runtime, not HTML markers.
800 absolutely-positioned DOM nodes transformed on every frame of a pan will not hold 60 fps
on a mid-range Android, and the layer approach costs no more code.

```js
// one sprite per theme (13) + one neutral, drawn to an OffscreenCanvas at devicePixelRatio
map.addImage(`marker-${theme.slug}`, imageData, { pixelRatio: dpr })
map.addImage(`marker-${theme.slug}-selected`, selectedImageData, { pixelRatio: dpr })

map.addLayer({
  id: 'poi-markers',
  type: 'symbol',
  source: 'pois',
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': ['concat', 'marker-', ['get', 'primary']],
    'icon-size': 1,
    'icon-allow-overlap': true,      // ← see the note below
    'icon-ignore-placement': false,
    'symbol-sort-key': ['get', 'sortKey'],
  },
  paint: {
    'icon-opacity': ['case', ['boolean', ['feature-state', 'visited'], false], 0.85, 1],
  },
})

// selected marker: its own layer, drawn last, filtered to one feature
map.addLayer({
  id: 'poi-marker-selected',
  type: 'symbol',
  source: 'pois',
  filter: ['==', ['id'], -1],
  layout: {
    'icon-image': ['concat', 'marker-', ['get', 'primary'], '-selected'],
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
  },
})
// on selection:
map.setFilter('poi-marker-selected', ['==', ['id'], selectedId])
```

Three expression details that are easy to get wrong:

- `['get','id']` reads `properties.id`. Use **`['id']`**, which reads the top-level GeoJSON
  feature id. Emit `id` at the feature level and **do not set `promoteId`** — `promoteId`
  replaces the feature id with `properties.<name>` and would blank it out.
- `['literal', x]` only accepts arrays and objects. Compare against a plain number.
- `icon-image` is a **layout** property, and layout properties cannot read `feature-state`.
  That is why "selected" is a separate layer rather than a state on the base layer.
  `icon-opacity` is paint, so the visited state can use feature-state.

**On `icon-allow-overlap: true`.** The price-pill version of this design set it to `false` so
colliding labels were dropped. Icons are different: a 32 px circle is small, and a user who
sees five overlapping markers in Orlando understands "there are several here" — whereas
markers silently vanishing as you zoom is confusing. Let them overlap, and let clustering do
the density work at low zoom. Revisit only if Orlando at zoom 12 turns into an unreadable
pile.

## 4. Clustering

```js
map.addSource('pois', {
  type: 'geojson', data: featureCollection,
  cluster: true, clusterRadius: 44, clusterMaxZoom: 12,
})
```

Cluster bubble: an ink-filled circle, radius stepping 18 / 22 / 28 px at counts 10 / 25 / 50,
white count label, 2 px white ring. Deliberately neutral — a cluster mixes themes, so giving
it a theme colour would lie.

Tap a cluster → `getClusterExpansionZoom` → `easeTo` that zoom and centre, 500 ms.

`clusterRadius` is 44 rather than the usual 60 because markers are small and the dataset is
sparse outside Orlando and Miami; a big radius would cluster hotels that are visibly far
apart. `clusterMaxZoom` 12 means individual markers appear as soon as you are looking at a
metro area.

## 5. The hover tooltip (desktop) and its touch equivalent

The requirement is "category plus a note on hover". Hover does not exist on touch, so the
same information takes two forms.

**Desktop — hover tooltip.** On `mousemove` over `poi-markers`:

- A card anchored above the marker, 240 px wide, white, 10 px radius, shadow, 8 px offset
- Hotel name, one line, truncated
- County, muted
- **All** of the hotel's themes as small badges — coloured dot + short label — with the
  primary one first and marked (a filled dot versus an outline dot)
- Unclassified hotels show "No theme classified yet" in muted text instead
- Appears after 120 ms of hover, disappears immediately on leave. The delay stops the tooltip
  strobing while the cursor crosses a dense area
- It never covers the marker it describes; flip below when there is no room above
- Pointer-events none — it must never steal the click

Implement it as an absolutely-positioned React element whose coordinates come from
`map.project(feature.geometry.coordinates)`, updated on `move`. Do not use a MapLibre `Popup`
for hover — it is heavier than needed and harder to style consistently with the cards.

**Touch — tap the marker.** No tooltip at all. Tapping selects the marker, the sheet snaps to
`half`, and the card in the sheet carries exactly the same content as the tooltip, with room
for more. Same information, appropriate container.

Detect the capability, not the screen width: `window.matchMedia('(hover: hover) and (pointer: fine)')`.
A touchscreen laptop should get both behaviours and that is fine.

## 6. The legend

With icon-only markers the legend is not decoration — it is the key to reading the map. It
has to be permanently reachable.

- A circled "ⓘ" button, bottom-right above the locate FAB, 44×44
- Tapping opens a panel: **grouped by family**, each family a heading with its colour, then
  its themes as icon + full label + count in the current filtered set
- Tapping a theme row in the legend toggles that theme filter — the legend doubles as the
  filter UI, which is why it earns the screen space
- Open/closed state persists in `localStorage`
- On desktop above `lg`, it is open by default as a docked panel in the bottom-left corner
- Themes with zero hotels in the current view are dimmed, not hidden — disappearing legend
  rows make the key feel unreliable

## 7. Search as the user moves

Nothing is fetched, so this is purely a question of what the list shows.

The list always reflects the **current viewport**, recomputed synchronously on `moveend`.
There is no "Search this area" button and no "search as I move" toggle — both exist to
manage network latency, and there is no network. Panning updates the list within a frame.

The only nuance: debounce the URL write at 350 ms so the address bar is not thrashed, but
recompute the list immediately on `moveend`. The URL is a record, not an input.

## 8. Map ↔ list synchronization

| User does | Map | Sheet |
|---|---|---|
| Taps a marker | Marker scales up with the ink ring; `easeTo` with `offset: [0, -sheetHeight/3]` so the marker sits above the sheet | Snaps to `half`, scrolls the matching card into view, card gets a highlight ring |
| Hovers a marker (desktop) | Marker scales, tooltip appears | Nothing |
| Taps a card | Matching marker becomes selected; `easeTo` to it | Stays put |
| Hovers a card (desktop) | Matching marker scales up, no tooltip | Card lifts |
| Scrolls the list at `full` | Nothing. Do **not** highlight markers on scroll — nauseating on mobile | — |
| Taps the map background | Deselect | Returns to `peek` |
| Pans the map | Deselect; list recomputes | Returns to `peek`, list scrolls to top |
| Toggles a theme | Markers appear/disappear instantly, no animation on the set | List recomputes, count announces |

The offset `easeTo` matters: without it, tapping a marker near the bottom of the screen hides
it behind the sheet.

## 9. Result cards

- No image — the dataset has none, and a grey placeholder box on every card is worse than no
  box. The card is text-forward and denser as a result, which suits a list of 38 hotels
- Leading 40 px circle repeating the marker: family colour, primary theme icon. This is the
  visual link between card and map, and it does the job an image would have done
- Hotel name, up to two lines
- County, muted, 13 px
- Theme badges: coloured dot + short label, wrapping, max 4 visible then "+2"
- Unclassified hotels show a single muted "No theme classified" badge
- Whole card is the tap target, minimum 72 px tall

## 10. Empty and edge states

| Situation | Copy | Action |
|---|---|---|
| No hotels in viewport, no filters | "No stays in this area" | "Zoom out" — zooms out 2 levels |
| No hotels in viewport, filters on | "No stays here match your themes" | "Clear themes" and "Search all Florida" (fits to the data bbox, keeps filters) |
| No hotels anywhere with these filters | "No stays match these themes" | "Clear themes" |
| Text query matches nothing | "Nothing matches '<q>'" | "Clear search" |
| No WebGL2 | "Your browser can't display the map" | Full-height list, all filters still work |
| Dataset failed to load | "Couldn't load hotel data" | Retry button |

## 11. Gestures

| Gesture | Result |
|---|---|
| One finger drag | Pan |
| Pinch | Zoom, anchored at the centroid |
| Double tap | Zoom in one level, anchored at the tap |
| Two-finger drag (pitch) | **Disabled** — `map.touchPitch.disable()` |
| Rotate | **Disabled** — `map.touchZoomRotate.disableRotation()`. North is always up |
| Long press | Nothing. Reserved |

`dragRotate: false`, `pitchWithRotate: false`, `keyboard: true`.

Tap targets: markers are 32 px drawn, so query with a 6 px box around the tap point
(`queryRenderedFeatures([[x-6,y-6],[x+6,y+6]])`) to reach an effective 44 px. Fingers are
not precise.

## 12. Desktop, briefly

Above `lg` (1024 px) the sheet becomes a fixed 420 px left column scrolling independently,
the map fills the rest, and the legend docks open in the bottom-left. Hover tooltips are
active. Same components, different container — do not build a separate desktop experience.

## 13. What to verify on a real phone

Not in an emulator. On an actual mid-range Android, on cellular:

- Pan across Orlando at zoom 13 with ~42 markers — smooth, no dropped frames
- Drag the sheet peek → full → peek ten times — no jank, no map movement
- Tap a marker near the bottom edge — it ends up visible above the sheet
- Toggle three theme filters rapidly — instant, no flicker, no loading state
- Open the legend, tap a theme row — filter applies and the legend stays open
- Rotate the device — layout survives, map keeps its centre
- With Reduce Motion on — no animation anywhere, everything still works
- One-handed, thumb only — every control reachable in the bottom two-thirds
