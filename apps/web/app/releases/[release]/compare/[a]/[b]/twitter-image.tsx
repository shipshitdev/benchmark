import { allCompareParams } from '@/lib/data';
import OgImage from './opengraph-image';

export const dynamic = 'force-static';
export const alt = 'Agent comparison';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return allCompareParams();
}

type Params = { release: string; a: string; b: string };

export default function TwitterImage({ params }: { params: Promise<Params> }) {
  return OgImage({ params });
}
