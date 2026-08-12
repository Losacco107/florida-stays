import { SearchParams } from './types';
import { formatBbox, parseBbox, type Bbox } from './geo/bbox';

export function parseSearchParams(params: URLSearchParams): SearchParams {
  return SearchParams.parse({
    bbox: params.get('bbox') ?? undefined,
    z: params.get('z') ?? undefined,
    themes: params.get('themes') ?? undefined,
    q: params.get('q') ?? undefined,
    hotel: params.get('hotel') ?? undefined,
  });
}

/**
 * Map movement writes here — history.replaceState, not router.replace. The App Router has no
 * shallow option, and router.replace would re-run the server component on every pan. This
 * write does not trigger a fetch; it only lets a shared link restore the view.
 */
export function replaceViewportInUrl(bbox: Bbox, zoom: number) {
  const params = new URLSearchParams(window.location.search);
  params.set('bbox', formatBbox(bbox, 5));
  params.set('z', zoom.toFixed(2));
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export function getViewportFromUrl(): { bbox: Bbox; z: number } | null {
  const params = new URLSearchParams(window.location.search);
  const bboxStr = params.get('bbox');
  const zStr = params.get('z');
  if (!bboxStr || !zStr) return null;
  const bbox = parseBbox(bboxStr);
  const z = Number(zStr);
  if (!bbox || !Number.isFinite(z)) return null;
  return { bbox, z };
}
