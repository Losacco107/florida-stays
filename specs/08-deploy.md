# Phase 08 — Deploy and operate

**Goal:** live on a real domain, tiles served from your own CDN, errors and analytics
flowing, and a documented way to update the data.

**Depends on:** Phase 07.

---

## Scope

Production infrastructure, observability, and the operational runbook. There is no database
and no server-side work at request time, so this phase is considerably smaller than it would
otherwise be — the whole site is static assets plus one JSON file.

## Files to create

```
.github/workflows/deploy.yml
.github/workflows/data-refresh.yml
docs/RUNBOOK.md
app/robots.ts
app/api/health/route.ts
app/attribution/page.tsx
app/privacy/page.tsx
app/terms/page.tsx
instrumentation.ts                  # Sentry init
lib/analytics.ts                    # typed event helpers
```

## Requirements

### Hosting

Vercel. Production on `main` with a custom domain; a preview deployment per PR. Because the
dataset is a build artefact, previews are automatically self-contained — there is no second
database to keep in sync, which is one of the quieter benefits of this architecture.

Environment variables: `NEXT_PUBLIC_TILES_URL`, `NEXT_PUBLIC_SITE_URL`, `SENTRY_DSN`.
That is the complete list.

### Tiles in production

Cloudflare R2 bucket, public via a custom domain (`tiles.<yourdomain>`), fronted by the
Cloudflare CDN. Verify:

- Range requests work: `curl -r 0-1023 -I https://tiles.<domain>/florida-2026-08.pmtiles`
  returns `206`
- `CF-Cache-Status: HIT` on a repeat request
- CORS allows the production origin, and
  `Access-Control-Expose-Headers: ETag, Content-Range` is set
- `Cache-Control: public, max-age=604800, immutable`, with the date in the filename so a new
  extract is a new URL

### The dataset asset

`public/data/pois.v1.json` is emitted by `prebuild`, so a deploy can never ship a stale or
missing dataset. Confirm in production:

- It is served from the CDN edge with `Cache-Control: public, max-age=31536000, immutable`
- Gzip or Brotli is applied — check `content-encoding`, and that the transferred size is
  under 30 KB
- The build fails if the quality gates in `docs/DATA-MODEL.md` §8 do not pass. Prove this by
  pushing a branch with one row's `lat` blanked and watching CI reject it

### Monitoring

- **Sentry** via `instrumentation.ts`, `tracesSampleRate: 0.1`, source maps uploaded. Filter
  the noise: browser-extension errors, `ResizeObserver loop` warnings, and WebGL context-loss
  events on low-end devices (log those separately, they are informative but not actionable).
- **Vercel Analytics + Speed Insights** for real-user Core Web Vitals. Field data is the
  number that matters; lab Lighthouse is a proxy.
- **Custom events** (no PII): `map_moved`, `theme_filter_applied`, `marker_selected`,
  `card_selected`, `search_performed`, `legend_opened`, `hotel_page_viewed`,
  `county_page_viewed`. `theme_filter_applied` is the important one — it tells you whether the
  theme system, which the entire product is built around, is something people actually use.
  Record which themes, not just that a filter happened.
- **Uptime check** every 5 minutes against `/api/health`, which returns 200 plus the dataset
  version and `generatedAt`. With no database there is nothing else to health-check, so make
  it verify that the dataset asset is reachable and parses.

### Data refresh

`data-refresh.yml`, monthly and manually dispatchable:

1. Re-run `pnpm data:ingest` against a workbook committed under `data/source/`
2. Diff `data/fl-pois.csv`
3. If rows changed, run `pnpm data:geocode` for new rows only
4. Open a PR with the diff summarised in the body: rows added, removed, themes changed, and
   how many new rows need manual geocoding review

**Never auto-merge.** New rows arrive without coordinates, and merging them would trip the
build gate — which is the gate working correctly. The PR is the prompt for a human to do the
review pass.

### SEO go-live

