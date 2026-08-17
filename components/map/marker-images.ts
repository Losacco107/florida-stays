import type * as maplibregl from 'maplibre-gl';
import { themes } from '@/lib/themes';
import { ICON_SHAPES, type IconShape } from './marker-icon-shapes';

const SIZE_DEFAULT = 32;
const SIZE_SELECTED = 40;
const GLYPH_SIZE = 16;
const GLYPH_VIEWBOX = 24;
const RING_WIDTH_DEFAULT = 2;
const RING_WIDTH_SELECTED = 3;
const RING_COLOR_DEFAULT = '#ffffff';
const RING_COLOR_SELECTED = '#0b0b0b'; // ~= --color-ink

function shapeToPath2D(shape: IconShape): Path2D {
  if (shape.type === 'path') return new Path2D(shape.d);
  const path = new Path2D();
  if (shape.type === 'circle') {
    path.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
  } else {
    path.roundRect(shape.x, shape.y, shape.w, shape.h, shape.rx);
  }
  return path;
}

function drawMarkerSprite(
  familyColor: string,
  themeSlug: string,
  selected: boolean,
  dpr: number,
): ImageData {
  const size = selected ? SIZE_SELECTED : SIZE_DEFAULT;
  const ringWidth = selected ? RING_WIDTH_SELECTED : RING_WIDTH_DEFAULT;
  const ringColor = selected ? RING_COLOR_SELECTED : RING_COLOR_DEFAULT;

  const canvas = new OffscreenCanvas(size * dpr, size * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot draw marker sprites');
  ctx.scale(dpr, dpr);

  const center = size / 2;
  const radius = size / 2 - ringWidth / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1.5;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = familyColor;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.lineWidth = ringWidth;
  ctx.strokeStyle = ringColor;
  ctx.stroke();

  const offset = (size - GLYPH_SIZE) / 2;
  const scale = GLYPH_SIZE / GLYPH_VIEWBOX;
  ctx.save();
  ctx.translate(offset, offset);
  ctx.scale(scale, scale);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const shape of ICON_SHAPES[themeSlug] ?? []) {
    ctx.stroke(shapeToPath2D(shape));
  }
  ctx.restore();

  return ctx.getImageData(0, 0, size * dpr, size * dpr);
}

/**
 * Two sprites per theme (default, selected) across 13 themes plus the neutral = 28 images,
 * generated once to an OffscreenCanvas and registered as MapLibre images. `update` re-uses
 * the existing image slots (for a devicePixelRatio change) instead of re-adding them.
 */
export function registerMarkerImages(map: maplibregl.Map, update = false) {
  const dpr = window.devicePixelRatio || 1;
  for (const theme of themes) {
    const defaultSprite = drawMarkerSprite(theme.color, theme.slug, false, dpr);
    const selectedSprite = drawMarkerSprite(theme.color, theme.slug, true, dpr);
    if (update) {
      map.updateImage(`marker-${theme.slug}`, defaultSprite);
      map.updateImage(`marker-${theme.slug}-selected`, selectedSprite);
    } else {
      map.addImage(`marker-${theme.slug}`, defaultSprite, { pixelRatio: dpr });
      map.addImage(`marker-${theme.slug}-selected`, selectedSprite, { pixelRatio: dpr });
    }
  }
}

/** Calls `onChange` once, the next time devicePixelRatio changes, then re-arms itself. */
export function watchDevicePixelRatio(onChange: () => void): () => void {
  let mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  function handleChange() {
    onChange();
    mq.removeEventListener('change', handleChange);
    mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', handleChange);
  }
  mq.addEventListener('change', handleChange);
  return () => mq.removeEventListener('change', handleChange);
}
