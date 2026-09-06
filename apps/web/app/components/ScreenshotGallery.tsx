'use client';

import Link from 'next/link';
import { useState } from 'react';

export type ShotEntry = {
  agentSlug: string;
  agentLabel: string;
  runId: string;
  viewport: string;
  url: string;
  pagePath: string;
};

/** Screenshots side by side per agent, with a viewport toggle. Client-side only for the toggle
 *  state — the images themselves are static exports, all present in the markup either way. */
export function ScreenshotGallery({
  shots,
  viewports,
}: {
  shots: ShotEntry[];
  viewports: string[];
}) {
  const initial = viewports.includes('desktop') ? 'desktop' : (viewports[0] ?? 'desktop');
  const [viewport, setViewport] = useState(initial);
  const visible = shots.filter((s) => s.viewport === viewport);

  if (shots.length === 0) {
    return <p className="text-sm text-text-faint">No screenshots recorded for this task yet.</p>;
  }

  return (
    <div>
      {viewports.length > 1 && (
        <div className="mb-4 flex gap-2">
          {viewports.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewport(v)}
              className={`rounded border px-3 py-1 text-xs uppercase tracking-[0.1em] ${
                v === viewport
                  ? 'border-accent text-accent'
                  : 'border-border-strong text-text-dim hover:text-text'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((shot) => (
          <div
            key={`${shot.agentSlug}-${shot.runId}`}
            className="overflow-hidden rounded border border-border"
          >
            <Link href={`/runs/${shot.runId}/`}>
              {/* biome-ignore lint/performance/noImgElement: static export has no image-optimization server */}
              <img
                src={shot.url}
                alt={`${shot.agentLabel} — ${shot.pagePath}`}
                className="w-full bg-bg-inset"
              />
            </Link>
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <Link href={`/runs/${shot.runId}/`} className="text-text hover:text-accent">
                {shot.agentLabel}
              </Link>
              <span className="text-text-faint">{shot.pagePath}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
