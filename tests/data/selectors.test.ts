import { describe, expect, it } from 'vitest';
import type { Poi } from '@/lib/types';
import {
  filterByQuery,
  filterByThemes,
  filterByViewport,
  themeCounts,
  toFeatureCollection,
} from '@/lib/data/selectors';

function poi(overrides: Partial<Poi>): Poi {
  return {
    id: 0,
    poiId: '1',
    slug: 'test',
    name: 'Test Hotel',
    county: 'Orange',
    lat: 28,
    lng: -81,
    themes: [],
    primary: 'unclassified',
    family: 'none',
    ...overrides,
  };
}

const pois: Poi[] = [
  poi({ id: 0, name: 'Cozy Café Inn', county: 'Órange', themes: ['family-friendly'], primary: 'family-friendly', family: 'family' }),
  poi({ id: 1, name: 'Ocean Breeze', county: 'Monroe', themes: ['romantic-getaways'], primary: 'romantic-getaways', family: 'indulgence' }),
  poi({ id: 2, name: 'City Lights Hotel', county: 'Miami-Dade', themes: ['family-friendly', 'city-escapes'], primary: 'family-friendly', family: 'family' }),
  poi({ id: 3, name: 'Nowhere Motel', county: 'Bay', themes: [], primary: 'unclassified', family: 'none' }),
];

describe('filterByThemes', () => {
  it('is OR: selecting two themes returns hotels having either', () => {
    const result = filterByThemes(pois, ['romantic-getaways', 'city-escapes']);
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });

  it('returns everything when selection is empty', () => {
    expect(filterByThemes(pois, [])).toEqual(pois);
  });
});

describe('filterByQuery', () => {
  it('matches on name, case- and accent-insensitive', () => {
    expect(filterByQuery(pois, 'cafe').map((p) => p.id)).toEqual([0]);
    expect(filterByQuery(pois, 'CAFÉ').map((p) => p.id)).toEqual([0]);
  });

  it('matches on county, case- and accent-insensitive', () => {
    expect(filterByQuery(pois, 'orange').map((p) => p.id)).toEqual([0]);
  });
});

describe('filterByViewport', () => {
  it('excludes points outside the bbox and includes points exactly on the edge', () => {
    const bbox: [number, number, number, number] = [-82, 27, -80, 29];
    const inside = poi({ id: 10, lat: 28, lng: -81 });
    const onEdge = poi({ id: 11, lat: 27, lng: -82 });
    const outside = poi({ id: 12, lat: 30, lng: -81 });
    const result = filterByViewport([inside, onEdge, outside], bbox);
    expect(result.map((p) => p.id).sort()).toEqual([10, 11]);
  });
});

describe('toFeatureCollection', () => {
  it('puts id at the feature level, not in properties', () => {
    const fc = toFeatureCollection(pois);
    for (const feature of fc.features) {
      expect(feature.id).toBeDefined();
      expect(feature.properties).not.toHaveProperty('id');
    }
  });
});

describe('themeCounts', () => {
  it('sums correctly and includes zero-count themes', () => {
    const counts = themeCounts(pois, ['family-friendly', 'romantic-getaways', 'food-wine']);
    expect(counts['family-friendly']).toBe(2);
    expect(counts['romantic-getaways']).toBe(1);
    expect(counts['food-wine']).toBe(0);
  });
});
