import { z } from 'zod';

export const ThemeFamily = z.enum(['urban', 'family', 'outdoors', 'indulgence', 'none']);
export type ThemeFamily = z.infer<typeof ThemeFamily>;

export const Theme = z.object({
  slug: z.string(),
  label: z.string(),
  short: z.string(),
  family: ThemeFamily,
  icon: z.string(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type Theme = z.infer<typeof Theme>;

export const Poi = z.object({
  id: z.number().int().nonnegative(),
  poiId: z.string(),
  slug: z.string(),
  name: z.string().min(1),
  county: z.string(),
  lat: z.number().min(24).max(31.2), // Florida, not the planet
  lng: z.number().min(-88).max(-79.5),
  themes: z.array(z.string()), // may be empty
  primary: z.string(), // 'unclassified' when themes is empty
  family: ThemeFamily,
});
export type Poi = z.infer<typeof Poi>;

export const Dataset = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  themes: z.array(Theme),
  families: z.record(z.string(), z.object({ label: z.string(), color: z.string() })),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  counties: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      count: z.number().int(),
      center: z.tuple([z.number(), z.number()]),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    }),
  ),
  pois: z.array(Poi),
});
export type Dataset = z.infer<typeof Dataset>;

export const SearchParams = z.object({
  bbox: z.string().regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/).optional(),
  z: z.coerce.number().min(5.5).max(18).default(6.2), // matches the map's minZoom/maxZoom
  themes: z.string().optional(), // "family-friendly,romantic-getaways" — OR semantics
  q: z.string().max(120).optional(), // free-text name/county query
  hotel: z.string().optional(), // slug
});
export type SearchParams = z.infer<typeof SearchParams>;
