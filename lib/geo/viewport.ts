import { roundBbox, type Bbox } from './bbox';

export interface LngLatBoundsLike {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}

export function boundsToBbox(bounds: LngLatBoundsLike): Bbox {
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

/** True once the bbox has moved enough — after rounding to 5dp — to be worth writing to the
 *  URL. Keeps sub-pixel jitter from spamming history.replaceState. */
export function movedMeaningfully(prev: Bbox | null, next: Bbox): boolean {
  if (!prev) return true;
  const a = roundBbox(prev, 5);
  const b = roundBbox(next, 5);
  return a.some((v, i) => v !== b[i]);
}
