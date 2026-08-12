# DESIGN-SYSTEM.md

Small on purpose. The content is loud; the chrome is silent.

## Base tokens

Defined once in `app/globals.css` as Tailwind v4 `@theme` variables.

```css
@theme {
  --color-ink:        oklch(0.20 0.01 250);   /* primary text, selected ring, clusters */
  --color-ink-muted:  oklch(0.52 0.01 250);   /* secondary text */
  --color-line:       oklch(0.90 0.005 250);  /* borders, dividers */
  --color-surface:    oklch(1    0     0);    /* cards, sheet, tooltip */
  --color-canvas:     oklch(0.98 0.003 250);  /* page background */
  --color-accent:     oklch(0.58 0.19 15);    /* CTAs and active non-theme controls only */
  --color-accent-ink: oklch(1    0     0);

  --radius-pill: 9999px;
  --radius-card: 14px;
  --radius-sheet: 20px;

  --shadow-marker: 0 1px 2px rgb(0 0 0 / 0.20), 0 2px 6px rgb(0 0 0 / 0.14);
  --shadow-card:   0 1px 2px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.08);
  --shadow-sheet:  0 -2px 16px rgb(0 0 0 / 0.10);

  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);
}
```

Accent is used sparingly and **never for a theme**. If a coloured thing on screen is not a
theme, it is accent or ink; if it is a theme, it is one of the four family colours below.
Mixing the two vocabularies is what makes category maps look like confetti.

Dark mode is out of scope for the MVP. Colours are in OKLCH so adding it later is a matter of
swapping lightness values — but note that the theme palette below would need re-validating
against a dark surface, not flipped automatically.

## Theme colour families — validated, do not edit casually

Thirteen themes, four colour families, one neutral. Colour identifies the family; the icon
identifies the theme; the legend and card badges carry the words.

| Family | Label | Hex | Themes |
|---|---|---|---|
| `urban` | Urban & Business | `#2a78d6` | City Escapes · Business Travel · Roadside Motels |
| `family` | Family & Entertainment | `#cc4e1b` | Family-Friendly · Pet-Friendly · Casino & Entertainment · All-Inclusive |
| `outdoors` | Outdoors & Nature | `#0c8459` | Outdoor Adventure · Natural Wonder · National Park |
| `indulgence` | Romance & Indulgence | `#4a3aa7` | Romantic Getaways · Food & Wine · Onsen & Hot Spring |
| `none` | Unclassified | `#75736d` | (no themes in the source data) |

### Why four, and why these four

A map is an **all-pairs** surface: any marker can end up beside any other, so the palette has
to separate under every pairing, not just adjacent legend rows. Run against that standard on
the map surface, these four pass every gate:

```
Lightness band       all 4 inside L 0.43–0.77          PASS
Chroma floor         all 4 >= 0.1                       PASS
CVD separation       worst all-pairs ΔE 8.5 (protan)    PASS  (target ≥ 8)
Normal-vision floor  worst all-pairs ΔE 16.3            PASS  (floor ≥ 15)
Contrast vs surface  all 4 ≥ 3:1                        PASS
```

The tritan worst pair is ΔE 5.7, inside the warn band — which is legal **only** with
secondary encoding. We have three: a distinct icon per theme, the legend, and text badges on
every card. Do not remove any of them, and do not add a fifth family, which would break the
all-pairs guarantee.

Every family colour also carries a white glyph at ≥ 3:1 (blue 4.42, family-orange 4.49, green
4.71, violet 8.56, neutral 4.74), which is why glyphs are white on all five.

Re-run before changing anything:

```bash
node scripts/validate_palette.js "#2a78d6,#cc4e1b,#0c8459,#4a3aa7" \
  --mode light --pairs all --surface "#f2efe9"
```

## Marker specs

| Property | Value |
|---|---|
| Diameter | 32 px (default), 36 px (hover), 40 px (selected) |
| Fill | family colour |
| Glyph | 16 px lucide icon, white, centred |
| Ring | 2 px `--color-surface`; selected is 3 px `--color-ink` |
| Shadow | `--shadow-marker` |
| Hit area | 44 px, via a 6 px query box around the tap point |
| Cluster | ink fill, white 2 px ring, white count label, radius 18/22/28 at 10/25/50 |

Sprites are generated at runtime to an `OffscreenCanvas` at `devicePixelRatio`, so they
inherit the tokens and stay crisp at any DPR. Regenerate on DPR change. Do not ship PNGs.

## Type

Inter (`next/font/google`, `display: 'swap'`, latin subset), also loaded as the MapLibre
glyph set so cluster labels match the UI.

