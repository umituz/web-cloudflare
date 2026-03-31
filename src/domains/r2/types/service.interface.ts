/**
 * R2 Service Interface
 */

import type { R2Object, R2ListOptions, R2ListResult, R2PutOptions, R2PresignedURL } from '../entities';
import type { GeneratedAssetMetadata } from '../../ai/value-objects';

export interface IR2Service {
  get(key: string, binding?: string): Promise<R2Object | null>;
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
