'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapInstance } from './use-map-instance';
import { useMapViewport } from './use-map-viewport';
import { MapControls } from './map-controls';
import { MapAttribution } from './map-attribution';
import { NoWebGLFallback } from './no-webgl-fallback';

const RESIZE_DEBOUNCE_MS = 100;
const LOCATE_TOAST_MS = 3000;

function createLocationDot(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'size-3.5 rounded-pill border-2 border-surface bg-accent shadow-marker';
  return el;
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const { mapRef, ready, webglSupported } = useMapInstance(containerRef);
  const { flyTo } = useMapViewport(mapRef, ready);
  const [locateDenied, setLocateDenied] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !webglSupported) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => mapRef.current?.resize(), RESIZE_DEBOUNCE_MS);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [mapRef, webglSupported]);

  function handleLocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const center: [number, number] = [position.coords.longitude, position.coords.latitude];
        flyTo(center, 13);
        const map = mapRef.current;
        if (!map) return;
        locationMarkerRef.current?.remove();
        locationMarkerRef.current = new maplibregl.Marker({ element: createLocationDot() })
          .setLngLat(center)
          .addTo(map);
      },
      () => {
        // Never block the UI on a denial — a one-time toast is the whole response.
        setLocateDenied(true);
        setTimeout(() => setLocateDenied(false), LOCATE_TOAST_MS);
      },
    );
  }

  if (!webglSupported) return <NoWebGLFallback />;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <MapControls
        onLocate={handleLocate}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />
      {locateDenied && (
        <div className="pointer-events-none absolute right-4 z-20 rounded-card bg-ink px-3 py-2 text-[13px] text-surface shadow-card bottom-[calc(var(--sheet-height)+72px)]">
          Location access was denied
        </div>
      )}
      <MapAttribution />
    </div>
  );
}
