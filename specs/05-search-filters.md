# Phase 05 — Search, theme filters and the legend

**Goal:** the discovery loop closes. Users can jump to a place by name, filter by theme, and
read the map through a legend that doubles as the filter UI. This is milestone M2.

**Depends on:** Phase 04.

---

## Files to create

```
components/search/search-bar.tsx
components/search/search-overlay.tsx      # full-screen on mobile
components/search/suggestion-list.tsx
components/search/use-suggestions.ts      # in-memory, no network
components/filters/theme-chip-bar.tsx
components/filters/filter-drawer.tsx
components/filters/theme-grid.tsx
components/filters/active-filter-count.tsx
components/map/map-legend.tsx
lib/url-state.ts                          # extend with themes + q
tests/e2e/filters.spec.ts
```

## Requirements

### Search — all in memory

No geocoder, no autocomplete API. Everything is a substring match over the loaded dataset,
which is both faster and free.

`useSuggestions(q)` returns two groups, computed synchronously:

- **Counties** — the 23 counties whose name matches, each with its hotel count, ordered by
  count descending. Selecting one `fitBounds` to that county's bbox with 40 px padding
- **Hotels** — name matches, capped at 6. Selecting one sets `?hotel=<slug>` and flies to it
  at zoom 15

Match case- and diacritic-insensitively, prefix matches ranked above interior matches. Debounce
is unnecessary — the work is microseconds — but do keep the URL write debounced at 250 ms.

The `q` param also filters the map itself, not just the suggestions: typing "beach" and
dismissing the overlay leaves the map showing only hotels matching "beach". Make that visible
with a dismissible chip in the filter bar showing the active query.

### The search bar and overlay

On mobile, tapping the bar expands to a **full-screen overlay** — a 40 px input with a
dropdown is unusable on a phone. The overlay has a large input, a Cancel button, recent
searches from `localStorage` (max 5), and the suggestion list. Selecting dismisses it.

Above `lg`, the bar stays in place and suggestions drop beneath it.

### Theme chip bar

A horizontally scrollable row under the search bar, over the map, with a fade mask on the
right:

`[⚙ Filters (2)] [◉ Family] [◉ Outdoor] [◉ City] [◉ Romantic] …`

- First chip opens the drawer and shows the active count
- Each theme chip is a `ThemeDot` + short label. Active chips fill with the theme's family
  colour and switch to white text; inactive are outlined
- Order the chips by hotel count in the full dataset, so the most useful come first
- A "Clear all" chip appears at the end when anything is active
- Chips apply **immediately** — this is the fast path

Filters are OR: selecting Family and Romantic shows hotels with either. Say so in the drawer
in one line of helper text — users assume AND, and being wrong about it is confusing.

### Filter drawer

Full-screen from the bottom (Vaul, **modal**, `snapPoints: [1]`). This one *does* trap focus,
unlike the result sheet.

- **Themes**, grouped by family with the family colour as a heading. Each row: icon + full
  label + count in the current dataset. Multi-select
- An "Unclassified" toggle in its own group, so users can hide the 34% of hotels with no
  themes. Default: shown
- Sticky footer: "Clear all" (ghost) and "Show N stays" (primary). **The count updates live**
  as the user toggles, computed from the same selectors — it costs nothing and it tells the
  user the outcome before they commit
- Filters apply on the button. The chips in the bar are the instant path

### The legend

Per `docs/MAP-UX.md` §6, and it is the other half of this phase's value. Icon-only markers
without a legend are a puzzle.

- "ⓘ" button bottom-right, above the locate FAB, 44×44
- Panel grouped by family: family heading with its colour, then each theme as icon + full
  label + count in the current filtered set
- **Tapping a theme row toggles that filter.** The legend is the filter UI on desktop, which
  is what earns it the screen space
- Zero-count themes are dimmed, not hidden
- Open/closed persists in `localStorage`; docked open by default above `lg`

### URL serialization

```
?themes=family-friendly,romantic-getaways
&q=beach
&hotel=<slug>
&bbox=…&z=…
```

Omit params entirely at their default. Parse defensively: an unknown theme slug is dropped,
not an error. Filter and search changes use `router.push` (history entries); the viewport
uses `replaceState`.

### Filter → map coupling

Changing filters must **not** move the map. The viewport stays; only the marker set and the
list change. If the new filters produce zero results in the current viewport but non-zero
elsewhere in Florida, the empty state offers "Search all Florida", which fits to the data
bbox while keeping the filters.

No animation on filter change. Markers appear and disappear immediately — animating an
instant operation makes it feel slow.

### E2E (`tests/e2e/filters.spec.ts`)

- Typing "orange" suggests Orange County; selecting it moves the map and updates the URL
- Typing a hotel name suggests that hotel; selecting it selects the marker
- Toggling a theme chip reduces the marker count and the list count in the same frame
- Two theme chips apply OR, not AND — assert the count is the union, not the intersection
- The drawer's "Show N stays" count matches the count after applying
- Hiding "Unclassified" removes exactly the grey markers
- Tapping a legend row toggles the same filter as the matching chip
- "Clear all" restores the full count and leaves a clean URL
- Filters and query survive a reload

## Acceptance checklist

- [ ] Typing a county name suggests it with a count; selecting fits the map to that county
- [ ] Typing a hotel name suggests it; selecting it selects the marker and flies there
- [ ] The search overlay is comfortable one-handed; Cancel always works
- [ ] Recent searches persist across reloads
- [ ] Theme chips apply instantly with no perceptible delay — measure it, budget is 50 ms
- [ ] Theme filtering is OR and the drawer says so
- [ ] The "Show N stays" count is live and matches reality after applying
- [ ] The "Unclassified" toggle hides exactly the 53 grey markers
- [ ] The legend is reachable in one tap, shows every theme with a count, and its rows filter
- [ ] Legend rows with zero results are dimmed rather than removed
- [ ] Every filter is in the URL and a reload restores all of it
- [ ] Changing a filter never moves the map
- [ ] Zero-result states offer a working way out
- [ ] The E2E test passes
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass
- [ ] Commit: `feat(phase-5): search, theme filters and legend`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/MAP-UX.md (sections 6, 7, 10), docs/DATA-MODEL.md and
specs/05-search-filters.md.

Enter plan mode first and propose the approach, particularly how theme and query state flow
from the URL into the shared selectors so the map, the list, the legend counts and the
drawer's live count all read from one derivation. Wait for approval.

Then implement. Key points:
- Everything is in memory. No geocoder, no autocomplete endpoint, no network in any filter
  or search interaction.
- Theme filtering is OR, not AND. Say so in the drawer's helper text.
- On mobile the search bar expands to a full-screen overlay. A dropdown under a small input
  is not acceptable on a phone.
- The legend is not optional and is not decoration — with icon-only markers it is how the
  map is read. Its rows double as filter toggles.
- The drawer's "Show N stays" count updates live as filters toggle, before applying.
- Changing filters must never move the map, and must never animate the marker set.

Run the acceptance checklist and report each item, including the measured filter latency.
Commit with "feat(phase-5): search, theme filters and legend".
```
