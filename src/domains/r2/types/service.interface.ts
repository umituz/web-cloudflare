/**
 * R2 Service Interface
 */

import type { R2Object, R2ListOptions, R2ListResult, R2PutOptions, R2PresignedURL } from '../entities';
import type { GeneratedAssetMetadata } from '../../ai/value-objects';

/**
 * HTTP metadata shape returned by `head()`.
 * Mirror the Cloudflare R2 metadata fields we actually consume.
 */
export interface R2ObjectHttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
}

/**
 * Low-level object metadata returned by `head()`.
 * Surface the fields used by callers (e.g. range request support,
 * upload timestamp, size) without exposing the full Cloudflare R2Object.
 */
export interface R2ObjectMetadata {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata?: R2ObjectHttpMetadata;
  customMetadata?: Record<string, unknown>;
  etag?: string;
  httpEtag?: string;
  checksums?: { md5?: ArrayBuffer; sha1?: ArrayBuffer; sha256?: ArrayBuffer };
  range?: { offset: number; length: number };
  storageClass?: string;
}

export interface R2GetOptions {
  binding?: string;
  /**
   * Range request expressed as `{ start, end }` (inclusive byte indices).
   * Internally translated to Cloudflare's `{ offset, length }` shape.
   */
  range?: { start: number; end: number };
}

export interface IR2Service {
  get(key: string, binding?: string): Promise<R2Object | null>;
  /**
   * Fetch object metadata without downloading the body.
   * Used for range request validation, ETags, and existence checks.
   */
  head(key: string, options?: R2GetOptions): Promise<R2ObjectMetadata | null>;
  /**
   * Fetch object body as ArrayBuffer.
   * Returns null if the object is missing.
   */
  getBody(key: string, options?: R2GetOptions): Promise<ArrayBuffer | null>;
  put(key: string, data: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<void>;
  delete(key: string, binding?: string): Promise<boolean>;
  list(options?: R2ListOptions): Promise<R2ListResult>;
  getPresignedURL(key: string, expiresIn?: number): Promise<R2PresignedURL>;

  uploadGeneratedAsset(
    buffer: ArrayBuffer,
    metadata: GeneratedAssetMetadata,
    options?: {
      binding?: string;
      keyPrefix?: string;
      saveToD1?: boolean;
      tableName?: string;
    }
  ): Promise<string>;

  uploadGeneratedAssets(
    assets: Array<{
      buffer: ArrayBuffer;
      metadata: GeneratedAssetMetadata;
    }>,
    options?: {
      binding?: string;
      keyPrefix?: string;
      saveToD1?: boolean;
      tableName?: string;
    }
  ): Promise<string[]>;

  getPublicURL(
    key: string,
    options?: { binding?: string; customDomain?: string }
  ): string;

  getSignedURL(
    key: string,
    expiresIn?: number,
    binding?: string
  ): Promise<string>;

  putWithMetadata(
    key: string,
    data: ReadableStream | ArrayBuffer | string,
    metadata: {
      customMetadata?: Record<string, string>;
      httpMetadata?: {
        contentType?: string;
        contentLanguage?: string;
        cacheControl?: string;
        contentDisposition?: string;
        contentEncoding?: string;
      };
      saveToD1?: {
        table: string;
        foreignKey?: string;
        additionalData?: Record<string, unknown>;
      };
    },
    options?: R2PutOptions
  ): Promise<void>;
}