- `app/robots.ts` allowing everything except `/api/`
- Submit `sitemap.xml` to Google Search Console and Bing Webmaster Tools
- Verify the domain; run Rich Results on a sample of hotel and county pages
- Set `NEXT_PUBLIC_SITE_URL` so canonicals are absolute and correct

### Legal

- "© OpenStreetMap contributors" and "Protomaps" visible on the map (Phase 02). This covers
  both the basemap and the Nominatim geocoding, which uses the same data
- `/attribution` listing OpenStreetMap (ODbL), Protomaps, Nominatim, and lucide (ISC) with
  their licences
- `/privacy` covering analytics and the geolocation permission
- `/terms`, stating plainly that the hotel list is curated for discovery, that theme
  classifications are editorial, and that the site does not sell or broker stays
- A consent banner only if you add analytics that require one. Vercel Analytics is cookieless,
  so with this stack you probably do not need one — confirm for your jurisdiction

### Runbook

`docs/RUNBOOK.md`, written for the version of you that has forgotten everything in six months:

- Architecture diagram and where each piece is hosted
- Running locally from a clean checkout
- **How to add or change a hotel** — the most common operation. Edit `data/fl-pois.csv`,
  run `pnpm data:build`, commit, deploy. Include the geocoding step for new rows
- How to add a new theme to the catalog, including the palette constraint: a new theme joins
  an existing colour family, it does not get a new colour
- How to rebuild and deploy new tiles
- How to roll back (Vercel instant rollback)
- Troubleshooting: the map is blank; tiles return 403; the dataset 404s or fails validation;
  markers render but the basemap does not; the build fails a data quality gate
- Every environment variable and where its value comes from

## Acceptance checklist

- [ ] Production URL loads the map with all markers on a real phone over cellular in under 3 s
- [ ] Tiles serve from your R2 domain with `CF-Cache-Status: HIT` and working range requests
- [ ] `pois.v1.json` is CDN-cached, compressed, and under 30 KB transferred
- [ ] A PR produces a working preview with its own build of the dataset
- [ ] The build rejects a deliberately broken data row (prove it)
- [ ] Sentry captures a test error with readable source maps
- [ ] Speed Insights shows real-user data within 24 h, mobile LCP under 2.5 s at p75
- [ ] All eight custom events fire, and `theme_filter_applied` records which themes
- [ ] `/api/health` returns 200 with the dataset version and `generatedAt`
- [ ] `robots.txt` and `sitemap.xml` are correct and submitted
- [ ] Attribution, privacy and terms pages exist and are linked in the footer
- [ ] The data refresh workflow runs and opens a PR with a useful diff summary
- [ ] `docs/RUNBOOK.md` is complete enough that someone else could operate the site from it
- [ ] Instant rollback tested once
- [ ] Commit: `chore(phase-8): production deploy, monitoring and runbook`

---

## Prompt for Claude Code

```
Read CLAUDE.md, docs/ARCHITECTURE.md and specs/08-deploy.md.

Implement Phase 08 — production deployment and operations.

Some steps require me to click things in Vercel and Cloudflare. For each of those, give me an
exact numbered checklist of what to do and which values to paste, then continue with the
parts you can do in code. Do not guess at credentials or invent project IDs.

Build in code: the deploy and data-refresh workflows, instrumentation.ts with Sentry and its
noise filters, the analytics event helpers and their call sites, /api/health, app/robots.ts,
the attribution/privacy/terms pages, and docs/RUNBOOK.md.

Two things specific to this project:
- There is no database, so there is nothing to migrate and no second environment to keep in
  sync. Do not add either.
- The build must fail if the dataset quality gates fail. Prove it works by pushing a branch
  with one row's lat blanked and showing CI reject it.

The runbook is a real deliverable, not a stub. Its most important section is "how to add or
change a hotel", because that is what will actually be done repeatedly.

Then give me the ordered go-live checklist. Commit with
"chore(phase-8): production deploy, monitoring and runbook".
```
