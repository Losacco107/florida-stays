/**
 * scripts/ingest.ts — source workbook (tabs P0 + P1) → data/fl-pois.csv
 *
 * Usage: pnpm data:ingest <path-to-workbook.xlsx>
 *
 * data/themes.json and data/fl-pois.csv ship with the plan already built from the P0 tab.
 * This script re-derives fl-pois.csv from the real workbook when one is available, folding in
 * P1 and preserving any geocoding already done. It is idempotent: re-running with the same
 * source produces a byte-identical CSV when no rows changed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parse as parseCsvSync } from 'papaparse';
import * as XLSX from 'xlsx';

const THEME_KEY = 'Does the POI fulfill the key top-selling themes?';
const NA = new Set(['#N/A', 'N/A', '', 'NA', '#n/a']);
const CSV_PATH = 'data/fl-pois.csv';
const THEMES_PATH = 'data/themes.json';

interface ThemeCatalogFile {
  themes: Array<{ slug: string; label: string; family: string }>;
  generic: { slug: string; family: string };
}

interface FlRow {
  poi_id: string;
  slug: string;
  name: string;
  state: 'FL';
  county: string;
  themes: string;
  theme_count: number;
  primary_theme: string;
  theme_family: string;
  lat: string;
  lng: string;
  geocode_confidence: string;
  geocode_source: string;
  geocode_query: string;
}

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

function loadExisting(): Map<string, FlRow> {
  const byId = new Map<string, FlRow>();
  if (!existsSync(CSV_PATH)) return byId;
  const text = readFileSync(CSV_PATH, 'utf-8');
  const { data } = parseCsvSync<FlRow>(text, { header: true, skipEmptyLines: true });
  for (const row of data) byId.set(row.poi_id, row);
  return byId;
}

function readWorkbookRows(workbookPath: string): Record<string, string>[] {
  const wb = XLSX.readFile(workbookPath);
  const rows: Record<string, string>[] = [];
  for (const tab of ['P0', 'P1']) {
    const sheet = wb.Sheets[tab];
    if (!sheet) {
      console.warn(`tab "${tab}" not found in workbook, skipping`);
      continue;
    }
    // raw: false → formatted text, so the 17-digit POI ID never round-trips through a float
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      raw: false,
      defval: '',
    });
    for (const r of sheetRows) rows.push({ ...r, __tab: tab });
  }
  return rows;
}

function main() {
  const workbookPath = process.argv[2];
  if (!workbookPath) {
    console.error('Usage: pnpm data:ingest <path-to-workbook.xlsx>');
    process.exit(1);
  }

  const catalog: ThemeCatalogFile = JSON.parse(readFileSync(THEMES_PATH, 'utf-8'));
  const byLabel = new Map(catalog.themes.map((t) => [t.label, t.slug]));
  const familyOf = new Map(catalog.themes.map((t) => [t.slug, t.family]));

  const sourceRows = readWorkbookRows(workbookPath);
  const flRows = sourceRows.filter((r) => (r.State ?? '').trim() === 'Florida');
  const existing = loadExisting();

  const seenPoi = new Set<string>();
  const seenSlug = new Map<string, string>();
  const dropped: Record<string, number> = {};
  const unknownLabels = new Set<string>();
  const out: FlRow[] = [];

  for (const r of flRows) {
    const poiId = (r['POI ID'] ?? '').trim();
    const name = (r['POI Name'] ?? '').split(/\s+/).filter(Boolean).join(' ');
    const county = (r.County ?? '').trim();

    if (!poiId || !name) {
      dropped['missing id or name'] = (dropped['missing id or name'] ?? 0) + 1;
      continue;
    }
    if (!/^\d{17}$/.test(poiId)) {
      dropped['malformed POI ID'] = (dropped['malformed POI ID'] ?? 0) + 1;
      continue;
    }
    if (seenPoi.has(poiId)) {
      dropped['duplicate POI ID'] = (dropped['duplicate POI ID'] ?? 0) + 1;
      continue;
    }
    seenPoi.add(poiId);

    const raw = (r[THEME_KEY] ?? '').trim();
    const themes: string[] = [];
    if (!NA.has(raw)) {
      for (const part of raw.split('|').map((p) => p.trim()).filter(Boolean)) {
        const slug = byLabel.get(part);
        if (!slug) {
          unknownLabels.add(part);
          continue;
        }
        if (!themes.includes(slug)) themes.push(slug); // preserve order, drop repeats
      }
    }

    if (unknownLabels.size > 0) continue; // finish this pass, then hard-fail below

    const existingRow = existing.get(poiId);
    let slug: string;
    if (existingRow) {
      // Never change a published slug.
      slug = existingRow.slug;
      seenSlug.set(slug, poiId);
    } else {
      const base = slugify(`${name}-${county}`);
      slug = base;
      let n = 2;
      while (seenSlug.has(slug)) {
        slug = `${base}-${n}`;
        n += 1;
      }
      seenSlug.set(slug, poiId);
    }

    const primary = themes[0] ?? 'unclassified';
    const family = primary === 'unclassified' ? catalog.generic.family : (familyOf.get(primary) ?? 'none');

    out.push({
      poi_id: poiId,
      slug,
      name,
      state: 'FL',
      county,
      themes: themes.join('|'),
      theme_count: themes.length,
      primary_theme: primary,
      theme_family: family,
      // Merge, don't overwrite: preserve geocoding work from a prior run.
      lat: existingRow?.lat ?? '',
      lng: existingRow?.lng ?? '',
      geocode_confidence: existingRow?.geocode_confidence ?? '',
      geocode_source: existingRow?.geocode_source ?? '',
      geocode_query: existingRow?.geocode_query ?? '',
    });
  }

  if (unknownLabels.size > 0) {
    console.error('Unmapped theme label(s) found — add them to data/themes.json first:');
    for (const label of unknownLabels) console.error(`  "${label}"`);
    process.exit(1);
  }

  out.sort((a, b) => a.poi_id.localeCompare(b.poi_id));

  const header = Object.keys(out[0] ?? {}).join(',');
  const lines = out.map((row) =>
    Object.values(row)
      .map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v))
      .join(','),
  );
  writeFileSync(CSV_PATH, [header, ...lines].join('\n') + '\n');

  const unclassified = out.filter((r) => r.theme_count === 0).length;
  console.log(`source rows            ${sourceRows.length}`);
  console.log(`florida rows           ${flRows.length}`);
  console.log(`written                ${out.length}`);
  console.log(`dropped                ${JSON.stringify(dropped)}`);
  console.log(
    `unclassified           ${unclassified} (${((unclassified / out.length) * 100).toFixed(0)}%)`,
  );
}

main();
