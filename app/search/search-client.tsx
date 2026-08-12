'use client';

import type { CSSProperties } from 'react';
import { Info, LocateFixed, Search, SlidersHorizontal } from 'lucide-react';
import { Chip } from '@/components/ui/chip';

const PLACEHOLDER_THEME_CHIPS = ['Family-Friendly', 'Outdoor Adventure', 'City Escapes'];

export function SearchClient() {
  return (
    <main
      className="relative h-[100dvh] overflow-hidden bg-canvas"
      style={{ '--sheet-height': '12%' } as CSSProperties}
    >
      <a
        href="#result-list"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-card focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-card"
      >
        Skip map, go to results
      </a>

      <div
        id="map-placeholder"
        className="absolute inset-0 flex items-center justify-center bg-neutral-200"
      >
        <span className="text-ink-muted">Map</span>
      </div>

      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-20 flex flex-col gap-2">
        <div className="flex min-h-11 items-center gap-3 rounded-pill bg-surface px-4 shadow-card">
          <Search aria-hidden="true" className="size-4.5 shrink-0 text-ink-muted" />
          <span className="flex-1 text-[15px] text-ink-muted">Where to?</span>
          <button
            type="button"
            aria-label="Open filters"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4.5 text-ink" />
          </button>
        </div>

        <div className="relative -mx-4">
          <div className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PLACEHOLDER_THEME_CHIPS.map((label) => (
              <Chip key={label} className="shrink-0" tabIndex={-1} aria-hidden="true">
                {label}
              </Chip>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas to-transparent" />
        </div>
      </div>

      <div className="absolute right-4 z-20 flex flex-col gap-3 bottom-[calc(var(--sheet-height)+16px)]">
        <button
          type="button"
          aria-label="Center map on my location"
          className="flex size-11 items-center justify-center rounded-pill bg-surface shadow-card"
        >
          <LocateFixed aria-hidden="true" className="size-5 text-ink" />
        </button>
        <button
          type="button"
          aria-label="Show legend"
          className="flex size-11 items-center justify-center rounded-pill bg-surface shadow-card"
        >
          <Info aria-hidden="true" className="size-5 text-ink" />
        </button>
      </div>

      <div
        id="result-list"
        role="region"
        aria-label="Search results"
        className="absolute inset-x-0 bottom-0 z-30 h-[var(--sheet-height)] rounded-t-sheet bg-surface shadow-sheet"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-pill bg-line" />
        <p className="mt-3 px-4 text-[13px] text-ink-muted">0 stays in view</p>
      </div>
    </main>
  );
}
