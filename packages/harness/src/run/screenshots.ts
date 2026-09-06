import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Screenshot } from '@benchmark/schema';
import { VIEWPORTS } from '@benchmark/schema';
import { startServe } from './serve';

export interface CapturedScreenshot {
  path: string;
  viewport: string;
  file: string;
}

export function slugify(path: string): string {
  const slug = path
    .replace(/^\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'root';
}

/** Captures each `artifacts.screenshots` entry at every requested viewport into `outputDir`. */
export async function captureScreenshots(
  screenshots: Screenshot[],
  workspaceDir: string,
  outputDir: string,
): Promise<CapturedScreenshot[]> {
  if (screenshots.length === 0) return [];
  await mkdir(outputDir, { recursive: true });
  const results: CapturedScreenshot[] = [];
  const { chromium } = await import('@playwright/test');

  for (const screenshot of screenshots) {
    const serveHandle = await startServe(screenshot.serve, workspaceDir);
    try {
      const browser = await chromium.launch();
      try {
        for (const viewport of screenshot.viewports) {
          const page = await browser.newPage({ viewport: VIEWPORTS[viewport] });
          await page.goto(new URL(screenshot.path, serveHandle.baseUrl).toString());
          await page.waitForTimeout(screenshot.settleMs);
          const file = `${slugify(screenshot.path)}-${viewport}.png`;
          await page.screenshot({ path: join(outputDir, file), fullPage: true });
          await page.close();
          results.push({ path: screenshot.path, viewport, file });
        }
      } finally {
        await browser.close();
      }
    } finally {
      await serveHandle.stop();
    }
  }
  return results;
}
