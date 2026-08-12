import { Dataset } from '@/lib/types';

// Module-level promise so every component sharing this module shares one fetch — the whole
// dataset is one immutable resource, so a cache library would be solving a problem we don't
// have.
let cache: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  cache ??= fetch('/data/pois.v1.json')
    .then((r) => r.json())
    .then((j) => Dataset.parse(j)); // zod, once, at the boundary
  return cache;
}
