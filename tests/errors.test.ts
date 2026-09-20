import { describe, it, expect } from 'vitest';
import { CloudflareError, isCloudflareError } from '../src/infrastructure/errors/cloudflare.error';

describe('CloudflareError', () => {
  it('carries code, status, retryable and cause', () => {
    const cause = new TypeError('fetch failed');
    const error = new CloudflareError('upstream unavailable', {
      code: 'PROVIDER_ERROR',
      retryable: true,
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CloudflareError);
    expect(error.code).toBe('PROVIDER_ERROR');
    expect(error.status).toBe(502);
    expect(error.retryable).toBe(true);
    expect(error.cause).toBe(cause);
    expect(error.message).toBe('upstream unavailable');
  });

  it('maps sensible default statuses per code', () => {
    expect(new CloudflareError('x', { code: 'AUTH_REQUIRED' }).status).toBe(401);
    expect(new CloudflareError('x', { code: 'RATE_LIMITED' }).status).toBe(429);
    expect(new CloudflareError('x', { code: 'QUOTA_EXCEEDED' }).status).toBe(402);
    expect(new CloudflareError('x', { code: 'TIMEOUT' }).status).toBe(504);
    expect(new CloudflareError('x', { code: 'NOT_FOUND' }).status).toBe(404);
    expect(new CloudflareError('x', { code: 'VALIDATION_FAILED' }).status).toBe(400);
  });

  it('defaults retryable to false and supports override', () => {
    expect(new CloudflareError('x', { code: 'CONFLICT' }).retryable).toBe(false);
    expect(new CloudflareError('x', { code: 'CONFLICT', retryable: true }).retryable).toBe(true);
  });

  it('serializes to JSON without the stack trace', () => {
    const json = new CloudflareError('boom', { code: 'INTERNAL_ERROR' }).toJSON();
    expect(json).toEqual({
      name: 'CloudflareError',
      code: 'INTERNAL_ERROR',
      message: 'boom',
      status: 500,
      retryable: false,
    });
  });

  it('isCloudflareError narrows unknown values', () => {
    expect(isCloudflareError(new CloudflareError('x', { code: 'TIMEOUT' }))).toBe(true);
    expect(isCloudflareError(new Error('x'))).toBe(false);
    expect(isCloudflareError('x')).toBe(false);
    expect(isCloudflareError(null)).toBe(false);
  });
});
