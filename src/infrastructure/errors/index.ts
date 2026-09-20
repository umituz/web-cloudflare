/**
 * Cloudflare Infrastructure Errors
 * Shared error convention for all domains.
 */

export {
  CloudflareError,
  isCloudflareError,
} from './cloudflare.error';
export type {
  CloudflareErrorCode,
  CloudflareErrorOptions,
} from './cloudflare.error';
