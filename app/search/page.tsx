import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchClient } from './search-client';

export const metadata: Metadata = {
  title: 'Search Florida stays',
};

function SearchShellFallback() {
  return (
    <main className="relative h-[100dvh] overflow-hidden bg-canvas">
      <Skeleton className="absolute inset-0 rounded-none" />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchShellFallback />}>
      <SearchClient />
    </Suspense>
  );
}
