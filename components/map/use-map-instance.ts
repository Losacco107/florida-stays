'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';

let protocolRegistered = false;

function registerPmtilesProtocol() {
  if (protocolRegistered) return;
  maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
  protocolRegistered = true;
}

/**
 * No real Florida tiles are hosted yet (see scripts/build-tiles.md). Rather than point at a
 * demo archive with no Florida coverage — which, behind maxBounds, renders nothing anyway and
 * drags in a whole PMTiles-in-a-worker integration to prove that — fall back to the style's
 * plain background layer. Markers still render on top of it; only the basemap is missing.
 */
function stripBasemapLayers(style: maplibregl.StyleSpecification) {
  style.layers = style.layers.filter((layer) => !('source' in layer) || layer.source !== 'protomaps');
  delete style.sources.protomaps;
}

export function supportsWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

interface UseMapInstanceResult {
  mapRef: RefObject<maplibregl.Map | null>;
  ready: boolean;
  webglSupported: boolean;
}

export function useMapInstance(
  containerRef: RefObject<HTMLDivElement | null>,
): UseMapInstanceResult {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  // This module only ever runs in the browser (loaded via next/dynamic, ssr:false), so
  // reading WebGL2 support synchronously here — rather than setting it from an effect — is
  // safe and avoids an extra render.
  const [webglSupported] = useState(supportsWebGL2);

  useEffect(() => {
    if (!webglSupported) return;
    // Guards React 19 Strict Mode's double-invocation of effects in dev.
    if (mapRef.current || !containerRef.current) return;

    registerPmtilesProtocol();
    let cancelled = false;

    async function init() {
      const res = await fetch('/map-style.json');
      const style: maplibregl.StyleSpecification = await res.json();

      const tilesUrl = process.env.NEXT_PUBLIC_TILES_URL;
      if (tilesUrl) {
        (style.sources.protomaps as maplibregl.VectorSourceSpecification).url =
          `pmtiles://${tilesUrl}`;
      } else {
        console.warn(
          '[map] NEXT_PUBLIC_TILES_URL is not set — rendering without the basemap. ' +
            'See scripts/build-tiles.md.',
        );
        stripBasemapLayers(style);
      }

      if (cancelled || mapRef.current || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [-81.6, 27.9],
        zoom: 6.2,
        maxBounds: [
          [-89.2, 22.8],
          [-78.3, 32.6],
        ],
        minZoom: 5.5,
        maxZoom: 18,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        fadeDuration: 0,
        refreshExpiredTiles: false,
      });
      map.touchZoomRotate.disableRotation();
      map.touchPitch.disable();
      map.on('error', (e) => console.error('[maplibre]', e.error));
      map.on('load', () => setReady(true));

      mapRef.current = map;
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // containerRef is a stable ref object; the effect intentionally runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mapRef, ready, webglSupported };
}
