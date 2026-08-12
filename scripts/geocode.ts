/**
 * scripts/geocode.ts — fills lat/lng in data/fl-pois.csv via Nominatim, with a mandatory
 * human review pass for anything scored `low` or `failed`.
 *
 * Usage: pnpm data:geocode [--force]
 *
 * Nominatim's usage policy requires 1 request/second and a descriptive User-Agent with a
 * contact address — this is enforced below, not a suggestion. Raw responses are cached to
 * data/.geocode-cache/<poi_id>.json (gitignored) so a re-run never re-hits the network for a
 * row already resolved.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse as parseCsvSync } from 'papaparse';
import { FLORIDA_BBOX, pointInBbox } from '../lib/geo/bbox';

const CSV_PATH = 'data/fl-pois.csv';
const CACHE_DIR = 'data/.geocode-cache';
const REPORT_PATH = 'data/geocode-report.md';
const USER_AGENT = 'florida-stays-geocoder/1.0 (contact: douglas@snapfy.ai)';
const REQUEST_INTERVAL_MS = 1000;

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

interface NominatimCandidate {
  lat: string;
  lon: string;
  display_name: string;
  category?: string; // format=jsonv2 field name (format=json calls this "class")
  type?: string;
  address?: Record<string, string>;
}

const TOURISM_HOTEL_TYPES = new Set(['hotel', 'motel', 'resort']);

/** Lightweight approximation of fuzzywuzzy's token_set_ratio — order- and duplicate-insensitive
 *  string similarity in [0, 1], good enough to gate a confidence threshold. */
function tokenSetRatio(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = [...setA].filter((t) => setB.has(t)).sort().join(' ');
  const restA = [...setA].filter((t) => !setB.has(t)).sort().join(' ');
  const restB = [...setB].filter((t) => !setA.has(t)).sort().join(' ');
  const combinedA = [intersection, restA].filter(Boolean).join(' ');
  const combinedB = [intersection, restB].filter(Boolean).join(' ');
  return Math.max(
    simpleRatio(intersection, combinedA),
    simpleRatio(intersection, combinedB),
    simpleRatio(combinedA, combinedB),
  );
}

function simpleRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j] ?? 0;
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, tmp, dp[j - 1] ?? 0);
      prevDiag = tmp;
    }
  }
  return dp[n] ?? 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function candidateCountyMatches(candidate: NominatimCandidate, county: string): boolean {
  const addrCounty = (candidate.address?.county ?? '').toLowerCase();
  return addrCounty.includes(county.toLowerCase());
}

/** tourism=hotel/motel/resort, or building=hotel — per docs/DATA-MODEL.md §4. */
function candidateIsHotelLike(candidate: NominatimCandidate): boolean {
  if (candidate.category === 'tourism') return TOURISM_HOTEL_TYPES.has(candidate.type ?? '');
  if (candidate.category === 'building') return candidate.type === 'hotel';
  return false;
}

interface ScoredResult {
  confidence: 'high' | 'medium' | 'low' | 'failed';
  lat?: number;
  lng?: number;
  candidates: NominatimCandidate[];
}

function score(name: string, county: string, candidates: NominatimCandidate[]): ScoredResult {
  if (candidates.length === 0) return { confidence: 'failed', candidates };

  let best: { candidate: NominatimCandidate; similarity: number; countyOk: boolean } | null =
    null;
  for (const c of candidates) {
    const similarity = tokenSetRatio(name, c.display_name);
    const countyOk = candidateCountyMatches(c, county);
    if (!best || similarity > best.similarity) best = { candidate: c, similarity, countyOk };
  }
  if (!best) return { confidence: 'failed', candidates };

  const lat = Number(best.candidate.lat);
  const lng = Number(best.candidate.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !pointInBbox(lng, lat, FLORIDA_BBOX)) {
    return { confidence: 'failed', candidates };
  }

  const hotelLike = candidateIsHotelLike(best.candidate);
  if (hotelLike && best.countyOk && best.similarity >= 0.8) {
    return { confidence: 'high', lat, lng, candidates };
  }
  if (best.countyOk && best.similarity >= 0.55) {
    return { confidence: 'medium', lat, lng, candidates };
  }
  return { confidence: 'low', lat, lng, candidates };
}