| Role | Size / line | Weight |
|---|---|---|
| Card title | 15 / 20 | 600 |
| Card meta | 13 / 18 | 400 |
| Theme badge | 12 / 16 | 500 |
| Tooltip title | 14 / 18 | 600 |
| Cluster count | 12 / 12 | 700 |
| Section heading | 18 / 24 | 600 |
| Detail page H1 | 24 / 30 | 700 |
| Micro | 11 / 14 | 600 |

Nothing below 11 px. Nothing above 28 px on mobile.

## Spacing and layout

4 px base scale. Screen gutter 16 px. Card gap 12 px.

- Page root: `h-[100dvh] overflow-hidden` — the app never body-scrolls
- Map: `absolute inset-0`
- Search bar: `absolute top-[calc(env(safe-area-inset-top)+12px)] inset-x-4 z-20`
- Theme chips: directly under the search bar, horizontal scroll, fade mask on the right
- Sheet: `fixed inset-x-0 bottom-0 z-30`, padding-bottom `calc(env(safe-area-inset-bottom) + 8px)`
- FABs and legend: `bottom-[calc(var(--sheet-height)+16px)]` — they ride above the sheet
- Minimum tap target 44×44, enforced with padding rather than size

## Component inventory

Build exactly these.

**`ui/`** — `Button`, `Chip`, `Skeleton`, `Badge`, `ThemeBadge`, `ThemeDot`, `EmptyState`,
`LiveRegion`, `Sheet` (Vaul wrapper), `Drawer` (modal), `Tooltip`.

**`map/`** — `MapCanvas`, `useMapInstance`, `useMapViewport`, `MarkerLayer`, `ClusterLayer`,
`MarkerTooltip`, `MapLegend`, `MapControls`, `MapAttribution`, `NoWebGLFallback`,
`marker-images.ts`.

**`sheet/`** — `ResultSheet`, `SheetHeader`, `ResultList`, `ResultCard`, `useSheetSync`.

**`filters/`** — `ThemeChipBar`, `FilterDrawer`, `ThemeGrid`, `ActiveFilterCount`.

**`search/`** — `SearchBar`, `SearchOverlay`, `SuggestionList`.

**`hotel/`** — `HotelHeader`, `ThemeList`, `MiniMap`, `NearbyStays`.

**`data/`** (in `lib/`) — `load.ts`, `selectors.ts`, `useDataset.ts`.

## Motion

| What | Duration | Easing |
|---|---|---|
| Sheet snap | 300 ms | `--ease-sheet` |
| Marker hover scale | 120 ms | ease-out |
| Marker select scale | 160 ms | ease-out |
| Tooltip appear | 120 ms delay, 100 ms fade | ease-out |
| Map `easeTo` on select | 400 ms | MapLibre default |
| Cluster expand | 500 ms | MapLibre default |
| Chip / button press | 100 ms | ease-out |

Wrap all of it in `prefers-reduced-motion: no-preference`. Under reduced motion: sheet snaps
instantly, map uses `jumpTo`, tooltip appears without delay or fade, marker scale changes are
instant.

Filter changes are **not** animated. Markers appearing and disappearing should be immediate —
animating a set change makes an instant operation feel slow.

## Accessibility floor

- Contrast: 4.5:1 for text, 3:1 for UI boundaries and glyphs. Verify markers against pale
  sand, dark water and green parkland on the actual basemap
- Visible focus ring everywhere: `outline: 2px solid var(--color-accent); outline-offset: 2px`
- The map gets `role="application"` and an `aria-label`, and is keyboard-pannable
- "Skip map, go to results" is the first focusable element on `/search`
- Theme identity is never colour-alone: icon + legend + text badge, always
- Filtered-count changes announce through `aria-live="polite"`
- Every icon that carries meaning has an accessible name; decorative ones are `aria-hidden`

## Performance budgets

Acceptance criteria in Phase 07, not aspirations.

| Metric | Budget | Conditions |
|---|---|---|
| LCP | < 2.0 s | Moto G Power class, Fast 3G |
| INP | < 200 ms | Same |
| CLS | < 0.05 | Same |
| JS on `/search` | < 180 KB gzip excluding `maplibre-gl` | No data library, so this is generous |
| Dataset payload | < 30 KB gzip | ~8 KB at 155 rows |
| Map pan | 60 fps sustained | 4× CPU throttle, Orlando at zoom 13 |
| Filter toggle → markers updated | < 50 ms | Measured, not felt. It is synchronous work |
| Time to first marker | < 1.6 s | Fast 3G |

The filter budget is the one that defines this build. There is no network in that path, so
anything perceptible is a bug in the render path, not latency.
