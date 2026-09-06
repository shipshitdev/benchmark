import { ImageResponse } from 'next/og';
import { getLatestRelease } from '@/lib/data';
import { formatAgentLabel, formatScore } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';

export const dynamic = 'force-static';
export const alt = 'shipshit.dev benchmark';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0a0a0c';
const TEXT = '#f2f0ea';
const DIM = '#9a988f';
const FAINT = '#605e57';
const ACCENT = '#ff8a3d';
const BORDER = 'rgba(255,255,255,0.09)';

export default function OgImage() {
  const release = getLatestRelease();
  const top = release
    ? [...release.standings].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))[0]
    : undefined;

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
        benchmark
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: TEXT,
            maxWidth: 980,
          }}
        >
          {SITE_NAME}
        </div>

        {release && top ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', fontSize: 22, color: DIM }}>
              {`${release.release} · ${release.standings.length} agents ranked`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: ACCENT }}>
                {formatScore(top.overall)}
              </div>
              <div style={{ fontSize: 26, color: TEXT }}>{formatAgentLabel(top.agent)}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 28, color: DIM, lineHeight: 1.4, maxWidth: 920 }}>
            Frontier model releases, benchmarked on the CLI coding agents people actually use.
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${BORDER}`,
          paddingTop: 24,
          color: FAINT,
          fontSize: 18,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <div>benchmark.shipshit.dev</div>
        <div>coding agent leaderboard</div>
      </div>
    </div>,
    { ...size },
  );
}
