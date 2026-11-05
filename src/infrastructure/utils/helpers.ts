

export async function parseBody<T = unknown>(request: Request): Promise<T> {
  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    return request.json() as Promise<T>;
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const result: Record<string, unknown> = {};
    const seenKeys = new Set<string>();

    formData.forEach((value, key) => {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        result[key] = value;
      }
    });

    return result as T;
  }

  if (contentType.includes('text/')) {
    return request.text() as unknown as T;
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}

export function getClientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown'
  );
}

export function getClientCountry(request: Request): string | null {
  return request.headers.get('CF-IPCountry');
}

export function getRequestTimestamp(_request: Request): number {
  return Date.now();
}

export function isHTTPS(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'https:';
}

export function isFromOrigin(request: Request, origin: string): boolean {
  const requestOrigin = request.headers.get('Origin');
  return requestOrigin === origin;
}

export function getUserAgent(request: Request): string {
  return request.headers.get('User-Agent') || 'unknown';
}

export function parseAcceptLanguage(request: Request): string[] {
  const acceptLanguage = request.headers.get('Accept-Language') || '';
  return acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0].trim());
}


export function json<T>(data: T, status: number = 200): Response {
  return Response.json(data, { status });
}

export function error(
  message: string,
  status: number = 500,
  details?: Record<string, unknown>
): Response {
  return Response.json(
    {
      error: message,
      status,
      ...(details && { details }),
    },
    { status }
  );
}

export function notFound(message: string = 'Not Found'): Response {
  return error(message, 404);
}

export function unauthorized(message: string = 'Unauthorized'): Response {
  return error(message, 401);
}

export function forbidden(message: string = 'Forbidden'): Response {
  return error(message, 403);
}

export function badRequest(message: string = 'Bad Request', details?: Record<string, unknown>): Response {
  return error(message, 400, details);
}

export function redirect(url: string, status: number = 302): Response {
  return Response.redirect(url, status);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function html(content: string, status: number = 200): Response {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export function text(content: string, status: number = 200): Response {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export function file(
  content: ArrayBuffer,
  contentType: string,
  filename?: string
): Response {
  const headers = new Headers({ 'Content-Type': contentType });

  if (filename) {
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  }

  return new Response(content, { headers });
}

export function stream(
  readableStream: ReadableStream,
  contentType: string = 'application/octet-stream'
): Response {
  return new Response(readableStream, {
    headers: { 'Content-Type': contentType },
  });
}


export function isValidEmail(email: string): boolean {
  if (!email || email.length < 3 || email.length > 254) return false;
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@')) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidURL(url: string): boolean {
  if (!url || url.length < 3) return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidUUID(uuid: string): boolean {
  if (!uuid || uuid.length !== 36) return false;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidPhone(phone: string): boolean {
  if (!phone || phone.length < 10) return false;

  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function sanitize(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function truncate(text: string, length: number, suffix: string = '...'): string {
  if (text.length <= length) return text;
  return text.substring(0, length - suffix.length) + suffix;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


export function generateCacheKey(request: Request, prefix?: string): string {
  const url = new URL(request.url);
  const parts = [prefix || 'cache', url.pathname];

  if (url.search) {
    const params: string[] = [];
    url.searchParams.forEach((value, key) => {
      params.push(`${key}=${value}`);
    });
    params.sort();
    if (params.length > 0) {
      parts.push(params.join('&'));
    }
  }

  const auth = request.headers.get('Authorization');
  if (auth) {
    parts.push(auth.substring(0, 20));
  }

  return parts.join(':');
}

export async function hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function parseCacheControl(header: string): {
  maxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
} {
  const directives = header.split(',').map((d) => d.trim());
  const result: {
    maxAge?: number;
    noCache?: boolean;
    noStore?: boolean;
    mustRevalidate?: boolean;
  } = {};

  for (const directive of directives) {
    const [key, value] = directive.split('=');

    switch (key.toLowerCase()) {
      case 'max-age': {
        const parsed = parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          result.maxAge = parsed;
        }
        break;
      }
      case 'no-cache':
        result.noCache = true;
        break;
      case 'no-store':
        result.noStore = true;
        break;
      case 'must-revalidate':
        result.mustRevalidate = true;
        break;
    }
  }

  return result;
}


export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}


export function buildURL(base: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function parseQueryParams(url: string): Record<string, string> {
  const params = new URL(url).searchParams;
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function joinPath(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}


export function base64Encode(input: string): string {
  return btoa(input);
}

export function base64Decode(input: string): string {
  return atob(input);
}

export function base64URLEncode(input: string): string {
  return base64Encode(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64URLDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

  while (base64.length % 4) {
    base64 += '=';
  }

  return base64Decode(base64);
}

export function urlSafeEncode(input: string): string {
  return encodeURIComponent(input);
}

export function urlSafeDecode(input: string): string {
  return decodeURIComponent(input);
}


export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function groupBy<T>(
  array: T[],
  key: keyof T
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of array) {
    const group = String(item[key]);
    (result[group] ??= []).push(item);
  }
  return result;
}


function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

export function deepClone<T>(obj: T): T {
  if (typeof structuredClone !== 'undefined') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

export const clone = deepClone;

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<Record<string, unknown>>>
): T {
  if (!sources.length) return { ...target };
  const source = sources[0];
  const remaining = sources.slice(1);

  if (!isObject(target) || !isObject(source)) {
    return deepMerge(target, ...remaining);
  }

  const output: Record<string, unknown> = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = (target as Record<string, unknown>)[key];

    if (isObject(sourceValue) && isObject(targetValue)) {
      output[key] = deepMerge(targetValue, sourceValue);
    } else if (isObject(sourceValue)) {
      output[key] = deepMerge({}, sourceValue);
    } else {
      output[key] = sourceValue;
    }
  }

  return deepMerge(output as T, ...remaining) as T;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      (result as Record<string, unknown>)[key as string] = obj[key as keyof T];
    }
  });
  return result;
}

export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result as Omit<T, K>;
}


export function randomString(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    let byte = bytes[i];
    while (byte >= 248) {
      const extra = new Uint8Array(1);
      crypto.getRandomValues(extra);
      byte = extra[0];
    }
    result += chars.charAt(byte % 62);
  }
  return result;
}

export function randomID(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = randomString(10).toLowerCase();
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

export function generateId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}
