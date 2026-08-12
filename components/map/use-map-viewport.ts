'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { boundsToBbox, movedMeaningfully } from '@/lib/geo/viewport';
import { centerOf, type Bbox } from '@/lib/geo/bbox';
import { getViewportFromUrl, replaceViewportInUrl } from '@/lib/url-state';

const WRITE_DEBOUNCE_MS = 350;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Wires the map's viewport to the URL, per docs/ARCHITECTURE.md's map↔URL loop:
 *
 *   pan/zoom → moveend → round bbox → history.replaceState (no history entry, no fetch)
 *
 * `movingFromCode` guards the loop from itself: any code-driven jumpTo/easeTo sets it first,
 * so the resulting moveend does not re-write a URL that already caused the move.
 */
export function useMapViewport(
  mapRef: RefObject<maplibregl.Map | null>,
  ready: boolean,
): { flyTo: (center: [number, number], zoom: number) => void } {
  const movingFromCode = useRef(false);
  const lastWrittenBbox = useRef<Bbox | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const restored = getViewportFromUrl();
    if (restored) {
      // jumpTo, never fitBounds — fitBounds pads and rounds the zoom down, so repeated
      // write→reload cycles would drift.
      map.jumpTo({ center: centerOf(restored.bbox), zoom: restored.z });
      lastWrittenBbox.current = restored.bbox;
    }

    function onMoveEnd() {
      if (movingFromCode.current) {
        movingFromCode.current = false;
        return;
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const bbox = boundsToBbox(map!.getBounds());
        if (!movedMeaningfully(lastWrittenBbox.current, bbox)) return;
        lastWrittenBbox.current = bbox;
        replaceViewportInUrl(bbox, map!.getZoom());
      }, WRITE_DEBOUNCE_MS);
    }

    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [mapRef, ready]);

  function flyTo(center: [number, number], zoom: number) {
    const map = mapRef.current;
    if (!map) return;
    movingFromCode.current = true;
    if (prefersReducedMotion()) {
      map.jumpTo({ center, zoom });
    } else {
      map.easeTo({ center, zoom, duration: 400 });
    }
  }

  return { flyTo };
}
