import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import './globals.css';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const description =
  'Frontier model releases run through the CLI coding agents people actually use, scored on deterministic gates, hidden tests and blind rubric judging, with tokens, turns and API-equivalent cost next to every score.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description,
  alternates: { canonical: '/' },
  openGraph: { title: SITE_NAME, description, url: SITE_URL, siteName: SITE_NAME, type: 'website' },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable}`}>
      <body className="instrument-ground flex min-h-screen flex-col bg-bg text-text antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
