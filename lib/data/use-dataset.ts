'use client';

import { use } from 'react';
import type { Dataset } from '@/lib/types';
import { loadDataset } from './load';

/** Must be called inside a Suspense boundary — there is exactly one loading state in the
 *  app's lifetime, and this is it. */
export function useDataset(): Dataset {
  return use(loadDataset());
}
