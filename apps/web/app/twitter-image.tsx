import OgImage from './opengraph-image';

export const dynamic = 'force-static';
export const alt = 'shipshit.dev benchmark';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return OgImage();
}