async function geocodeOne(row: FlRow): Promise<{ query: string; result: ScoredResult }> {
  const query = `${row.name}, ${row.county} County, Florida, USA`;
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = `${CACHE_DIR}/${row.poi_id}.json`;

  let candidates: NominatimCandidate[];
  if (existsSync(cachePath)) {
    candidates = JSON.parse(readFileSync(cachePath, 'utf-8'));
  } else {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('countrycodes', 'us');
    url.searchParams.set('limit', '3');
    url.searchParams.set('addressdetails', '1');

    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Nominatim request failed: ${res.status} ${res.statusText}`);
    candidates = await res.json();
    writeFileSync(cachePath, JSON.stringify(candidates, null, 2));
    await sleep(REQUEST_INTERVAL_MS); // only throttle real network calls, not cache hits
  }

  return { query, result: score(row.name, row.county, candidates) };
}

function toCsv(rows: FlRow[]): string {
  const header = Object.keys(rows[0] ?? {}).join(',');
  const lines = rows.map((row) =>
    Object.values(row)
      .map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v))
      .join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}

async function main() {
  const force = process.argv.includes('--force');
  const text = readFileSync(CSV_PATH, 'utf-8');
  const { data: rows } = parseCsvSync<FlRow>(text, { header: true, skipEmptyLines: true });

  const toResolve = rows.filter((r) => force || !r.lat || !r.lng);
  console.log(`${toResolve.length} of ${rows.length} rows need geocoding`);

  const counts: Record<string, number> = { high: 0, medium: 0, low: 0, failed: 0 };
  const reviewRows: Array<{ row: FlRow; query: string; result: ScoredResult }> = [];

  for (const row of toResolve) {
    const { query, result } = await geocodeOne(row);
    counts[result.confidence] = (counts[result.confidence] ?? 0) + 1;
    row.geocode_query = query;

    if (result.confidence === 'failed') {
      // Never write failed coordinates as 0,0 or a centroid — leave them empty for manual fix.
      row.geocode_confidence = 'failed';
      row.geocode_source = 'nominatim';
    } else {
      row.lat = String(result.lat);
      row.lng = String(result.lng);
      row.geocode_confidence = result.confidence;
      row.geocode_source = 'nominatim';
    }

    if (result.confidence === 'low' || result.confidence === 'failed') {
      reviewRows.push({ row, query, result });
    }
    console.log(`${result.confidence.padEnd(7)} ${row.name} (${row.county})`);
  }

  writeFileSync(CSV_PATH, toCsv(rows));

  const reportLines = [
    '# Geocode report',
    '',
    `Resolved ${toResolve.length} rows.`,
    '',
    '| Confidence | Count |',
    '|---|---|',
    ...Object.entries(counts).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Rows needing manual review',
    '',
    'Look each of these up by hand, write the coordinates into data/fl-pois.csv, and set',
    '`geocode_source = manual` and `geocode_confidence = high` only after verifying the',
    'location.',
    '',
    '| Name | County | Query | Top candidates |',
    '|---|---|---|---|',
    ...reviewRows.map(({ row, query, result }) => {
      const candidates = result.candidates
        .slice(0, 3)
        .map((c) => `${c.display_name} (${c.lat}, ${c.lon})`)
        .join('; ');
      return `| ${row.name} | ${row.county} | ${query} | ${candidates || '—'} |`;
    }),
    '',
  ];
  writeFileSync(REPORT_PATH, reportLines.join('\n'));

  console.log('\nconfidence counts:', counts);
  console.log(`${reviewRows.length} row(s) need manual review — see ${REPORT_PATH}`);
}

main();
