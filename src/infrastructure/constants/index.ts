/**
 * Cloudflare Constants
 * Subpath: @umituz/web-cloudflare/infrastructure
 */

export const DEFAULT_TTL = 3600; // 1 hour in seconds
export const MAX_CACHE_AGE = 5184000; // 60 days in seconds
export const DEFAULT_KV_LIMIT = 1000;
export const DEFAULT_R2_UPLOAD_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_SIGNED_URL_EXPIRATION = 3600; // 1 hour
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"] as const;
export const CLOUDFLARE_API_ENDPOINT = "https://api.cloudflare.com/client/v4";
