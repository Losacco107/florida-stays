'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { Poi } from '@/lib/types';
import { getTheme } from '@/lib/themes';

const HOVER_DELAY_MS = 120;
const FLIP_THRESHOLD_PX = 160; // not enough room above the cursor to show the card

interface Position {
  x: number;
  y: number;
  flip: boolean;
}

interface MarkerTooltipProps {
  mapRef: RefObject<maplibregl.Map | null>;
  pois: Poi[];
}

/** Desktop hover only — gated on hover+fine-pointer capability, never on screen width. On
 *  touch there is no tooltip at all; the sheet card in Phase 04 carries the same content. */
export function MarkerTooltip({ mapRef, pois }: MarkerTooltipProps) {
  const [poi, setPoi] = useState<Poi | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const hoveredIdRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idToPoi = useMemo(() => new Map(pois.map((p) => [p.id, p])), [pois]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    function positionFor(target: Poi): Position {
      const point = map!.project([target.lng, target.lat]);
      return { x: point.x, y: point.y, flip: point.y < FLIP_THRESHOLD_PX };
    }

    function onMouseMove(e: maplibregl.MapLayerMouseEvent) {
      const feature = e.features?.[0];
      if (!feature || feature.id == null) return;
      const id = feature.id as number;
      const target = idToPoi.get(id);
      if (!target) return;

      if (hoveredIdRef.current !== id) {
        hoveredIdRef.current = id;
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        showTimerRef.current = setTimeout(() => {
          if (hoveredIdRef.current === id) {
            setPoi(target);
            setPos(positionFor(target));
          }
        }, HOVER_DELAY_MS);
      } else {
        setPos(positionFor(target));
      }
    }

    function onMouseLeave() {
      hoveredIdRef.current = null;
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      setPoi(null);
      setPos(null);
    }

    function onMapMove() {
      if (hoveredIdRef.current == null) return;
      const target = idToPoi.get(hoveredIdRef.current);
      if (target) setPos(positionFor(target));
    }

    map.on('mousemove', 'poi-markers', onMouseMove);
    map.on('mouseleave', 'poi-markers', onMouseLeave);
    map.on('move', onMapMove);
    return () => {
      map.off('mousemove', 'poi-markers', onMouseMove);
      map.off('mouseleave', 'poi-markers', onMouseLeave);
      map.off('move', onMapMove);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, [mapRef, idToPoi]);

  if (!poi || !pos) return null;

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 w-60 rounded-card bg-surface p-3.5 shadow-card"
      style={{
        left: pos.x,
        top: pos.y,
        transform: pos.flip ? 'translate(-50%, 12px)' : 'translate(-50%, calc(-100% - 12px))',
      }}
    >
      <div className="truncate text-[14px] font-semibold text-ink">{poi.name}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-muted">{poi.county} County</div>
      {poi.themes.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-ink-muted">No theme classified yet</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {poi.themes.map((slug, index) => {
            const theme = getTheme(slug);
            if (!theme) return null;
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-1.5 rounded-pill bg-canvas px-2 py-0.5 text-[12px] font-medium text-ink"
              >
                <span
                  className="size-2 rounded-pill"
                  style={
                    index === 0
                      ? { backgroundColor: theme.color }
                      : { border: `1.5px solid ${theme.color}` }
                  }
                />
                {theme.short}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
