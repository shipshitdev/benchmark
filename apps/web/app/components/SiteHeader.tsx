import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="group flex items-baseline gap-3">
          <span className="font-display text-xl font-semibold italic text-text">bench</span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-text-faint sm:inline">
            shipshit.dev model benchmark
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.15em] text-text-dim">
          <Link href="/" className="hover:text-accent">
            Leaderboard
          </Link>
          <Link href="/methodology/" className="hover:text-accent">
            Methodology
          </Link>
          <a
            href="https://github.com/shipshitdev/benchmark"
            className="hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </nav>
      </div>
    </header>
  );
}
