import { allReleaseParams } from '@/lib/data';
import OgImage from './opengraph-image';

export const dynamic = 'force-static';
export const alt = 'Release standings';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return allReleaseParams();
}

type Params = { release: string };

export default function TwitterImage({ params }: { params: Promise<Params> }) {
  return OgImage({ params });
}
