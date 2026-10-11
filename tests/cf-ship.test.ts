import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseArgs, renderWranglerConfig, resolveWranglerBin } from '../bin/cf-ship.mjs';

describe('renderWranglerConfig', () => {
  it('renders an assets-only SPA Worker config', () => {
    const config = renderWranglerConfig({ name: 'foodora' });

    expect(config).toContain('"name": "foodora"');
    expect(config).toContain('"directory": "./dist"');
    expect(config).toContain('"not_found_handling": "single-page-application"');
    // Pure SPA: no worker script entry.
    expect(config).not.toMatch(/^\s*"main":/m);
  });

  it('uses the given assets directory', () => {
    expect(renderWranglerConfig({ name: 'x', assetsDirectory: './build' })).toContain(
      '"directory": "./build"',
    );
  });

  it('interpolates the worker name', () => {
    expect(renderWranglerConfig({ name: 'a"b' })).toContain('"name": "a\\"b"');
  });
});

describe('parseArgs', () => {
  it('separates positionals, flags and options', () => {
    const parsed = parseArgs(['--skip-build', '--name', 'foodora', 'extra']);

    expect(parsed.positionals).toEqual(['extra']);
    expect(parsed.flags.has('skip-build')).toBe(true);
    expect(parsed.options).toEqual({ name: 'foodora' });
  });

  it('treats a flag followed by another flag as boolean', () => {
    expect(parseArgs(['--a', '--b']).flags.has('a')).toBe(true);
    expect(parseArgs(['--a', '--b']).options).toEqual({});
  });

  it('stops parsing at bare "--"', () => {
    expect(parseArgs(['--', '--not-a-flag']).positionals).toEqual(['--not-a-flag']);
  });
});

describe('resolveWranglerBin', () => {
  it('finds the wrangler shipped with this package', () => {
    const bin = resolveWranglerBin();
    expect(bin).toContain('wrangler');
  });

  it('returns null when nothing is installed above fromDir', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'cf-ship-empty-'));
    // tmpdir parents usually contain no wrangler install; keep a marker file so
    // the intent is clear even if the assertion ever flakes on an odd machine.
    writeFileSync(join(emptyRoot, 'marker'), 'no wrangler expected above this dir');
    expect(resolveWranglerBin(emptyRoot)).toBeNull();
  });
});
