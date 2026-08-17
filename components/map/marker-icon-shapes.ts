// Generated from docs/marker-preview.html's already-validated icon set — do not hand-edit.
// Each shape is drawn as a Path2D on a 24x24 grid (lucide's native viewBox), scaled and
// centered at render time in marker-images.ts. Source: lucide icons referenced in
// data/themes.json.

export type IconShape =
  | { type: 'path'; d: string }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number; rx: number };

export const ICON_SHAPES: Record<string, IconShape[]> = {
  'city-escapes': [
    { type: 'path', d: "M10 12h4" },
    { type: 'path', d: "M10 8h4" },
    { type: 'path', d: "M14 21v-3a2 2 0 0 0-4 0v3" },
    { type: 'path', d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" },
    { type: 'path', d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" },
  ],
  'business-travel': [
    { type: 'path', d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" },
    { type: 'rect', x: 2, y: 6, w: 20, h: 14, rx: 2 },
  ],
  'roadside-motels': [
    { type: 'path', d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" },
    { type: 'path', d: "M7 14h.01" },
    { type: 'path', d: "M17 14h.01" },
    { type: 'path', d: "M5 18v2" },
    { type: 'path', d: "M19 18v2" },
    { type: 'rect', x: 3, y: 10, w: 18, h: 8, rx: 2 },
  ],
  'family-friendly': [
    { type: 'path', d: "M18 21a8 8 0 0 0-16 0" },
    { type: 'path', d: "M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" },
    { type: 'circle', cx: 10, cy: 8, r: 5 },
  ],
  'pet-friendly': [
    { type: 'path', d: "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" },
    { type: 'circle', cx: 11, cy: 4, r: 2 },
    { type: 'circle', cx: 18, cy: 8, r: 2 },
    { type: 'circle', cx: 20, cy: 16, r: 2 },
  ],
  'casino-entertainment': [
    { type: 'path', d: "M16 8h.01" },
    { type: 'path', d: "M8 8h.01" },
    { type: 'path', d: "M8 16h.01" },
    { type: 'path', d: "M16 16h.01" },
    { type: 'path', d: "M12 12h.01" },
    { type: 'rect', x: 3, y: 3, w: 18, h: 18, rx: 2 },
  ],
  'all-inclusive': [
    { type: 'path', d: "M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z" },
    { type: 'path', d: "M20 16a8 8 0 1 0-16 0" },
    { type: 'path', d: "M12 4v4" },
    { type: 'path', d: "M10 4h4" },
  ],
  'outdoor-adventure': [
    { type: 'path', d: "m8 3 4 8 5-5 5 15H2L8 3z" },
  ],
  'natural-wonder': [
    { type: 'path', d: "M12 2v8" },
    { type: 'path', d: "m4.93 10.93 1.41 1.41" },
    { type: 'path', d: "M2 18h2" },
    { type: 'path', d: "M20 18h2" },
    { type: 'path', d: "m19.07 10.93-1.41 1.41" },
    { type: 'path', d: "M22 22H2" },
    { type: 'path', d: "m8 6 4-4 4 4" },
    { type: 'path', d: "M16 18a4 4 0 0 0-8 0" },
  ],
  'national-park': [
    { type: 'path', d: "M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" },
    { type: 'path', d: "M7 16v6" },
    { type: 'path', d: "M13 19v3" },
    { type: 'path', d: "M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" },
  ],
  'romantic-getaways': [
    { type: 'path', d: "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" },
  ],
  'food-wine': [
    { type: 'path', d: "M8 22h8" },
    { type: 'path', d: "M7 10h10" },
    { type: 'path', d: "M12 15v7" },
    { type: 'path', d: "M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" },
  ],
  'onsen-hot-spring': [
    { type: 'path', d: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" },
    { type: 'path', d: "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" },
  ],
  'unclassified': [
    { type: 'path', d: "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" },
    { type: 'path', d: "M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" },
    { type: 'path', d: "M12 4v6" },
    { type: 'path', d: "M2 18h20" },
  ],
};
