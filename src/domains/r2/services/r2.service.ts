import type {
  R2Object,
  R2ListOptions,
  R2ListResult,
  R2PutOptions,
  R2PresignedURL,
} from '../entities';
import type { IR2Service, R2ObjectMetadata, R2GetOptions } from '../types/service.interface';
import type { GeneratedAssetMetadata } from '../../ai/value-objects';
import type { D1Service } from '../../d1/services/d1.service';
import { validationUtils } from '../../../infrastructure/utils';

// ============================================================
// R2 Metadata Types
// ============================================================

export interface R2MetadataWithD1 {
  /** R2 custom metadata */
  customMetadata?: Record<string, string>;
  /** HTTP metadata */
  httpMetadata?: R2Conditions;

  /** D1 auto-save configuration */
  saveToD1?: {
    table: string;
    foreignKey?: string;
    additionalData?: Record<string, unknown>;
  };
}

export interface R2Conditions {
  contentType?: string;
  contentLanguage?: string;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
}

// R2 metadata types
export interface R2CustomMetadata {
  [key: string]: string;
}

/**
 * HTTP metadata for R2 uploads
 * @description Standard HTTP headers for R2 objects
 */
export interface R2HTTPMetadata {
  /** Content-Type header */
  contentType?: string;
  /** Content-Encoding header */
  contentEncoding?: string;
  /** Content-Language header */
  contentLanguage?: string;
  /** Cache-Control header */
  cacheControl?: string;
  /** Content-Disposition header */
  contentDisposition?: string;
}

// R2UploadOptions base interface (from Cloudflare Workers types)
export interface R2UploadOptions {
  /** Only upload if the object does not already exist */
  onlyIf?: { etag?: string; uploadTag?: string };
  /** HTTP headers to use when uploading */
  httpMetadata?: R2HTTPMetadata;
  /** Custom metadata key-value pairs */
  customMetadata?: R2CustomMetadata;
  /** Binding name */
  binding?: string;
}

export interface R2UploadOptionsExtended extends R2UploadOptions {
  saveToD1?: R2MetadataWithD1['saveToD1'];
}

// ============================================================
// Multipart Upload Types
// ============================================================

export interface R2MultipartUpload {
  uploadId: string;
  key: string;
  createdAt: number;
}

export interface R2UploadedPart {
  partNumber: number;
  etag: string;
}

// ============================================================
// R2 Cache Options
// ============================================================

export interface R2CacheOptions {
  readonly bucket: string;
  readonly customDomain?: string;
}

export class R2Service implements IR2Service {
  private buckets: Map<string, R2Bucket> = new Map();
  private customDomain: string | null = null;
  private d1Service?: D1Service;

  initialize(options: R2CacheOptions): void {
    this.customDomain = options.customDomain ?? null;
  }

  bindD1Service(d1Service: D1Service): void {
    this.d1Service = d1Service;
  }

  bindBucket(name: string, bucket: R2Bucket): void {
    this.buckets.set(name, bucket);
  }

  private getBucket(binding?: string): R2Bucket {
    const name = binding || "default";
    const bucket = this.buckets.get(name);
    if (!bucket) {
      throw new Error(`R2 bucket "${name}" not bound`);
    }
    return bucket;
  }

  // ============================================================
  // Enhanced Get with Public URL
  // ============================================================

  /**
   * Get public URL for an object
   */
  getPublicURL(
    key: string,
    options?: { binding?: string; customDomain?: string }
  ): string {
    const domain = options?.customDomain || this.customDomain || null;

    if (domain) {
      return `https://${domain}/${key}`;
    }

    // Default R2 public URL pattern
    const binding = options?.binding || 'default';
    return `https://r2.fl.dev/${binding}/${key}`;
  }

  /**
   * Get signed URL for private objects (using presigned URL)
   */
  async getSignedURL(
    key: string,
    expiresIn = 3600,
    binding?: string
  ): Promise<string> {
    const presigned = await this.getPresignedURL(key, expiresIn, { binding });
    return presigned.url || '';
  }

  async get(key: string, binding?: string): Promise<R2Object | null> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    const bucket = this.getBucket(binding);
    const object = await bucket.get(key);

    if (!object) return null;

