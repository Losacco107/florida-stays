# Phase 07 — Performance and accessibility pass

**Goal:** meet every budget in `docs/DESIGN-SYSTEM.md`, close the accessibility gaps, and put
guardrails in CI so nothing regresses.

**Depends on:** Phases 03–06.

---

## Scope

No new features. Measure, fix, and lock in. Treat this as a phase with a real deliverable —
a report of before/after numbers — not as a cleanup afterthought.

## Files to create / change

```
lighthouserc.json
.github/workflows/ci.yml            # add Lighthouse CI + bundle size gate
tests/e2e/a11y.spec.ts              # axe-core
tests/perf/map-pan.spec.ts          # frame timing during a scripted pan
next.config.ts                      # bundle analyzer, image config
app/search/loading.tsx
components/error-boundary.tsx
docs/PERF-REPORT.md                 # the deliverable of this phase
```

## Performance work

**Measure first.** Record baseline numbers for every budget before changing anything, and put
both columns in `docs/PERF-REPORT.md`. Optimizing without a baseline is guessing.

**Bundle.**

- Run `@next/bundle-analyzer`. `maplibre-gl` is ~250 KB gzip and is the floor; everything else
  on `/search` must fit in 180 KB gzip. There is no data-fetching library, so this is roomy.
- Confirm MapLibre is in its own chunk, loaded only by the dynamic `MapCanvas`, and never
  pulled into the detail-page bundle.
- Tree-shake icons — import individual `lucide-react` icons, never the barrel.
- Check for accidental client components: anything with `'use client'` that has no
  interactivity should lose the directive.
- `modularizeImports` or `optimizePackageImports` in `next.config.ts` for `lucide-react` and
  `date-fns` if present.

**Loading sequence on `/search`.** Target: first marker visible in under 1.6 s on Fast 3G.

- `preconnect` to the tiles domain in `layout.tsx`
- `<link rel="preload" href="/data/pois.v1.json" as="fetch" crossorigin>` in `layout.tsx`, so
  the dataset request starts during HTML parse rather than after hydration
- Confirm the dataset is served with `Cache-Control: public, max-age=31536000, immutable` and
  that a repeat visit does not re-download it
- `app/search/loading.tsx` renders the shell with skeletons, not a spinner
- Font: `display: swap`, preloaded, subset to latin

**Images.** There are none in the dataset, which removes an entire category of work. The only
raster asset is the dynamic OG image, which is generated at build time. Confirm no
`next/image` usage crept in for decorative purposes.

**Map runtime.**

- Verify 60 fps panning Orlando at zoom 13 at 4× CPU throttle. If it misses, in order: reduce
  `fadeDuration`, lower `clusterMaxZoom` so fewer individual markers render, simplify the
  marker sprite (drop the shadow first), reduce sprite `pixelRatio` on low-DPR devices
- **Measure the filter path separately.** Toggling a theme must go from tap to updated
  markers in under 50 ms. It is synchronous work, so anything slower is a render-path bug:
  check that selectors are memoized, that `setData` is called once rather than per marker,
  and that the sheet list is not re-rendering every card on an unrelated state change
- Confirm no layer or source is re-created on data updates — `setData` only
- Confirm `queryRenderedFeatures` is not called on `mousemove`/`touchmove`, only on tap

**Server.** There is no server-side work at request time — every page is prerendered and the
dataset is a static asset. Verify that in production: every route should return
`x-vercel-cache: HIT` on a second request, and `/data/pois.v1.json` should be served from the
CDN edge.

## Accessibility work

Run `axe-core` via `@axe-core/playwright` on `/search` (at each sheet snap), a hotel page,
the filter drawer, and the open legend. Zero violations at serious or critical severity.

Then the things axe cannot catch:

- **Keyboard path.** Tab through `/search` with no mouse: skip link → search bar → theme
  chips → sheet → cards → legend → map. The map is focusable and pannable with arrow keys, zoomable with `+`/`-`. A
  visible focus ring everywhere. No focus trap outside the modal drawer.
- **Screen reader path.** With VoiceOver (iOS) and TalkBack (Android): the result count is
  announced when it changes; each card announces the hotel name, county and its themes as
  text; the map announces itself as a supplementary view and is skippable with the "Skip map,
  go to results" link; selecting a marker announces the selected hotel.
