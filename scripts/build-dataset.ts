/**
 * scripts/build-dataset.ts — data/fl-pois.csv + data/themes.json → public/data/pois.v1.json
 *
 * Enforces every quality gate in docs/DATA-MODEL.md §8 and exits non-zero on violation. A
 * build that ships bad coordinates is the failure mode this phase exists to prevent.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parse as parseCsvSync } from 'papaparse';
import { bboxOf, FLORIDA_BBOX, centerOf, pointInBbox, type Bbox } from '../lib/geo/bbox';

const CSV_PATH = 'data/fl-pois.csv';
const THEMES_PATH = 'data/themes.json';
const OUT_PATH = 'public/data/pois.v1.json';
const TYPES_OUT_PATH = 'lib/data/generated-types.ts';
const UNCLASSIFIED_WARN_THRESHOLD = 0.4;

interface FlRow {
  poi_id: string;
  slug: string;
  name: string;
  state: string;
  county: string;
  themes: string;
  theme_count: string;
  primary_theme: string;
  theme_family: string;
  lat: string;
  lng: string;
  geocode_confidence: string;
  geocode_source: string;
  geocode_query: string;
}

interface ThemeCatalogFile {
  families: Record<string, { label: string; color: string }>;
  themes: Array<{ slug: string; label: string; short: string; family: string; icon: string; color: string }>;
  generic: { slug: string; label: string; short: string; family: string; icon: string; color: string };
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function main() {
  const catalog: ThemeCatalogFile = JSON.parse(readFileSync(THEMES_PATH, 'utf-8'));
  const allThemes = [...catalog.themes, catalog.generic];
  const themeSlugs = new Set(allThemes.map((t) => t.slug));
  const familyOfTheme = new Map(allThemes.map((t) => [t.slug, t.family]));

  const csvText = readFileSync(CSV_PATH, 'utf-8');
  const { data: rows } = parseCsvSync<FlRow>(csvText, { header: true, skipEmptyLines: true });

  // ---- quality gates ------------------------------------------------------
  const poiIds = new Set<string>();
  const slugs = new Set<string>();
  const usable: FlRow[] = [];
  let excludedFailed = 0;

  for (const row of rows) {
    if (!row.poi_id || !row.name || !row.slug) {
      fail(`row missing poi_id/name/slug: ${JSON.stringify(row)}`);
    }
    if (poiIds.has(row.poi_id)) fail(`duplicate poi_id: ${row.poi_id}`);
    poiIds.add(row.poi_id);
    if (slugs.has(row.slug)) fail(`duplicate slug: ${row.slug}`);
    slugs.add(row.slug);

    const themes = row.themes ? row.themes.split('|').filter(Boolean) : [];
    for (const t of themes) {
      if (!themeSlugs.has(t)) fail(`unknown theme slug "${t}" on ${row.name} (${row.poi_id})`);
    }
    const expectedPrimary = themes[0] ?? 'unclassified';
    if (row.primary_theme !== expectedPrimary) {
      fail(
        `primary_theme mismatch for ${row.name}: expected "${expectedPrimary}", got "${row.primary_theme}"`,
      );
    }

    if (row.geocode_confidence === 'failed') {
      excludedFailed += 1;
      continue;
    }

    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (row.lat === '' || row.lng === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      fail(`missing/non-numeric coordinates for ${row.name} (${row.poi_id})`);
    }
    if (!pointInBbox(lng, lat, FLORIDA_BBOX)) {
      fail(`coordinates outside Florida bbox for ${row.name}: [${lng}, ${lat}]`);
    }

    usable.push(row);
  }

  const unclassifiedShare =
    usable.filter((r) => r.theme_count === '0').length / Math.max(usable.length, 1);
  if (unclassifiedShare > UNCLASSIFIED_WARN_THRESHOLD) {
    console.warn(
      `⚠ ${(unclassifiedShare * 100).toFixed(0)}% of hotels are unclassified (warn threshold ${UNCLASSIFIED_WARN_THRESHOLD * 100}%)`,
    );
  }

  // ---- build the artefact -------------------------------------------------
  const sorted = [...usable].sort((a, b) => a.poi_id.localeCompare(b.poi_id));

  const pois = sorted.map((row, id) => ({
    id,
    poiId: row.poi_id,
    slug: row.slug,
    name: row.name,
    county: row.county,
    lat: Number(row.lat),
    lng: Number(row.lng),
    themes: row.themes ? row.themes.split('|').filter(Boolean) : [],
    primary: row.primary_theme,
    family: row.theme_family || familyOfTheme.get(row.primary_theme) || 'none',
  }));

  const countyGroups = new Map<string, typeof pois>();
  for (const poi of pois) {
    const group = countyGroups.get(poi.county) ?? [];
    group.push(poi);
    countyGroups.set(poi.county, group);
  }
  const counties = [...countyGroups.entries()]
    .map(([name, group]) => {
      const points = group.map((p) => [p.lng, p.lat] as [number, number]);
      const bbox = bboxOf(points);
      return {
        slug: name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        name,
        count: group.length,
        center: centerOf(bbox),
        bbox,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const bbox: Bbox = bboxOf(pois.map((p) => [p.lng, p.lat]));

  const dataset = {
    version: 1 as const,
    generatedAt: new Date().toISOString(),
    themes: allThemes,
    families: catalog.families,
    bbox,
    counties,
    pois,
  };

  mkdirSync('public/data', { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(dataset));

  const gzipSize = gzipSync(JSON.stringify(dataset)).length;
  if (gzipSize > 30 * 1024) {
    fail(`dataset is ${(gzipSize / 1024).toFixed(1)} KB gzipped — over the 30 KB budget`);
  }

  const themeUnion = allThemes.map((t) => `'${t.slug}'`).join(' | ');
  writeFileSync(
    TYPES_OUT_PATH,
    `// Generated by scripts/build-dataset.ts — do not edit by hand.\nexport type ThemeSlug = ${themeUnion};\n`,
  );

  console.log(`✓ wrote ${OUT_PATH} (${pois.length} pois, ${(gzipSize / 1024).toFixed(1)} KB gzipped)`);
  if (excludedFailed > 0) console.log(`  excluded ${excludedFailed} row(s) with failed geocoding`);
}

main();
