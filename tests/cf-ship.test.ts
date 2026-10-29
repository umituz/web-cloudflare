import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarker, deployWranglerArgs, parseArgs, renderWranglerConfig, resolveWranglerBin } from '../bin/cf-ship.mjs';

const binFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cf-ship.mjs');

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

describe('CLI entry via symlink (npm node_modules/.bin shim)', () => {
  it('runs main when invoked through a symlinked path', () => {
    const shimDir = mkdtempSync(join(tmpdir(), 'cf-ship-shim-'));
    const shim = join(shimDir, 'cf-ship');
    symlinkSync(binFile, shim);

    const result = spawnSync(process.execPath, [shim, 'help'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
  });
});

function makeGitProject(name: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cf-ship-git-'));
  const git = (args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git(['init', '--quiet']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'test']);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `@scope/${name}` }));
  git(['add', '.']);
  git(['commit', '--quiet', '--no-gpg-sign', '-m', 'init']);
  return dir;
}

describe('buildMarker', () => {
  it('derives <project>-<hash>-<stamp> from a clean git repo', () => {
    const marker = buildMarker(makeGitProject('marker-app'));
    expect(marker).toMatch(/^marker-app-[0-9a-f]{7,}-\d{12}$/);
  });

  it('marks uncommitted changes with -dirty', () => {
    const dir = makeGitProject('marker-app');
    writeFileSync(join(dir, 'uncommitted.txt'), 'work in progress');
    const marker = buildMarker(dir);
    expect(marker).toMatch(/^marker-app-[0-9a-f]{7,}-dirty-\d{12}$/);
  });

  it('returns null outside a git repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cf-ship-nogit-'));
    writeFileSync(join(dir, 'marker'), 'no git expected above this dir');
    expect(buildMarker(dir)).toBeNull();
  });
});

describe('deployWranglerArgs', () => {
  it('forwards flags verbatim and drops only --skip-build', () => {
    expect(deployWranglerArgs(['--skip-build', '--dry-run'], null)).toEqual(['deploy', '--dry-run']);
  });

  it('keeps positionals and order, injecting the marker at the end', () => {
    expect(deployWranglerArgs(['extra', '--keep-vars'], 'app-abc1234-202610291200')).toEqual([
      'deploy',
      'extra',
      '--keep-vars',
      '--define',
      `__BUILD_MARKER__:'"app-abc1234-202610291200"'`,
    ]);
  });

  it('never overrides an explicit marker define', () => {
    expect(deployWranglerArgs(['--define', `__BUILD_MARKER__:'"mine"'`], 'auto-marker')).toEqual([
      'deploy',
      '--define',
      `__BUILD_MARKER__:'"mine"'`,
    ]);
    expect(
      deployWranglerArgs([`--define=__BUILD_MARKER__:'"mine"'`], 'auto-marker'),
    ).toEqual(['deploy', `--define=__BUILD_MARKER__:'"mine"'`]);
  });
});
