import { ImageResponse } from 'next/og';
import { allAgentParams, EMPTY_PARAM, getRelease, getStanding } from '@/lib/data';
import { formatAgentLabel, formatCost, formatScore } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';

export const dynamic = 'force-static';
export const alt = 'Agent scorecard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0a0a0c';
const TEXT = '#f2f0ea';
const DIM = '#9a988f';
const FAINT = '#605e57';
const ACCENT = '#ff8a3d';
const BORDER = 'rgba(255,255,255,0.09)';

export function generateStaticParams() {
  return allAgentParams();
}

type Params = { release: string; agentSlug: string };

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
      <div style={{ fontSize: 52, fontWeight: 700, color: TEXT }}>No agent data yet</div>
      <div style={{ fontSize: 24, color: DIM, maxWidth: 820, lineHeight: 1.4 }}>
        This agent scorecard hasn't been published yet. Check back once a benchmark run ships.
      </div>
    </div>
  );
}

export default async function OgImage({ params }: { params: Promise<Params> }) {
  const { release: releaseId, agentSlug: slug } = await params;
  const release = releaseId === EMPTY_PARAM ? undefined : getRelease(releaseId);
  const standing = release && slug !== EMPTY_PARAM ? getStanding(release, slug) : undefined;

  if (!release || !standing) {
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

      <div
        style={{
          fontSize: 44,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: '-0.02em',
        }}
      >
        {formatAgentLabel(standing.agent)}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <div
          style={{
            fontSize: 140,
            fontWeight: 700,
            color: ACCENT,
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}
        >
          {formatScore(standing.overall)}
        </div>
        <div
          style={{
            fontSize: 22,
            color: DIM,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            paddingBottom: 22,
          }}
        >
          overall
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          borderTop: `1px solid ${BORDER}`,
          paddingTop: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 24, fontSize: 22, color: TEXT }}>
          <div>{`telemetry: ${standing.telemetry}`}</div>
          <div>{`${formatCost(standing.usage.costUsdEquivalent)} API-equiv.`}</div>
        </div>
        <div
          style={{
            fontSize: 18,
            color: FAINT,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          {release.release}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
