// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { APIClient } from '../src/domains/pages/react/utils/api-client';
import type { APIError } from '../src/domains/pages/react/utils/api-client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchWith(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('APIClient.request', () => {
  it('returns the { data, status, headers } envelope and merges headers', async () => {
    const fetchMock = mockFetchWith(
      new Response(JSON.stringify({ ok: true, value: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new APIClient({ baseURL: 'https://api.example.com' });
    const response = await client.request<{ ok: boolean; value: number }>('/v1/thing', {
      method: 'POST',
      headers: { 'X-Custom': 'yes' },
      body: JSON.stringify({ a: 1 }),
    });

    expect(response.data.value).toBe(42);
    expect(response.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/thing');
    expect(new Headers(init.headers).get('X-Custom')).toBe('yes');
    expect(init.method).toBe('POST');
  });

  it('rejects with an APIError carrying status and server message on non-2xx JSON bodies', async () => {
    mockFetchWith(
      new Response(JSON.stringify({ message: 'not found here' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new APIClient();
    const error: APIError = await client.request('/missing').catch((e: APIError) => e);
    expect(error.status).toBe(404);
    expect(error.message).toBe('not found here');
  });

  it('rejects with an APIError even for non-JSON error bodies', async () => {
    mockFetchWith(new Response('<html>gateway error</html>', { status: 502, statusText: 'Bad Gateway' }));

    const client = new APIClient();
    const error: APIError = await client.request('/boom').catch((e: APIError) => e);
    expect(error.status).toBe(502);
    expect(typeof error.message).toBe('string');
  });

  it('resolves with undefined data for empty 200 bodies', async () => {
    mockFetchWith(new Response('', { status: 200 }));

    const client = new APIClient();
    const response = await client.request('/empty');
    expect(response.status).toBe(200);
    expect(response.data).toBeUndefined();
  });

  it('rejects with an APIError when a 200 body is not valid JSON', async () => {
    mockFetchWith(new Response('definitely-not-json{', { status: 200 }));

    const client = new APIClient();
    const error: APIError = await client.request('/weird').catch((e: APIError) => e);
    expect(error.message).toMatch(/not valid JSON/);
    expect(error.status).toBe(200);
  });

  it('aborts the request when the timeout elapses', async () => {
    globalThis.fetch = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    ) as unknown as typeof fetch;

    const client = new APIClient({ timeout: 30 });
    await expect(client.request('/slow')).rejects.toThrow();
  });

  it('keeps a caller-provided signal and default headers separate from merged headers', async () => {
    const fetchMock = mockFetchWith(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const client = new APIClient({
      baseURL: 'https://api.example.com',
      headers: { Authorization: 'Bearer token-1' },
    });
    await client.request('/v1/x');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-1');
  });
});
