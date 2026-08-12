import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchClient } from './search-client';

describe('SearchClient', () => {
  it('renders the static mobile shell', () => {
    render(<SearchClient />);

    expect(screen.getByText('Where to?')).toBeInTheDocument();
    expect(screen.getByText('0 stays in view')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip map, go to results' })).toBeInTheDocument();
  });
});
