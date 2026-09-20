import { describe, it, expect } from 'vitest';
import { checkRateLimit, checkUserQuota, checkAIQuota } from '../src/domains/middleware/services/rate-limit.service';

describe('checkRateLimit (in-memory fallback)', () => {
  it('allows until the limit is reached, then blocks', async () => {
    const key = `rl-${Math.random().toString(36).slice(2)}`;
    const config = {
      enabled: true,
      maxRequests: 3,
      window: 60, // seconds
      keyGenerator: () => key,
    };

    const makeRequest = () =>
      new Request('https://api.example.com/limited', { method: 'GET' });

    expect(await checkRateLimit(makeRequest(), config)).toBeNull();
    expect(await checkRateLimit(makeRequest(), config)).toBeNull();
    expect(await checkRateLimit(makeRequest(), config)).toBeNull();

    const blocked = await checkRateLimit(makeRequest(), config);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(Number(blocked!.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('returns null when disabled', async () => {
    const request = new Request('https://api.example.com/x');
    expect(await checkRateLimit(request, { enabled: false, maxRequests: 1, window: 1 })).toBeNull();
  });
});

describe('checkUserQuota (in-memory fallback)', () => {
  it('tracks usage per user and enforces the quota', async () => {
    const userId = `quota-user-${Math.random().toString(36).slice(2)}`;
    expect(await checkUserQuota(userId, 2, 60)).toBe(true);
    expect(await checkUserQuota(userId, 2, 60)).toBe(true);
    expect(await checkUserQuota(userId, 2, 60)).toBe(false);
  });
});

describe('checkAIQuota (in-memory fallback)', () => {
  it('accumulates neurons and blocks when the quota would be exceeded', async () => {
    const userId = `ai-user-${Math.random().toString(36).slice(2)}`;
    const config = { quota: 100, period: 60 };

    const first = await checkAIQuota(userId, 60, config);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(40);

    const second = await checkAIQuota(userId, 50, config);
    expect(second.allowed).toBe(false);
    expect(second.remaining).toBe(40);

    const third = await checkAIQuota(userId, 40, config);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });
});
