export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://benchmark.shipshit.dev'
).replace(/\/$/, '');

export const SITE_NAME = 'shipshit.dev benchmark';

export function canonicalUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

/** `https://x.com/intent/post?...` for the share buttons. `url` should be a full canonical URL. */
export function xIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({ text, url });
  return `https://x.com/intent/post?${params.toString()}`;
}

import type { Metadata } from 'next';

/** Page metadata that also fills the Open Graph and X card fields, so a pasted link carries the numbers. */
export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = canonicalUrl(input.path);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description },
  };
}
