import { xIntentUrl } from '@/lib/site';

export function ShareButton({ text, url }: { text: string; url: string }) {
  return (
    <a
      href={xIntentUrl(text, url)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded border border-border-strong px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-text hover:border-accent hover:text-accent"
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-7.6 8.7L23.3 22h-6.9l-5.4-6.9L4.8 22H1.7l8.1-9.3L1 2h7.1l4.9 6.3L18.9 2Zm-1.2 18h1.9L7.4 4h-2l12.3 16Z" />
      </svg>
      Post on X
    </a>
  );
}
