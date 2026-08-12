# Florida Stays — Claude Code Spec Bundle

A phase-by-phase build plan for a **mobile-first hotel discovery website**: a curated list of
Florida hotels on an Airbnb-style interactive map, where each marker is colour-coded and
icon-coded by the hotel's top-selling theme.

Everything in the product — UI copy, code, comments, data columns — is in **English**.

---

## What is in this bundle

| File | Purpose |
|---|---|
| `CLAUDE.md` | Drop at the repo root. Claude Code reads it every session: conventions, guardrails, commands. |
| `PLAN.md` | The master plan. What the data is, why this architecture, the 9 phases, risks. |
| `docs/ARCHITECTURE.md` | System shape, why there is no database, the derived-state pipeline, failure modes. |
| `docs/DATA-MODEL.md` | The spreadsheet, the theme catalog, geocoding, the generated dataset, quality gates. |
| `docs/MAP-UX.md` | The interaction spec — markers, clustering, tooltip, legend, sheet. Read before any map code. |
| `docs/DESIGN-SYSTEM.md` | Tokens, the validated theme palette, marker specs, budgets. |
| `specs/00`–`08` | One file per phase, each ending with a **copy-paste prompt for Claude Code**. |
| `data/themes.json` | The 13-theme catalog with families, icons and colours. Ready to commit. |
| `data/fl-pois.csv` | **155 Florida hotels already parsed** from the P0 tab — themes split, primary theme derived, slugs generated. Coordinates are blank, which Phase 01 fills. |
| `build_dataset.py` | The script that produced those two files, for reference and re-running. |

---

## How to use it

```bash
mkdir florida-stays && cd florida-stays
git init
cp -r /path/to/florida-stays-plan/{CLAUDE.md,PLAN.md,docs,specs,data} .
git add -A && git commit -m "docs: add build plan and source data"
claude
```

Then, **one phase per session**:

```
Read CLAUDE.md, PLAN.md and specs/03-markers-clustering.md.
Implement Phase 3 exactly as specified. Do not start Phase 4.
When done, run the acceptance checklist at the bottom of the spec and report results.
```

### Rules that make this work

1. **One phase per session.** `/clear` between phases. Context stays clean, output stays focused.
2. **Commit at the end of every phase.** If a phase goes wrong you revert one commit.
3. **Run the acceptance checklist before moving on.** A phase is not done until it passes.
4. **Use plan mode for phases 3 and 5.** `Shift+Tab` twice — let Claude propose before it writes.
5. **Keep `CLAUDE.md` alive.** Correct Claude on something twice, add the rule so there is no third time.

### Suggested pacing

| Sessions | Phases | You get |
|---|---|---|
| 1 | 00 | Repo + mobile shell |
| 2–3 | 01 | Geocoded, validated dataset (includes ~1h of manual review — the important hour) |
| 4–5 | 02, 03 | A themed map of Florida on your phone |
| 6–8 | 04, 05 | Sheet, cards, filters, legend, search |
| 9–10 | 06, 07 | Detail pages, performance and accessibility |
| 11 | 08 | Live on a real URL |

---

## The three decisions that shape this build

**No prices.** The source data has none. Nothing in the product shows, filters or sorts by
price, and synthetic rates are explicitly forbidden — nothing destroys trust in a travel site
faster than a number that turns out to be invented.

**No database.** ~155 hotels, ~8 KB gzipped, changing at most monthly. The spreadsheet becomes
a JSON file at build time, the browser fetches it once, and every filter and pan after that
is synchronous in-memory work. `docs/ARCHITECTURE.md` documents when to revisit this.

**The theme is the product.** It is the only differentiating attribute in the data, so the
marker, the tooltip, the card, the filter and the legend are all built around it. Colour
encodes one of four validated families; the icon encodes which of the 13 themes; the legend
carries the words. Icon-only markers are meaningless without a legend, which is why the legend
is a required component rather than a nice-to-have.

---

## Known gaps before you start

- **The P1 tab is not in this bundle.** `data/fl-pois.csv` was built from the P0 tab only
  (155 Florida rows of 834 total). Phase 01's ingest script reads both tabs — drop the full
  workbook into `data/source/` and re-run it.
- **No coordinates yet.** The single largest task in Phase 01, and the one that most affects
  whether the result feels real.
- **34% of Florida hotels have no theme.** They render as neutral grey markers with an honest
  label. Classifying them upstream is the cheapest quality improvement available.

## Prerequisites

- Node.js 22 LTS or newer, `pnpm`
- A [Cloudflare](https://cloudflare.com) account (free) — R2 bucket for map tiles
- A [Vercel](https://vercel.com) account (free) — hosting
- Claude Code installed and authenticated

No paid API keys, and no database, are required at any point.
