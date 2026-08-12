'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';

// A small, CORS-enabled public PMTiles archive used only to prove the pmtiles protocol,
// style loading and WebGL rendering pipeline work end-to-end before real Florida tiles are
// hosted (see scripts/build-tiles.md). It covers Florence, Italy, not Florida — because
// maxBounds below is Florida-only, the visible result is an empty (but gesture- and
// URL-loop-correct) map until NEXT_PUBLIC_TILES_URL points at a real Florida extract.
const DEMO_TILES_URL = 'https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles';

let protocolRegistered = false;

function registerPmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
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
      const style = await res.json();

      const tilesUrl = process.env.NEXT_PUBLIC_TILES_URL;
      if (tilesUrl) {
        style.sources.protomaps.url = `pmtiles://${tilesUrl}`;
      } else {
        console.warn(
          '[map] NEXT_PUBLIC_TILES_URL is not set — falling back to the Protomaps demo tiles.',
        );
        style.sources.protomaps.url = `pmtiles://${DEMO_TILES_URL}`;
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
