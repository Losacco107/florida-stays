import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Florida Stays',
  description: 'Discover Florida hotels by the kind of stay you want.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

function tilesOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_TILES_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const preconnectOrigin = tilesOrigin();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>{preconnectOrigin && <link rel="preconnect" href={preconnectOrigin} />}</head>
      <body className="h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
