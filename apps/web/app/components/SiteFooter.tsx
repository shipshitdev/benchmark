export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-text-faint">
        <p>
          Every number traces back to a run. Cost is API-equivalent, derived from token counts at
          list price, not billed spend.
        </p>
        <p>MIT licensed. Results are JSON in the repo; this site is a static build of that data.</p>
      </div>
    </footer>
  );
}
