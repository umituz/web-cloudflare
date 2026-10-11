/**
 * cf-ship — build & deploy Cloudflare Workers (pure SPA) with one command.
 *
 * ⚠️ NODE.JS ONLY — build/deployment helper, never import from browser code.
 */

/** Render an assets-only Worker config (pure SPA, no worker script). */
export function renderWranglerConfig(options: {
  name: string;
  assetsDirectory?: string;
}): string;

/** Minimal `--flag` / `--option value` parser. */
export function parseArgs(argv: readonly string[]): {
  positionals: string[];
  flags: Set<string>;
  options: Record<string, string>;
};

/**
 * Locate the wrangler bin shipped with this package (hoisted or nested);
 * returns null when wrangler is not installed.
 */
export function resolveWranglerBin(fromDir?: string): string | null;

/** CLI entry point. Returns the process exit code. */
export function main(argv?: readonly string[]): number;
