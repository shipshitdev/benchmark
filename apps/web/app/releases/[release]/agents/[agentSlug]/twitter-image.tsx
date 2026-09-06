import { allAgentParams } from '@/lib/data';
import OgImage from './opengraph-image';

export const dynamic = 'force-static';
export const alt = 'Agent scorecard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return allAgentParams();
}

type Params = { release: string; agentSlug: string };

export default function TwitterImage({ params }: { params: Promise<Params> }) {
  return OgImage({ params });
}
