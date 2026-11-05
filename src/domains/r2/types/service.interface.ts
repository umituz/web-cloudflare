
import type { R2Object, R2ListOptions, R2ListResult, R2PutOptions, R2PresignedURL } from '../entities';
import type { GeneratedAssetMetadata } from '../../ai/value-objects';

export interface R2ObjectHttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
}

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
  range?: { start: number; end: number };
}

export interface IR2Service {
  get(key: string, binding?: string): Promise<R2Object | null>;
  head(key: string, options?: R2GetOptions): Promise<R2ObjectMetadata | null>;
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
