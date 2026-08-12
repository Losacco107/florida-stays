import themesJson from '../data/themes.json';
import { Theme, ThemeFamily } from './types';

interface ThemeCatalogFile {
  families: Record<string, { label: string; color: string }>;
  themes: Array<Omit<Theme, 'family'> & { family: string }>;
  generic: Omit<Theme, 'family'> & { family: string };
}

const catalog = themesJson as ThemeCatalogFile;

// The 13 selling themes plus the `unclassified` generic, as one flat list — this is the
// full `Theme[]` shipped in the dataset so the client never needs a second request.
export const themes: Theme[] = [...catalog.themes, catalog.generic].map((t) => ({
  ...t,
  family: ThemeFamily.parse(t.family),
}));

export const families: Record<string, { label: string; color: string }> = catalog.families;

const bySlug = new Map(themes.map((t) => [t.slug, t]));

export function getTheme(slug: string): Theme | undefined {
  return bySlug.get(slug);
}

export function getFamilyOf(themeSlug: string): string {
  return getTheme(themeSlug)?.family ?? 'none';
}