- **Reduced motion.** With the OS setting on: no sheet animation, no map `flyTo` (use
  `jumpTo`), no shimmer, no fades. Verify every single one.
- **Contrast.** Check every marker colour against pale sand, dark water and green parkland on
  the real basemap, and check the white glyph inside each. Check muted text at 13 px.
- **Colour is never alone.** Verify with a deuteranopia and a tritanopia simulator that the
  map remains usable: the icons and the legend must carry it, not the hues.
- **Zoom / large text.** At 200% browser zoom and at the largest iOS Dynamic Type setting,
  nothing clips or overlaps. This is where fixed pixel heights bite.
- **Touch targets.** Audit every interactive element for 44×44 minimum, including the map
  FABs, the legend button, the theme chips and every legend row.

## Resilience

- A React error boundary around the map that falls back to the list view rather than a white
  screen
- The dataset fetch retries twice with backoff before showing the error state. It is the only
  network dependency the app has, so it is the only thing that can hard-fail
- An offline banner via `navigator.onLine` + the `online`/`offline` events
- Confirm every failure mode in the `docs/ARCHITECTURE.md` table behaves as documented — go
  through them one by one and force each

## CI guardrails

Add to `.github/workflows/ci.yml`:

- **Lighthouse CI** on `/search` and one hotel page, mobile preset, asserting
  performance ≥ 90, a11y ≥ 95, SEO ≥ 95. Fail the build below.
  The CI floor is 90 while the per-phase local targets in Phases 00 and 06 are 95 — that gap
  is deliberate. Lighthouse on shared CI runners is noisy by several points, and a gate that
  flags normal variance gets disabled within a week. Local runs are the real target; CI is
  the regression alarm. Run Lighthouse 3 times and assert on the median.
- **Bundle size gate.** Fail if the `/search` first-load JS exceeds 460 KB gzip total.
- **Dataset size gate.** Fail if `public/data/pois.v1.json` exceeds 30 KB gzipped — it is the
  one payload that grows silently as rows are added.
- **axe** as part of the Playwright run.

## Acceptance checklist

- [ ] `docs/PERF-REPORT.md` exists with before/after numbers for every budget in the design
      system
- [ ] LCP < 2.0 s, INP < 200 ms, CLS < 0.05 on the mobile Lighthouse run
- [ ] `/search` JS under 180 KB gzip excluding `maplibre-gl`
- [ ] First marker visible under 1.6 s on Fast 3G
- [ ] Theme filter toggle updates the map in under 50 ms, measured
- [ ] Sustained 60 fps panning Orlando at zoom 13 with 4× CPU throttle — trace attached to
      the report
- [ ] Zero serious/critical axe violations on all four surfaces
- [ ] The map is usable under deuteranopia and tritanopia simulation
- [ ] Full keyboard path works with visible focus throughout
- [ ] Verified with a real screen reader on a real phone
- [ ] Reduced motion removes every animation
- [ ] 200% zoom and largest Dynamic Type both survive
- [ ] Every documented failure mode behaves correctly when forced
- [ ] CI fails when a budget is breached (prove it by temporarily breaching one)
- [ ] Commit: `perf(phase-7): meet performance and accessibility budgets`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/DESIGN-SYSTEM.md (performance budgets and accessibility floor),
docs/ARCHITECTURE.md (failure modes) and specs/07-performance-a11y.md.

Implement Phase 07 — performance and accessibility. No new features.

Start by measuring the baseline for every budget and writing it into docs/PERF-REPORT.md.
Then fix, then re-measure and fill in the after column. I want real numbers in that report,
not estimates.

Work through the spec's four areas in order: bundle and loading, map runtime, accessibility,
resilience. Then add the CI guardrails and prove they work by temporarily breaching one
budget and showing the build fail.

For the accessibility work, run axe on /search at each of the three sheet snap points, on a
hotel page, with the filter drawer open, and with the legend open. Then do the manual
keyboard and reduced-motion passes, plus the colour-vision simulation of the map — axe will
not catch any of those, and the colour-vision check is the one that matters most here because
the whole map is colour-coded.

Report the final numbers against each budget. Commit with
"perf(phase-7): meet performance and accessibility budgets".
```
