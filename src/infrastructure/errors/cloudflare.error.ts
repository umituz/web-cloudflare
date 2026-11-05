
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
  readonly code: CloudflareErrorCode;
  readonly status?: number;
  readonly retryable?: boolean;
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

export function isCloudflareError(error: unknown): error is CloudflareError {
  return error instanceof CloudflareError;
}