    return {
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
    };
  }

  /**
   * Fetch object metadata without downloading the body.
   * Returns null when the object is missing. Cloudflare's R2 head() returns
   * null on miss rather than throwing.
   */
  async head(key: string, options?: R2GetOptions): Promise<R2ObjectMetadata | null> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    const bucket = this.getBucket(options?.binding);
    const object = await bucket.head(key);

    if (!object) return null;

    return {
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata
        ? {
            contentType: object.httpMetadata.contentType,
            contentLanguage: object.httpMetadata.contentLanguage,
            contentDisposition: object.httpMetadata.contentDisposition,
            contentEncoding: object.httpMetadata.contentEncoding,
            cacheControl: object.httpMetadata.cacheControl,
          }
        : undefined,
      customMetadata: object.customMetadata,
      etag: object.etag,
      httpEtag: object.httpEtag,
      checksums: object.checksums
        ? {
            md5: object.checksums.md5,
            sha1: object.checksums.sha1,
            sha256: object.checksums.sha256,
          }
        : undefined,
      range: object.range && 'offset' in object.range && object.range.offset !== undefined && object.range.length !== undefined
        ? { offset: object.range.offset, length: object.range.length }
        : undefined,
      storageClass: object.storageClass,
    };
  }

  /**
   * Fetch object body as ArrayBuffer. Returns null on miss.
   * Supports R2 range requests via the optional `range` parameter.
   * Translates the public `{ start, end }` (inclusive) shape to Cloudflare's
   * `{ offset, length }` (offset + length) range format.
   */
  async getBody(key: string, options?: R2GetOptions): Promise<ArrayBuffer | null> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    const bucket = this.getBucket(options?.binding);
    const r2Range = options?.range
      ? { offset: options.range.start, length: options.range.end - options.range.start + 1 }
      : undefined;

    const object = await bucket.get(key, r2Range ? { range: r2Range } : undefined);
    if (!object) return null;

    return await object.arrayBuffer();
  }

  async put(
    key: string,
    data: ReadableStream | ArrayBuffer | string,
    options?: R2UploadOptions
  ): Promise<void> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    const bucket = this.getBucket(options?.binding as string | undefined);

    await bucket.put(key, data, {
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    });
  }

  /**
   * Put with metadata and auto-save to D1
   */
  async putWithMetadata(
    key: string,
    data: ReadableStream | ArrayBuffer | string,
    metadata: R2MetadataWithD1,
    options?: R2UploadOptions
  ): Promise<void> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    // Upload to R2
    await this.put(key, data, {
      ...options,
      customMetadata: metadata.customMetadata,
      httpMetadata: metadata.httpMetadata,
    });

    // Auto-save to D1 if configured
    if (metadata.saveToD1 && this.d1Service) {
      const { table, foreignKey, additionalData } = metadata.saveToD1;

      // Prepare data for D1
      const d1Data: Record<string, unknown> = {
        key,
        size: typeof data === 'string' ? data.length : data instanceof ArrayBuffer ? data.byteLength : 0,
        uploadedAt: Date.now(),
        customMetadata: metadata.customMetadata ? JSON.stringify(metadata.customMetadata) : null,
        ...additionalData,
      };

      if (foreignKey) {
        d1Data[foreignKey] = key;
      }

      await this.d1Service.insert(table, d1Data);
    }
  }

  async uploadGeneratedAsset(
    buffer: ArrayBuffer,
    metadata: GeneratedAssetMetadata,
    options?: {
      binding?: string;
      keyPrefix?: string;
      saveToD1?: boolean;
      tableName?: string;
    }
  ): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    const prefix = options?.keyPrefix || 'generated';
    const extension = metadata.getFileExtension();
    const key = `${prefix}/${metadata.model}/${timestamp}-${random}.${extension}`;

    const customMetadata: Record<string, string> = {
      model: metadata.model,
      contentType: metadata.contentType,
      generatedAt: timestamp.toString(),
    };

    if (metadata.provider) {
      customMetadata.provider = metadata.provider;
    }

    if (metadata.prompt) {
      customMetadata.prompt = metadata.prompt.substring(0, 500);
    }

    if (metadata.userId) {
      customMetadata.userId = metadata.userId;
    }

    if (metadata.tags && metadata.tags.length > 0) {
      customMetadata.tags = metadata.tags.join(',');
    }

    const d1Config = options?.saveToD1 && this.d1Service ? {
      table: options?.tableName || 'generated_assets',
      additionalData: {
        model: metadata.model,
        provider: metadata.provider,
        prompt: metadata.prompt,
        userId: metadata.userId,
        tags: metadata.tags?.join(','),
        contentType: metadata.contentType,
      },
    } : undefined;

    await this.putWithMetadata(key, buffer, {
      customMetadata,
      httpMetadata: {
        contentType: metadata.contentType,
        cacheControl: 'public, max-age=31536000',
      },
      saveToD1: d1Config,
    }, {
      binding: options?.binding,
    });

    return key;
  }

  /**
   * Batch upload multiple generated assets
   * @description Upload multiple assets in parallel
   * @param assets Array of assets to upload
   * @param options Upload options
   * @returns Array of uploaded keys
   */
  async uploadGeneratedAssets(
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
  ): Promise<string[]> {
    const uploads = assets.map(asset =>
      this.uploadGeneratedAsset(asset.buffer, asset.metadata, options)
    );

    return Promise.all(uploads);
  }

  // ============================================================
  // Original R2 Methods
  // ============================================================

  async delete(key: string, binding?: string): Promise<boolean> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    const bucket = this.getBucket(binding);
    await bucket.delete(key);

    return true;
  }

  async list(options?: R2ListOptions & { binding?: string }): Promise<R2ListResult> {
    const bucket = this.getBucket(options?.binding as string | undefined);
    const listed = await bucket.list({
      limit: options?.limit,
      prefix: options?.prefix,
      cursor: options?.cursor,
    });

    // Handle cursor property which may not be in the type definition
    type ListResultWithCursor = typeof listed & { cursor?: string };
    const cursor = (listed as ListResultWithCursor).cursor;

    return {
      objects: listed.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
      })),
      cursor: cursor,
    };
  }

  async getPresignedURL(
    key: string,
    expiresIn = 3600,
    options?: { method?: 'GET' | 'PUT'; binding?: string }
  ): Promise<R2PresignedURL> {
    // Real presigned URLs require AWS SigV4 signing using R2 access keys.
    // We don't ship credentials inside the Worker, so this implementation
    // returns a *public* URL (only useful when the bucket/object is public).
    //
    // For private buckets, consumers should:
    //   - Use Cloudflare's S3-compatible API with @aws-sdk/client-s3
    //     signed with R2 access keys, or
    //   - Use R2's public bucket + custom domain pattern.
    //
    // Throwing would be more defensive, but returning a public URL keeps
    // existing call sites functional against public buckets while making
    // the limitation explicit in the docs and the warning below.
    const expires = Date.now() + expiresIn * 1000;
    const url = this.getPublicURL(key, { binding: options?.binding });

    // eslint-disable-next-line no-console
    console.warn(
      '[R2Service.getPresignedURL] returning public URL — supply R2 access keys and SigV4 for private bucket access.'
    );

    return { url, expires };
  }

  // ============================================================
  // Multipart Upload Support
  // ============================================================
  //
  // The native R2 bindings do not expose an S3-style multipart upload
  // (CreateMultipartUpload / UploadPart / CompleteMultipartUpload). The
  // R2 team recommends using the AWS SDK against the S3-compatible
  // endpoint for that flow. The methods below throw with a clear pointer
  // to that approach so callers cannot accidentally use a stub that
  // silently no-ops.

  /**
   * Create a multipart upload.
   * Throws because R2 bindings do not support S3-style multipart APIs.
   * Use the AWS SDK against the S3-compatible endpoint instead.
   */
  async createMultipartUpload(
    _key: string,
    _options?: R2UploadOptions
  ): Promise<string> {
    throw new Error(
      'R2Service.createMultipartUpload: R2 bindings do not expose S3-style multipart uploads. ' +
      'Use @aws-sdk/client-s3 against the R2 S3-compatible endpoint, or use r2Service.put() for objects <= 5GB.'
    );
  }

  /**
   * Upload a part in a multipart upload.
   * Throws — see {@link createMultipartUpload}.
   */
  async uploadPart(
    _uploadId: string,
    _partNumber: number,
    _data: ArrayBuffer | ReadableStream | string,
    _binding?: string
  ): Promise<string> {
    throw new Error(
      'R2Service.uploadPart: R2 bindings do not expose S3-style multipart uploads. ' +
      'Use @aws-sdk/client-s3 against the R2 S3-compatible endpoint.'
    );
  }

  /**
   * Complete a multipart upload.
   * Throws — see {@link createMultipartUpload}.
   */
  async completeMultipartUpload(
    _uploadId: string,
    _parts: R2UploadedPart[],
    _binding?: string
  ): Promise<void> {
    throw new Error(
      'R2Service.completeMultipartUpload: R2 bindings do not expose S3-style multipart uploads. ' +
      'Use @aws-sdk/client-s3 against the R2 S3-compatible endpoint.'
    );
  }

  /**
   * Abort a multipart upload.
   * Throws — see {@link createMultipartUpload}.
   */
  async abortMultipartUpload(
    _uploadId: string,
    _binding?: string
  ): Promise<void> {
    throw new Error(
      'R2Service.abortMultipartUpload: R2 bindings do not expose S3-style multipart uploads. ' +
      'Use @aws-sdk/client-s3 against the R2 S3-compatible endpoint.'
    );
  }

  /**
   * Upload helpers
   */
  async uploadFile(file: File, key?: string, options?: R2UploadOptions, binding?: string): Promise<void> {
    const objectKey = key || `uploads/${Date.now()}-${file.name}`;

    await this.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        ...options?.httpMetadata,
      },
      customMetadata: options?.customMetadata,
    });
  }

  async uploadFromURL(url: string, key: string, binding?: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const body = response.body;
    if (!body) {
      throw new Error(`Failed to read response body`);
    }

    await this.put(key, body, {
      httpMetadata: {
        contentType: response.headers.get("Content-Type") || undefined,
      },
      binding,
    });
  }

  /**
   * Delete helpers
   */
  async deleteMultiple(keys: readonly string[], binding?: string): Promise<void> {
    const bucket = this.getBucket(binding);

    await Promise.all(keys.map((key) => bucket.delete(key)));
  }

  async deletePrefix(prefix: string, binding?: string): Promise<void> {
    const list = await this.list({ prefix, binding });

    await this.deleteMultiple(list.objects.map((obj) => obj.key), binding);

    if (list.cursor) {
      await this.deletePrefix(prefix, binding);
    }
  }
}

// Export singleton instance
export const r2Service = new R2Service();
