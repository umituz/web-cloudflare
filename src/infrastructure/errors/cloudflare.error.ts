/**
 * Shared error convention for @umituz/web-cloudflare.
 *
 * Services in this package throw plain `Error` in many places for backwards
 * compatibility. New code should throw `CloudflareError` (or a subclass) so
 * callers can branch on `code` / `retryable` without string-matching messages.
 *
 * ```ts
 * try {
 *   await d1Service.query(...);
 * } catch (error) {
 *   if (error instanceof CloudflareError && error.retryable) {
 *     // safe to retry with backoff
 *   }
 * }
 * ```
 */

export type CloudflareErrorCode =
  | 'AUTH_FAILED'
  | 'AUTH_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'STORAGE_ERROR'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR';

export interface CloudflareErrorOptions {
  /** Machine-readable, stable error code (never localized, never changed). */
  readonly code: CloudflareErrorCode;
  /** HTTP status this error maps to (defaults per code; override when needed). */
  readonly status?: number;
  /** Whether a caller may sensibly retry the same operation. */
  readonly retryable?: boolean;
  /** The underlying cause (e.g. a fetch TypeError). */
  readonly cause?: unknown;
}

const DEFAULT_STATUS_BY_CODE: Record<CloudflareErrorCode, number> = {
  AUTH_FAILED: 401,
  AUTH_REQUIRED: 401,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 402,
  TIMEOUT: 504,
  PROVIDER_ERROR: 502,
  STORAGE_ERROR: 500,
  CONFIG_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export class CloudflareError extends Error {
  readonly code: CloudflareErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, options: CloudflareErrorOptions) {
    super(message);
    this.name = 'CloudflareError';
    this.code = options.code;
    this.status = options.status ?? DEFAULT_STATUS_BY_CODE[options.code];
    this.retryable = options.retryable ?? false;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    // Maintains a proper prototype chain when targeting ES5 output.
    Object.setPrototypeOf(this, CloudflareError.prototype);
  }

  toJSON(): { name: string; code: CloudflareErrorCode; message: string; status: number; retryable: boolean } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
    };
  }
}

/** Narrow an unknown thrown value to a CloudflareError. */
export function isCloudflareError(error: unknown): error is CloudflareError {
  return error instanceof CloudflareError;
}
