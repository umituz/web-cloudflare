import { describe, it, expect } from 'vitest';
import {
  secureCompare,
  generateId,
  randomString,
  deepMerge,
} from '../src/infrastructure/utils/helpers';

describe('secureCompare', () => {
  it('returns true for identical strings', () => {
    expect(secureCompare('secret', 'secret')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(secureCompare('secret', 'secreu')).toBe(false);
  });

  it('returns false for different lengths without throwing', () => {
    expect(secureCompare('a', 'ab')).toBe(false);
    expect(secureCompare('', 'a')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(secureCompare('', '')).toBe(true);
  });
});

describe('generateId', () => {
  it('produces RFC 4122 v4 UUIDs', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('does not produce colliding IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });
});

describe('randomString', () => {
  it('returns the requested length', () => {
    expect(randomString(16).length).toBe(16);
    expect(randomString(1).length).toBe(1);
  });

  it('uses only alphanumeric characters', () => {
    expect(randomString(64)).toMatch(/^[A-Za-z0-9]+$/);
  });
});

describe('deepMerge', () => {
  it('merges nested objects', () => {
    const merged = deepMerge(
      { a: 1, nested: { x: 1, y: 2 } },
      { nested: { y: 3 } }
    ) as Record<string, unknown>;
    expect(merged).toEqual({ a: 1, nested: { x: 1, y: 3 } });
  });

  it('does not mutate the base object', () => {
    const base = { nested: { x: 1 } };
    deepMerge(base, { nested: { x: 2 } });
    expect(base.nested.x).toBe(1);
  });
});
