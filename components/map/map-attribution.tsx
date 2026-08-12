'use client';

import { useState } from 'react';

/** Required by both the OSM and Protomaps licences — never hide this. */
export function MapAttribution() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-2 left-2 z-20">
      {open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-pill bg-surface/90 px-2.5 py-1 text-[11px] text-ink-muted shadow-card"
        >
          © OpenStreetMap contributors · Protomaps
        </button>
      ) : (
        <button
          type="button"
          aria-label="Show map attribution"
          onClick={() => setOpen(true)}
          className="flex size-6 items-center justify-center rounded-pill bg-surface/90 text-[12px] text-ink-muted shadow-card"
        >
          ⓘ
        </button>
      )}
    </div>
  );
}
