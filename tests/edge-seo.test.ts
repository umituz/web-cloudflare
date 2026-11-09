import { describe, expect, it } from 'vitest';
import {
  matchRouteMeta,
  type EdgeSeoConfig,
} from '../src/domains/middleware/services/edge-seo.service';

describe('edge-seo.service', () => {
  const config: EdgeSeoConfig = {
    siteUrl: 'https://example.com',
    defaultMeta: {
      title: 'Default Title',
      description: 'Default Description',
    },
    routes: {
      '/courses': {
        title: 'Courses - Example',
        description: 'Browse all courses',
        keywords: ['courses', 'learning'],
      },
      '/pricing': {
        title: 'Pricing - Example',
      },
    },
  };

  it('matches exact route meta', () => {
    const meta = matchRouteMeta('/courses', config);
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe('Courses - Example');
    expect(meta?.description).toBe('Browse all courses');
    expect(meta?.keywords).toEqual(['courses', 'learning']);
  });

  it('merges default meta with route-specific overrides', () => {
    const meta = matchRouteMeta('/pricing', config);
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe('Pricing - Example');
    expect(meta?.description).toBe('Default Description');
  });

  it('falls back to default meta for unknown routes', () => {
    const meta = matchRouteMeta('/unknown-route', config);
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe('Default Title');
  });

  it('handles trailing slash normalization', () => {
    const meta = matchRouteMeta('/courses/', config);
    expect(meta?.title).toBe('Courses - Example');
  });
});
