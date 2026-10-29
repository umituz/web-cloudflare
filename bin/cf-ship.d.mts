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

/** Git-derived deploy marker `<project>-<hash>[-dirty]-<UTC yyyymmddhhmm>`;
 *  returns null outside a git repository. */
export function buildMarker(cwd?: string): string | null;

/** True when argv already carries a `__BUILD_MARKER__` --define of its own. */
export function hasMarkerDefine(argv: readonly string[]): boolean;

/** Final `wrangler deploy` args: everything except cf-ship's own
 *  --skip-build, plus the marker define when the caller did not supply one. */
export function deployWranglerArgs(argv: readonly string[], marker: string | null): string[];

/** CLI entry point. Returns the process exit code. */
export function main(argv?: readonly string[]): number;
