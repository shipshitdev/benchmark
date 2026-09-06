import { marked } from 'marked';
import type { Metadata } from 'next';
import { getLatestRelease, getPrices } from '@/lib/data';
import { getDesignDocSections } from '@/lib/design-doc';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Methodology',
  alternates: { canonical: '/methodology/' },
};

export default async function MethodologyPage() {
  const markdown = getDesignDocSections([3, 4]);
  const html = await marked.parse(markdown);
  const prices = getPrices();
  const latest = getLatestRelease();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">methodology</p>
      <h1 className="mt-2 font-display text-4xl italic text-text">Task suite and scoring</h1>

      <section className="mt-6 grid grid-cols-1 gap-3 rounded border border-border p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
            Price table as of
          </p>
          <p className="tabular mt-1 text-text">
            {prices ? formatDate(prices.asOf) : 'no price table published yet'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
            Judge panel (latest release)
          </p>
          <p className="mt-1 text-text">
            {latest && latest.judges.length > 0
              ? latest.judges.map((j) => `${j.cli} · ${j.model}`).join(', ')
              : 'no release judged yet'}
          </p>
        </div>
      </section>

      {/* Rendered from DESIGN.md sections 3-4, the repo's own methodology write-up, so the site
          never drifts from the document engineers actually edit. */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: markdown source is this repo's own DESIGN.md, not user input */}
      <article className="markdown-body mt-10" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
