import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Dataset } from '@/lib/types';
import { FLORIDA_BBOX, pointInBbox } from '@/lib/geo/bbox';

const raw = readFileSync('public/data/pois.v1.json', 'utf-8');
const json = JSON.parse(raw);

describe('generated dataset', () => {
  it('parses against the Dataset zod schema', () => {
    expect(() => Dataset.parse(json)).not.toThrow();
  });

  it('has every lat/lng inside the Florida bbox', () => {
    for (const poi of json.pois) {
      expect(pointInBbox(poi.lng, poi.lat, FLORIDA_BBOX)).toBe(true);
    }
  });

  it('has unique poi_id and slug', () => {
    const poiIds = json.pois.map((p: { poiId: string }) => p.poiId);
    const slugs = json.pois.map((p: { slug: string }) => p.slug);
    expect(new Set(poiIds).size).toBe(poiIds.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has dense, 0-based id values', () => {
    const ids = json.pois.map((p: { id: number }) => p.id).sort((a: number, b: number) => a - b);
    expect(ids).toEqual(Array.from({ length: ids.length }, (_, i) => i));
  });

  it('references only theme slugs that exist in the catalog', () => {
    const catalogSlugs = new Set(json.themes.map((t: { slug: string }) => t.slug));
    for (const poi of json.pois) {
      for (const theme of poi.themes) {
        expect(catalogSlugs.has(theme)).toBe(true);
      }
      expect(catalogSlugs.has(poi.primary)).toBe(true);
    }
  });

  it('is under the 30 KB gzipped budget', () => {
    const gzipped = gzipSync(raw).length;
    expect(gzipped).toBeLessThan(30 * 1024);
  });
});
