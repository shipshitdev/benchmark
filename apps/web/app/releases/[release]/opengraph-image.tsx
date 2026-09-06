import { agentSlug } from '@benchmark/schema';
import { ImageResponse } from 'next/og';
import { allReleaseParams, EMPTY_PARAM, getRelease } from '@/lib/data';
import { formatAgentLabel, formatScore } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';

export const dynamic = 'force-static';
export const alt = 'Release standings';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0a0a0c';
const TEXT = '#f2f0ea';
const DIM = '#9a988f';
const FAINT = '#605e57';
const ACCENT = '#ff8a3d';
const BORDER = 'rgba(255,255,255,0.09)';

export function generateStaticParams() {
  return allReleaseParams();
}

type Params = { release: string };

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
      <div style={{ fontSize: 52, fontWeight: 700, color: TEXT }}>No release yet</div>
      <div style={{ fontSize: 24, color: DIM, maxWidth: 820, lineHeight: 1.4 }}>
        This release hasn't been published yet. Check back once a benchmark run ships.
      </div>
    </div>
  );
}

export default async function OgImage({ params }: { params: Promise<Params> }) {
  const { release: releaseId } = await params;
  const release = releaseId === EMPTY_PARAM ? undefined : getRelease(releaseId);

  if (!release) {
    return new ImageResponse(<FallbackCard />, { ...size });
  }

  const top3 = [...release.standings]
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))
    .slice(0, 3);

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            fontSize: 22,
            color: DIM,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          {release.release}
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '-0.02em',
            maxWidth: 1000,
          }}
        >
          {release.title}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {top3.map((standing, index) => (
          <div
            key={agentSlug(standing.agent)}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              ...(index === 0 ? {} : { borderTop: `1px solid ${BORDER}` }),
              paddingTop: index === 0 ? 0 : 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <div style={{ fontSize: 20, color: FAINT }}>{`#${index + 1}`}</div>
              <div style={{ fontSize: 26, color: TEXT }}>{formatAgentLabel(standing.agent)}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT }}>
              {formatScore(standing.overall)}
            </div>
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
