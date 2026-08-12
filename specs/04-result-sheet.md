# Phase 04 — The result sheet

**Goal:** a draggable bottom sheet at three snap points holding the result list, synchronized
with the map in both directions. On touch, the card is the replacement for the desktop hover
tooltip, so this phase is what makes the mobile experience complete.

**Depends on:** Phase 03.

---

## Files to create

```
components/sheet/result-sheet.tsx      # Vaul wrapper, snap points, height → CSS var
components/sheet/sheet-header.tsx      # handle + "N stays in view"
components/sheet/result-list.tsx
components/sheet/result-card.tsx
components/sheet/use-sheet-sync.ts
components/ui/theme-badge.tsx
components/ui/theme-dot.tsx
components/ui/empty-state.tsx
tests/e2e/sheet.spec.ts
```

## Requirements

### The sheet

`vaul` in **non-modal** mode (`modal={false}`) so the map stays interactive behind it. Snap
points `[0.12, 0.55, 0.92]`, controlled — the active snap is React state, transient by
design, and should not survive a reload.

Publish the current height as a CSS custom property:

```ts
document.documentElement.style.setProperty('--sheet-height', `${px}px`)
```

updated on every drag frame via `requestAnimationFrame`. The FABs, the legend and the
selection `easeTo` offset all read it. **Do not put this in React state** — it changes at
60 Hz during a drag and would re-render the tree every frame.

### Drag physics

Exactly `docs/MAP-UX.md` §2. The three rules that get missed:

- The inner list scrolls **only** at `full`
- At `full`, a downward drag moves the sheet only when `scrollTop === 0`
- Dragging the sheet must never pan the map, and panning the map must never move the sheet

Write this logic explicitly rather than relying on Vaul defaults, and cover it in the E2E
test — it is the difference between "feels native" and "feels broken".

### Header

The 36×4 px handle, then a live count: "38 stays in view". When theme filters are active,
append the qualifier: "38 stays in view · 3 themes". The whole header is a drag surface.

No sort control. With no price and no rating there is nothing meaningful to sort by, and a
sort menu offering only "name A–Z" is worse than no menu. Default order is by distance from
the viewport centre, which makes the top of the list correspond to the middle of the screen.

### The list

The list renders `inViewport[]` from `lib/data/selectors` — synchronous, already filtered by
theme and query. There is no fetching, no pagination and no infinite scroll: the largest
possible list is the whole Florida dataset, and even that is a few hundred rows.

Cap the rendered list at 150 items with a "Zoom in to narrow your search" footer past that.
No virtualization library — at these sizes it would add more code than it saves.

### Result cards

Per `docs/MAP-UX.md` §9. There are no images in the dataset, so the card is text-forward with
a leading 40 px theme circle repeating the marker — that circle is the visual link between
list and map and does the job an image would have done. A grey placeholder box on every card
would be worse than nothing.

Contents: theme circle, name (up to two lines), county in muted 13 px, theme badges (coloured
dot + short label, wrapping, max 4 then "+N"). Unclassified hotels get a single muted "No
theme classified" badge. Whole card is the tap target, minimum 72 px tall.

`ThemeBadge` and `ThemeDot` are shared with the hover tooltip from Phase 03 — build them here
properly and refactor the tooltip to use them.

### Bidirectional sync (`use-sheet-sync.ts`)

| Trigger | Effect |
|---|---|
| Marker selected (`?hotel`) | Sheet snaps to `half`; card scrolls into view with `block: 'center'`; card gets a 2 px ink ring |
| Card tapped | `router.push` with `?hotel`; map `easeTo` with the sheet-height offset; sheet stays put |
| Card hovered (desktop) | Matching marker scales up. No tooltip — the card is already showing the information |
| Map panned | Clear selection; sheet returns to `peek`; list recomputes and scrolls to top |
| Map background tapped | Clear selection; sheet to `peek` |
| List scrolled | Nothing on the map. Explicitly do not highlight markers on scroll |
| Theme filter changed | List recomputes instantly; count announces; sheet keeps its snap |

When the selected hotel is outside the current viewport — possible via a deep link or a
back-navigation — pin it to the top of the list with a "Selected" label rather than showing
an empty list. It is already in memory; there is nothing to fetch.

### States

Skeletons only during the single initial dataset load. After that, filtering is synchronous
and a skeleton would be a lie. Empty states per `docs/MAP-UX.md` §10, with working actions.

### Accessibility

The sheet is **non-modal**, so it does not trap focus and does not render an inert overlay —
that is the deliberate trade for keeping the map interactive. Do not try to have both; a
non-modal Radix/Vaul dialog cannot trap focus by design.

- `role="region"` with `aria-label="Search results"`, not `role="dialog"`
- Escape returns the sheet to `peek` — a plain key handler
- "Skip map, go to results" is the first focusable element on the page
- Tab order: search bar → theme chips → skip-link target → sheet → cards → map
- Count changes announce via a polite live region
- The list is a `<ul>` of `<li>`; each card names its themes in text, never colour alone

### E2E (`tests/e2e/sheet.spec.ts`, iPhone 15)

- Drag peek → full: sheet reaches ~92% and the list scrolls
- Drag full → peek with the list at top: sheet collapses
- With the list scrolled down, a downward drag scrolls the list, not the sheet
- Tap a card → `?hotel=` appears and the map centre changes
- Tap a marker → sheet is at `half` and the matching card is in view
- Pan the map → sheet returns to `peek` and the count changes

## Acceptance checklist

- [ ] The sheet drags at 60 fps on a real phone; all three snaps reachable
- [ ] Flicking commits to the right snap; slow short drags spring back
- [ ] Dragging the sheet never moves the map; panning never moves the sheet
- [ ] The inner list scrolls only at `full`, and the scrolled-to-top rule works
- [ ] FABs and the legend button track the sheet without lag or jitter
- [ ] Tapping a marker near the bottom edge leaves it visible above the sheet
- [ ] The card shows every theme the hotel has, matching the desktop tooltip exactly
- [ ] Panning updates the count within one frame — no spinner ever appears
- [ ] Empty states render with working actions
- [ ] Escape at `full` returns to `peek`; the skip link reaches the list in one tab
- [ ] With VoiceOver or TalkBack, the count is announced and every card is reachable
- [ ] The E2E test passes
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass
- [ ] Commit: `feat(phase-4): result sheet with map sync`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/MAP-UX.md (sections 2, 8, 9, 10), docs/DESIGN-SYSTEM.md and
specs/04-result-sheet.md.

Implement Phase 04 — the bottom sheet.

The three things most likely to go wrong, so handle them deliberately:
1. Gesture conflict. Dragging the sheet must never pan the map; the inner list scrolls only
   at the full snap; and at full, a downward drag only moves the sheet when the list is
   already at scrollTop 0. Write this explicitly, do not rely on Vaul defaults.
2. The --sheet-height CSS variable is updated imperatively via rAF during the drag, NOT
   through React state. Re-rendering at 60Hz during a drag will make it stutter.
3. The selection easeTo offset must account for sheet height so a marker near the bottom
   edge ends up visible above the half-height sheet.

The list comes from the in-memory selectors — there is no fetching, no pagination and no
loading state after the initial dataset load. If you find yourself adding a spinner to a
filter interaction, something is wrong.

Cards have no images because the dataset has none. Use the leading theme circle instead; do
not add grey placeholder boxes.

Build ThemeBadge and ThemeDot here and refactor the Phase 03 tooltip to use them, so the
tooltip and the card cannot drift apart.

Run the acceptance checklist and report each item, including the real-device gesture checks.
Commit with "feat(phase-4): result sheet with map sync".
```
