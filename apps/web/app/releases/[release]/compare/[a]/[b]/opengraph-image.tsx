import { ImageResponse } from 'next/og';
import { allCompareParams, EMPTY_PARAM, getRelease, getStanding } from '@/lib/data';
import { formatAgentLabel, formatScore } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';

export const dynamic = 'force-static';
export const alt = 'Agent comparison';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0a0a0c';
const TEXT = '#f2f0ea';
const DIM = '#9a988f';
const FAINT = '#605e57';
const ACCENT = '#ff8a3d';
const BORDER = 'rgba(255,255,255,0.09)';

export function generateStaticParams() {
  return allCompareParams();
}

type Params = { release: string; a: string; b: string };

function FallbackCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 20,
        padding: '72px',
        background: BG,
        color: TEXT,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{ fontSize: 18, letterSpacing: '0.22em', textTransform: 'uppercase', color: FAINT }}
      >
        {SITE_NAME}
      </div>
      <div style={{ fontSize: 52, fontWeight: 700, color: TEXT }}>No comparison yet</div>
      <div style={{ fontSize: 24, color: DIM, maxWidth: 820, lineHeight: 1.4 }}>
        This head-to-head hasn't been published yet. Check back once a benchmark run ships.
      </div>
    </div>
  );
}

export default async function OgImage({ params }: { params: Promise<Params> }) {
  const { release: releaseId, a, b } = await params;
  const release = releaseId === EMPTY_PARAM ? undefined : getRelease(releaseId);
  const standingA = release && a !== EMPTY_PARAM ? getStanding(release, a) : undefined;
  const standingB = release && b !== EMPTY_PARAM ? getStanding(release, b) : undefined;

  if (!release || !standingA || !standingB) {
    return new ImageResponse(<FallbackCard />, { ...size });
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background: BG,
        color: TEXT,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 18,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: FAINT,
        }}
      >
        {SITE_NAME}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            width: 420,
          }}
        >
          <div style={{ fontSize: 26, color: TEXT, textAlign: 'center' }}>
            {formatAgentLabel(standingA.agent)}
          </div>
          <div style={{ fontSize: 88, fontWeight: 700, color: ACCENT, letterSpacing: '-0.03em' }}>
            {formatScore(standingA.overall)}
          </div>
        </div>
        <div style={{ fontSize: 28, color: FAINT, fontWeight: 700, letterSpacing: '0.1em' }}>
          VS
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            width: 420,
          }}
        >
          <div style={{ fontSize: 26, color: TEXT, textAlign: 'center' }}>
            {formatAgentLabel(standingB.agent)}
          </div>
          <div style={{ fontSize: 88, fontWeight: 700, color: ACCENT, letterSpacing: '-0.03em' }}>
            {formatScore(standingB.overall)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          borderTop: `1px solid ${BORDER}`,
          paddingTop: 24,
          color: FAINT,
          fontSize: 18,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {release.release}
      </div>
    </div>,
    { ...size },
  );
}
