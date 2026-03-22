/**
 * Cloudflare Utility Functions
 * @description Helper functions for Cloudflare Workers
 */

// ============================================================
// Request Utilities
// ============================================================

/**
 * Parse request body
 */
export async function parseBody<T = unknown>(request: Request): Promise<T> {
  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    return request.json() as Promise<T>;
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const result: Record<string, unknown> = {};
    // FormData.keys() is not available in Workers runtime
    // Use alternative approach with for...of
    const keys: string[] = [];
    formData.forEach((value, key) => {
      if (!keys.includes(key)) {
        keys.push(key);
      }
      result[key] = value;
    });
    return result as T;
  }

  if (contentType.includes('text/')) {
    return request.text() as unknown as T;
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}

/**
 * Get client IP
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown'
  );
}

/**
 * Get client country
 */
export function getClientCountry(request: Request): string | null {
  return request.headers.get('CF-IPCountry');
}

/**
 * Get request timestamp
 */
export function getRequestTimestamp(request: Request): number {
  const cfDate = request.headers.get('CF-Ray');
  if (cfDate) {
    // Extract timestamp from CF-Ray if available
    return Date.now();
  }
  return Date.now();
}

/**
 * Check if request is HTTPS
 */
export function isHTTPS(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'https:';
}

/**
 * Check if request is from specific origin
 */
export function isFromOrigin(request: Request, origin: string): boolean {
  const requestOrigin = request.headers.get('Origin');
  return requestOrigin === origin;
}

/**
 * Get user agent
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('User-Agent') || 'unknown';
}

/**
 * Parse accept language
 */
export function parseAcceptLanguage(request: Request): string[] {
  const acceptLanguage = request.headers.get('Accept-Language') || '';
  return acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0].trim());
}

// ============================================================
// Response Utilities
// ============================================================

/**
 * Create JSON response
 */
export function json<T>(data: T, status: number = 200): Response {
  return Response.json(data, { status });
}

/**
 * Create error response
 */
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

/**
 * Create not found response
 */
export function notFound(message: string = 'Not Found'): Response {
  return error(message, 404);
}

/**
 * Create unauthorized response
 */
export function unauthorized(message: string = 'Unauthorized'): Response {
  return error(message, 401);
}

/**
 * Create forbidden response
 */
export function forbidden(message: string = 'Forbidden'): Response {
  return error(message, 403);
}

/**
 * Create bad request response
 */
export function badRequest(message: string = 'Bad Request', details?: Record<string, unknown>): Response {
  return error(message, 400, details);
}

/**
 * Create redirect response
 */
export function redirect(url: string, status: number = 302): Response {
  return Response.redirect(url, status);
}

/**
 * Create no-content response
 */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Create HTML response
 */
export function html(content: string, status: number = 200): Response {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Create text response
 */
export function text(content: string, status: number = 200): Response {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Create file response
 */
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

/**
 * Stream response
 */
export function stream(
  readableStream: ReadableStream,
  contentType: string = 'application/octet-stream'
): Response {
  return new Response(readableStream, {
    headers: { 'Content-Type': contentType },
  });
}

// ============================================================
// Validation Utilities
// ============================================================

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate phone number (basic)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Sanitize string input
 */
export function sanitize(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Truncate text
 */
export function truncate(text: string, length: number, suffix: string = '...'): string {
  if (text.length <= length) return text;
  return text.substring(0, length - suffix.length) + suffix;
}

/**
 * Slugify text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================
// Cache Utilities
// ============================================================

/**
 * Generate cache key
 */
export function generateCacheKey(request: Request, prefix?: string): string {
  const url = new URL(request.url);
  const parts = [prefix || 'cache', url.pathname];

  // Add query params (sorted for consistency)
  const params: string[] = [];
  // URLSearchParams.keys() is not available in Workers runtime
  url.searchParams.forEach((value, key) => {
    params.push(`${key}=${value}`);
  });
  params.sort();

  if (params.length > 0) {
    parts.push(params.join('&'));
  }

  // Add auth header if present (for user-specific caching)
  const auth = request.headers.get('Authorization');
  if (auth) {
    parts.push(auth.substring(0, 20)); // First 20 chars of auth
  }

  return parts.join(':');
}

/**
 * Generate hash
 */
export async function hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse cache control header
 */
export function parseCacheControl(header: string): {
  maxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
} {
  const directives = header.split(',').map((d) => d.trim());
  const result: Record<string, boolean | number> = {};

  for (const directive of directives) {
    const [key, value] = directive.split('=');

    switch (key.toLowerCase()) {
      case 'max-age':
        result.maxAge = parseInt(value, 10);
        break;
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

  return result as {
    maxAge?: number;
    noCache?: boolean;
    noStore?: boolean;
    mustRevalidate?: boolean;
  };
}

// ============================================================
// Time Utilities
// ============================================================

/**
 * Parse duration string to seconds
 */
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

/**
 * Format duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
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

// ============================================================
// URL Utilities
// ============================================================

/**
 * Build URL with query params
 */
export function buildURL(base: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

/**
 * Parse query params
 */
export function parseQueryParams(url: string): Record<string, string> {
  const params = new URL(url).searchParams;
  const result: Record<string, string> = {};
  // URLSearchParams.keys() is not available in Workers runtime
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Join URL paths
 */
export function joinPath(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

// ============================================================
// Encoding Utilities
// ============================================================

/**
 * Base64 encode
 */
export function base64Encode(input: string): string {
  return btoa(input);
}

/**
 * Base64 decode
 */
export function base64Decode(input: string): string {
  return atob(input);
}

/**
 * Base64 URL encode
 */
export function base64URLEncode(input: string): string {
  return base64Encode(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL decode
 */
export function base64URLDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

  while (base64.length % 4) {
    base64 += '=';
  }

  return base64Decode(base64);
}

/**
 * URL safe encode
 */
export function urlSafeEncode(input: string): string {
  return encodeURIComponent(input);
}

/**
 * URL safe decode
 */
export function urlSafeDecode(input: string): string {
  return decodeURIComponent(input);
}

// ============================================================
// Array Utilities
// ============================================================

/**
 * Chunk array
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Shuffle array
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Unique array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array by key
 */
export function groupBy<T>(
  array: T[],
  key: keyof T
): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

// ============================================================
// Object Utilities
// ============================================================

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Array<Partial<Record<string, any>>>
): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = (target as any)[key];

      if (isObject(sourceValue)) {
        if (!targetValue) {
          (target as any)[key] = {};
        }
        deepMerge((target as any)[key], sourceValue);
      } else {
        (target as any)[key] = sourceValue;
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Pick properties from object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      (result as any)[key] = obj[key];
    }
  });
  return result;
}

/**
 * Merge multiple objects
 */
export function merge<T extends object>(target: T, ...sources: Array<Partial<T>>): T {
  return Object.assign(target, ...sources);
}

/**
 * Omit properties from object
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result as Omit<T, K>;
}

/**
 * Clone object
 */
export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================
// Random Utilities
// ============================================================

/**
 * Generate random string
 */
export function randomString(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random ID
 */
export function randomID(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Random item from array
 */
export function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Random number in range
 */
export function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// Type Guards
// ============================================================

/**
 * Check if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if value is empty
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}
