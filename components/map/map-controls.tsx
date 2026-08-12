'use client';

import { LocateFixed, Minus, Plus } from 'lucide-react';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}

/**
 * FABs positioned above the result sheet via --sheet-height, set by the page shell. No
 * default MapLibre controls — on a phone pinch is the interaction, so zoom buttons only
 * render at md: and up.
 */
export function MapControls({ onZoomIn, onZoomOut, onLocate }: MapControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto absolute right-4 hidden flex-col gap-1 bottom-[calc(var(--sheet-height)+72px)] md:flex">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={onZoomIn}
          className="flex size-11 items-center justify-center rounded-t-card rounded-b-none bg-surface shadow-card"
        >
          <Plus aria-hidden="true" className="size-5 text-ink" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={onZoomOut}
          className="flex size-11 items-center justify-center rounded-b-card rounded-t-none bg-surface shadow-card"
        >
          <Minus aria-hidden="true" className="size-5 text-ink" />
        </button>
      </div>

      <button
        type="button"
        aria-label="Center map on my location"
        onClick={onLocate}
        className="pointer-events-auto absolute right-4 flex size-11 items-center justify-center rounded-pill bg-surface shadow-card bottom-[calc(var(--sheet-height)+16px)]"
      >
        <LocateFixed aria-hidden="true" className="size-5 text-ink" />
      </button>
    </div>
  );
}
