import type { Cli } from '@benchmark/schema';

/** One color per CLI (`--color-vendor-*` in globals.css), used consistently across every chart
 *  and legend so an agent's series color means the same thing on every page. */
export function vendorColor(cli: Cli): string {
  return `var(--color-vendor-${cli})`;
}
