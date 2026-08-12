import type { Poi } from '@/lib/types';
import { pointInBbox, type Bbox } from '@/lib/geo/bbox';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .toLowerCase();
}

/**
 * OR semantics, not AND. This is the opposite of the usual amenity-filter convention, but the
 * median hotel carries 3 of 13 themes — requiring every selected theme on one hotel would
 * return almost nothing. "Family-friendly or Romantic" is the question a traveller asks.
 */
export function filterByThemes(pois: Poi[], selected: string[]): Poi[] {
  if (selected.length === 0) return pois;
  const wanted = new Set(selected);
  return pois.filter((poi) => poi.themes.some((t) => wanted.has(t)));
}

export function filterByQuery(pois: Poi[], q: string): Poi[] {
  const needle = normalize(q.trim());
  if (!needle) return pois;
  return pois.filter(
    (poi) => normalize(poi.name).includes(needle) || normalize(poi.county).includes(needle),
  );
}

export function filterByViewport(pois: Poi[], bbox: Bbox): Poi[] {
  return pois.filter((poi) => pointInBbox(poi.lng, poi.lat, bbox));
}

export function themeCounts(pois: Poi[], allThemeSlugs: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slug of allThemeSlugs) counts[slug] = 0;
  for (const poi of pois) {
    for (const t of poi.themes) counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

export function toFeatureCollection(pois: Poi[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pois.map((poi) => ({
      type: 'Feature',
      id: poi.id,
      geometry: { type: 'Point', coordinates: [poi.lng, poi.lat] },
      properties: { primary: poi.primary, sortKey: poi.slug },
    })),
  };
}
