/** [west, south, east, north] in degrees. */
export type Bbox = [number, number, number, number];

export const FLORIDA_BBOX: Bbox = [-87.7, 24.3, -79.8, 31.1];

export function parseBbox(value: string): Bbox | null {
  const parts = value.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return parts as Bbox;
}

export function formatBbox(bbox: Bbox, precision = 4): string {
  return bbox.map((n) => n.toFixed(precision)).join(',');
}

/** Rounds a bbox to a coarser grid so nearby viewports share a cache/URL key. */
export function roundBbox(bbox: Bbox, precision = 2): Bbox {
  const factor = 10 ** precision;
  return bbox.map((n) => Math.round(n * factor) / factor) as Bbox;
}

export function clampBbox([w, s, e, n]: Bbox, bounds: Bbox): Bbox {
  const [bw, bs, be, bn] = bounds;
  return [Math.max(w, bw), Math.max(s, bs), Math.min(e, be), Math.min(n, bn)];
}

export function centerOf([w, s, e, n]: Bbox): [number, number] {
  return [(w + e) / 2, (s + n) / 2];
}

export function pointInBbox(lng: number, lat: number, [w, s, e, n]: Bbox): boolean {
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

export function bboxOf(points: Array<[number, number]>): Bbox {
  if (points.length === 0) return FLORIDA_BBOX;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}
