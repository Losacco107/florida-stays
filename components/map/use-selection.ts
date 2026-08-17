'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type * as maplibregl from 'maplibre-gl';
import type { Poi } from '@/lib/types';

const VISITED_STORAGE_KEY = 'florida-stays:visited';
const HIT_TEST_PADDING = 6;

function loadVisited(): Set<number> {
  try {
    const raw = sessionStorage.getItem(VISITED_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function saveVisited(visited: Set<number>) {
  try {
    sessionStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify([...visited]));
  } catch {
    // sessionStorage can throw in private browsing — visited styling is a nice-to-have.
  }
}

function sheetHeightPx(): number {
  return document.getElementById('result-list')?.getBoundingClientRect().height ?? 0;
}

/** `?hotel=<slug>` ↔ the selected feature id ↔ the map. */
export function useSelection(
  mapRef: RefObject<maplibregl.Map | null>,
  ready: boolean,
  pois: Poi[],
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visitedRef = useRef<Set<number> | null>(null);

  const slugToId = useMemo(() => new Map(pois.map((p) => [p.slug, p.id])), [pois]);
  const idToPoi = useMemo(() => new Map(pois.map((p) => [p.id, p])), [pois]);

  function setUrlHotel(slug: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('hotel', slug);
    else params.delete('hotel');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function markVisited(id: number, map: maplibregl.Map) {
    visitedRef.current ??= loadVisited();
    if (visitedRef.current.has(id)) return;
    visitedRef.current.add(id);
    saveVisited(visitedRef.current);
    try {
      map.setFeatureState({ source: 'pois', id }, { visited: true });
    } catch {
      // Id propagation to unclustered leaves through supercluster is not guaranteed across
      // versions — the visited dim is a nice-to-have, not load-bearing. Fail silently.
    }
  }

  function selectId(id: number | null, map: maplibregl.Map) {
    map.setFilter('poi-marker-selected', ['==', ['id'], id ?? -1]);
  }

  // Sync the selected layer filter from the URL (deep link, back/forward) without moving the
  // camera — camera moves only happen from a direct tap, per docs/MAP-UX.md §8.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const slug = searchParams.get('hotel');
    const id = slug ? slugToId.get(slug) ?? null : null;
    selectId(id, map);
  }, [mapRef, ready, searchParams, slugToId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    function onClick(e: maplibregl.MapMouseEvent) {
      const box: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - HIT_TEST_PADDING, e.point.y - HIT_TEST_PADDING],
        [e.point.x + HIT_TEST_PADDING, e.point.y + HIT_TEST_PADDING],
      ];

      const [markerFeature] = map!.queryRenderedFeatures(box, { layers: ['poi-markers'] });
      if (markerFeature && markerFeature.id != null) {
        const id = markerFeature.id as number;
        const poi = idToPoi.get(id);
        if (!poi) return;
        selectId(id, map!);
        markVisited(id, map!);
        setUrlHotel(poi.slug);
        map!.easeTo({
          center: [poi.lng, poi.lat],
          offset: [0, -sheetHeightPx() / 3],
          duration: 400,
        });
        return;
      }

      const [clusterFeature] = map!.queryRenderedFeatures(box, { layers: ['clusters'] });
      if (clusterFeature) {
        const clusterId = clusterFeature.properties?.cluster_id as number;
        const source = map!.getSource('pois') as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const [lng, lat] = (clusterFeature.geometry as GeoJSON.Point).coordinates;
          if (lng == null || lat == null) return;
          map!.easeTo({ center: [lng, lat], zoom, duration: 500 });
        });
        return;
      }

      selectId(null, map!);
      setUrlHotel(null);
    }

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
    // setUrlHotel closes over searchParams/pathname/router, all stable-enough for this
    // handler's lifetime; re-binding per pois/idToPoi change is what actually matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, ready, idToPoi]);
}
