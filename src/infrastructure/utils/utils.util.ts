/**
 * Utility Functions
 * @description Common utility functions for Cloudflare operations
 *
 * @deprecated The "util" / "utils" naming is prohibited by the package's
 * domain conventions. New code should compose the same helpers from the
 * dedicated modules (e.g. `infrastructure/utils/helpers.ts`) and the
 * value objects under `domains/shared/value-objects` (e.g. `Email`,
 * `URLValue`, `TTL`).
 *
 * This file is kept for backward compatibility with consumers that import
 * `dateUtils`, `cacheUtils`, `validationUtils`, or `transformUtils` from
 * `@umituz/web-cloudflare/utils`. New consumers should not depend on it.
 */

/**
 * Date utilities
 */
export const dateUtils = {
  /**
   * Calculate expiration time from TTL
   */
  getExpirationTime(ttl: number): number {
    return Math.floor(Date.now() / 1000) + ttl;
  },

  /**
   * Convert timestamp to Date
   */
  fromTimestamp(timestamp: number): Date {
    return new Date(timestamp * 1000);
  },

  /**
   * Calculate remaining TTL from expiration
   */
  getRemainingTTL(expiration: number): number {
    return Math.max(0, expiration - Math.floor(Date.now() / 1000));
  },
};

/**
 * Cache utilities
 */
export const cacheUtils = {
  /**
   * Generate cache key from parts
   */
  generateKey(...parts: readonly string[]): string {
    return parts.join(":");
  },

  /**
   * Parse cache key
   */
  parseKey(key: string): readonly string[] {
    return key.split(":");
  },

  /**
   * Generate cache control header
   */
  getCacheControl(maxAge: number, immutable = false): string {
    const directives = [`public`, `max-age=${maxAge}`];
    if (immutable) {
      directives.push("immutable");
    }
    return directives.join(", ");
  },
};

/**
 * Validation utilities
 */
export const validationUtils = {
  /**
   * Validate KV key
   */
  isValidKVKey(key: string): boolean {
    return /^[\w\-.:]+$/.test(key) && key.length <= 512;
  },

  /**
   * Validate R2 object key
   */
  isValidR2Key(key: string): boolean {
    return key.length > 0 && key.length <= 1024 && !key.includes("//");
  },

  /**
   * Validate image file type
   */
  isValidImageType(type: string): boolean {
    return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(type);
  },

  /**
   * Validate image size
   */
  isValidImageSize(size: number, maxSize = 10 * 1024 * 1024): boolean {
    return size > 0 && size <= maxSize;
  },
};

/**
 * Transformation utilities
 */
export const transformUtils = {
  /**
   * Convert file to blob
   */
  async fileToBlob(file: File): Promise<Blob> {
    return file;
  },

  /**
   * Convert blob to array buffer
   */
  async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return await blob.arrayBuffer();
  },

  /**
   * Convert readable stream to blob
   */
  async streamToBlob(stream: ReadableStream): Promise<Blob> {
    const reader = stream.getReader();
    const chunks: BlobPart[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Convert Uint8Array to BlobPart
      chunks.push(value as BlobPart);
    }

    return new Blob(chunks);
  },

  /**
   * Generate image transformation URL
   */
  generateTransformURL(baseUrl: string, transform: {
    width?: number;
    height?: number;
    fit?: string;
    format?: string;
    quality?: number;
  }): string {
    const url = new URL(baseUrl);
    const params = url.searchParams;

    if (transform.width) params.set("width", transform.width.toString());
    if (transform.height) params.set("height", transform.height.toString());
    if (transform.fit) params.set("fit", transform.fit);
    if (transform.format) params.set("format", transform.format);
    if (transform.quality) params.set("quality", transform.quality.toString());

    return url.toString();
  },
};
