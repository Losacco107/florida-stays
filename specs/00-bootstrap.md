# Phase 00 — Bootstrap

**Goal:** a running Next.js repo with the toolchain, the mobile app shell, and CI — no map,
no data yet. This phase exists so that every later phase starts from a green build.

**Depends on:** nothing.

---

## Scope

Create the project skeleton, configure the toolchain, and build the static mobile shell of
`/search`: a full-viewport grey placeholder where the map will go, a floating search bar, and
a non-functional bottom sheet at the peek position. It should already *feel* like the app on
a phone.

## Files to create

```
package.json  pnpm-workspace.yaml  tsconfig.json  next.config.ts
eslint.config.mjs  .prettierrc  vitest.config.ts  playwright.config.ts
.env.example  .gitignore
.github/workflows/ci.yml
app/layout.tsx  app/globals.css  app/page.tsx
app/search/page.tsx  app/search/search-client.tsx
components/ui/{button,chip,skeleton,badge}.tsx
lib/utils.ts
docs/  specs/   (already present)
```

## Requirements

**Toolchain**

- `pnpm create next-app` with TypeScript, App Router, Tailwind v4, no `src/` dir, `@/*` alias.
- `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`,
  `"noUnusedLocals": true`.
- ESLint flat config extending `next/core-web-vitals` + `next/typescript`. Zero warnings
  allowed — add `--max-warnings=0` to the lint script.
- Prettier with `prettier-plugin-tailwindcss`.
- Vitest configured for `jsdom` + `@testing-library/react`. One smoke test.
- Playwright configured with an **iPhone 15 device profile as the default project**, plus a
  `Pixel 7` project. Desktop Chrome is a third, secondary project. Mobile is the default
  target for tests, not an afterthought.

**Viewport and metadata** in `app/layout.tsx`:

```ts
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 5,
  viewportFit: 'cover',            // required for env(safe-area-inset-*)
  themeColor: '#ffffff',
}
```

Do not set `maximumScale: 1` or `userScalable: false` — that breaks pinch-zoom accessibility.

**Design tokens.** Put the full `@theme` block from `docs/DESIGN-SYSTEM.md` into
`app/globals.css`. Add a global rule: `html, body { height: 100%; overscroll-behavior: none; }`
and `body { overflow: hidden; }` — the app never body-scrolls.

**Fonts.** Inter via `next/font/google`, `display: 'swap'`, variable font, exposed as
`--font-sans`.

**The shell** (`app/search/page.tsx` is a Server Component that renders `search-client.tsx`):

- Root `<main className="relative h-[100dvh] overflow-hidden bg-canvas">`
- `<div id="map-placeholder" className="absolute inset-0 bg-neutral-200">` with centered
  muted text "Map"
- A theme chip row placeholder under the search bar: three static outlined chips,
  horizontally scrollable with a right fade mask. Not functional yet
- Floating search bar: rounded-full white pill, shadow, search icon, "Where to?" placeholder,
  a filter icon button on the right. Positioned with the safe-area formula from the design
  system. Not functional yet.
- A static bottom sheet at 12% height: white, `--radius-sheet` top corners, `--shadow-sheet`,
  a 36×4px grey handle centered 8px from the top, and the text "0 stays in view". Not draggable yet.
- A locate FAB and a legend "ⓘ" button, stacked bottom-right, 44×44 each, above the sheet.

**UI primitives.** `Button`, `Chip`, `Skeleton`, `Badge` — styled with `cva`
(`class-variance-authority`) + `cn()` helper in `lib/utils.ts` (clsx + tailwind-merge). Keep
them dumb: props in, classes out, no state.

**CI** (`.github/workflows/ci.yml`): on push and PR — install with pnpm, cache the store, run
`lint`, `typecheck`, `test`, `build`. Fail on any error.

**`.env.example`:**

```
NEXT_PUBLIC_TILES_URL=     # https://tiles.<domain>/florida-YYYY-MM.pmtiles
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SENTRY_DSN=                # optional until Phase 08
```

There is no database, so there is no connection string. If you find yourself adding one,
re-read `docs/ARCHITECTURE.md` § "Why no database".

**Suspense boundary.** `app/search/page.tsx` renders the client island. From Phase 02 that
island calls `useSearchParams`, and Next fails the production build if that is not inside a
`<Suspense>` boundary. Add the boundary now, with the skeleton shell as its fallback, so a
later phase does not hit a confusing build error. Also note that in Next 16 `params` and
`searchParams` in Server Components are Promises and must be awaited.

## Out of scope

MapLibre, any database, any real data, drag behaviour, filters. Resist all of it.

## Acceptance checklist

- [ ] `pnpm install && pnpm dev` serves `/search` with no console errors or warnings
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass clean
- [ ] In Chrome DevTools iPhone 15 emulation, the shell fills the screen exactly — no
      scrollbars, no rubber-banding, nothing cut off by the notch or home indicator
- [ ] The sheet and the FAB sit above the home indicator (verify by adding a temporary
      coloured background to the safe-area padding)
- [ ] Rotating to landscape does not break the layout
- [ ] Lighthouse mobile performance ≥ 95 on `/search` (it is a static shell — it should be)
- [ ] CI is green on the first push
- [ ] `git log` shows one commit: `chore(phase-0): bootstrap project shell`

---

## Prompt for Claude Code

```
Read CLAUDE.md, PLAN.md, docs/DESIGN-SYSTEM.md and specs/00-bootstrap.md.

Implement Phase 00 exactly as specified — project bootstrap and the static mobile shell.
Do not add MapLibre, any database, or any interactivity beyond what the spec lists.

Work in this order:
1. Scaffold the Next.js project and configure the full toolchain (TS strict, ESLint flat
   config with zero warnings, Prettier, Vitest, Playwright with iPhone 15 as the default
   project).
2. Set up globals.css with the exact @theme token block from docs/DESIGN-SYSTEM.md, the
   Inter font, and the no-body-scroll rules.
3. Build the four UI primitives with cva + cn().
4. Build the /search shell: map placeholder, floating search bar, static peek-height sheet,
   locate FAB — all with correct safe-area handling and 100dvh.
5. Add the CI workflow and .env.example.

Then run the acceptance checklist at the bottom of the spec and report each item as pass or
fail. Fix anything that fails before reporting done. Finally, commit with
"chore(phase-0): bootstrap project shell".
```
