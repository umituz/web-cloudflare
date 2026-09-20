import { describe, it, expect } from 'vitest';
import { cors, addCorsHeaders } from '../src/domains/middleware/services/cors.service';
import type { MiddlewareCORSConfig } from '../src/domains/middleware/entities';

const baseConfig: MiddlewareCORSConfig = {
  enabled: true,
  allowedOrigins: ['https://app.example.com'],
  allowedMethods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};

function requestFor(origin: string | null, method = 'GET'): Request {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  return new Request('https://api.example.com/v1/data', { method, headers });
}

describe('cors preflight', () => {
  it('grants the exact allowed origin and sets Vary: Origin', async () => {
    const response = await cors(requestFor('https://app.example.com', 'OPTIONS'), baseConfig);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response!.headers.get('Vary')).toContain('Origin');
  });

  it('returns 403 for a disallowed origin instead of granting a configured one', async () => {
    const response = await cors(requestFor('https://evil.example.net', 'OPTIONS'), baseConfig);
    expect(response!.status).toBe(403);
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns 403 when no Origin header is present on preflight', async () => {
    const response = await cors(requestFor(null, 'OPTIONS'), baseConfig);
    expect(response!.status).toBe(403);
  });

  it('returns wildcard for "*" config without credentials', async () => {
    const response = await cors(requestFor('https://anything.example', 'OPTIONS'), {
      ...baseConfig,
      allowedOrigins: ['*'],
    });
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('refuses wildcard when credentials are requested (browsers reject it)', async () => {
    const response = await cors(requestFor('https://app.example.com', 'OPTIONS'), {
      ...baseConfig,
      allowCredentials: true,
      allowedOrigins: ['*'],
    });
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('cors on plain requests', () => {
  it('returns null (no preflight) for non-OPTIONS methods', async () => {
    const response = await cors(requestFor('https://app.example.com'), baseConfig);
    expect(response).toBeNull();
  });
});

describe('addCorsHeaders', () => {
  it('adds allow-origin for allowed origin', () => {
    const response = addCorsHeaders(
      requestFor('https://app.example.com'),
      new Response('ok'),
      baseConfig
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
  });

  it('adds NO allow-origin header for disallowed origin', () => {
    const response = addCorsHeaders(
      requestFor('https://evil.example.net'),
      new Response('ok'),
      baseConfig
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('passes the response through untouched when disabled', () => {
    const original = new Response('ok', { status: 201 });
    const response = addCorsHeaders(requestFor('https://app.example.com'), original, {
      ...baseConfig,
      enabled: false,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
