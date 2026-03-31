/**
 * R2 Service Interface
 * @description Abstract interface for R2 storage operations
 */

import type { R2Object, R2ListOptions, R2ListResult, R2PutOptions, R2PresignedURL } from '../entities';

/**
 * Metadata for AI-generated or programmatically generated assets ⭐ NEW v1.6.5
 * @description Generic interface for any generated content (audio, image, video, text, etc.)
 */
export interface GeneratedAssetMetadata {
  /** Model or algorithm used to generate the asset */
  model: string;
  /** Provider (e.g., 'huggingface', 'workers-ai', 'openai') */
  provider?: string;
  /** Input prompt or parameters used */
  prompt?: string;
  /** Content type (MIME type) */
  contentType: string;
  /** Additional metadata */
  additionalData?: Record<string, unknown>;
  /** User ID for tracking */
  userId?: string;
  /** Tags for categorization */
  tags?: string[];
}

export interface IR2Service {
  get(key: string, binding?: string): Promise<R2Object | null>;
  put(key: string, data: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<void>;
  delete(key: string, binding?: string): Promise<boolean>;
  list(options?: R2ListOptions): Promise<R2ListResult>;
  getPresignedURL(key: string, expiresIn?: number): Promise<R2PresignedURL>;

  /**
   * Upload a generically generated asset (AI-generated or programmatic) ⭐ NEW v1.6.5
   * @description Generic method for any AI-generated content (audio, image, video, etc.)
   * @param buffer Asset data as ArrayBuffer
   * @param metadata Asset metadata
   * @param options Upload options
   * @returns The R2 key of the uploaded asset
   */
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

  /**
   * Batch upload multiple generated assets ⭐ NEW v1.6.5
   * @description Upload multiple assets in parallel
   * @param assets Array of assets to upload
   * @param options Upload options
   * @returns Array of uploaded keys
   */
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

  /**
   * Get public URL for an object
   */
  getPublicURL(
    key: string,
    options?: { binding?: string; customDomain?: string }
  ): string;

  /**
   * Get signed URL for private objects
   */
  getSignedURL(
    key: string,
    expiresIn?: number,
    binding?: string
  ): Promise<string>;

  /**
   * Put with metadata and auto-save to D1
   */
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
