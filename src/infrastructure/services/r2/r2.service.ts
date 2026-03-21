/**
 * R2 Service
 * @description Cloudflare R2 object storage operations
 */

import type { R2Object, R2ListOptions, R2ListResult, R2PutOptions, R2PresignedURL } from "../../../domain/entities/r2.entity";
import type { IR2Service } from "../../../domain/interfaces/services.interface";
import { validationUtils } from "../../utils";

export interface R2UploadOptions extends R2PutOptions {
  readonly binding?: string;
}

export interface R2CacheOptions {
  readonly bucket: string;
  readonly customDomain?: string;
}

class R2Service implements IR2Service {
  private buckets: Map<string, R2Bucket> = new Map();
  private customDomain: string | null = null;

  initialize(options: R2CacheOptions): void {
    this.customDomain = options.customDomain ?? null;
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
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata,
    };
  }

  async put(
    key: string,
    data: ReadableStream | ArrayBuffer | string,
    options?: R2UploadOptions
  ): Promise<void> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    const bucket = this.getBucket(options?.binding);

    await bucket.put(key, data, {
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
      checksum: options?.checksum,
    });
  }

  async delete(key: string, binding?: string): Promise<boolean> {
    if (!validationUtils.isValidR2Key(key)) {
      throw new Error(`Invalid R2 key: ${key}`);
    }

    const bucket = this.getBucket(binding);
    await bucket.delete(key);

    return true;
  }

  async list(options?: R2ListOptions & { binding?: string }): Promise<R2ListResult> {
    const bucket = this.getBucket(options?.binding);
    const listed = await bucket.list({
      limit: options?.limit,
      prefix: options?.prefix,
      cursor: options?.cursor,
    });

    return {
      objects: listed.objects,
      truncated: listed.truncated,
      cursor: listed.cursor,
    };
  }

  async getPresignedURL(key: string, expiresIn = 3600, binding?: string): Promise<R2PresignedURL> {
    // Note: R2 presigned URLs require AWS S3 signature
    // This would typically use the AWS SDK or custom signing logic
    // For now, return a placeholder

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      url: `https://presigned-url-placeholder/${key}?expires=${expiresAt.getTime()}`,
      expiresAt,
    };
  }

  /**
   * Upload helpers
   */
  async uploadFile(file: File, key?: string, options?: R2UploadOptions, binding?: string): Promise<void> {
    const objectKey = key || `uploads/${Date.now()}-${file.name}`;

    await this.put(objectKey, file.stream(), {
      ...options,
      httpMetadata: {
        contentType: file.type,
        ...options?.httpMetadata,
      },
    });
  }

  async uploadFromURL(url: string, key: string, binding?: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    await this.put(key, response.body, {
      httpMetadata: {
        contentType: response.headers.get("Content-Type") || undefined,
      },
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

    if (list.truncated && list.cursor) {
      await this.deletePrefix(prefix, binding);
    }
  }
}

export const r2Service = new R2Service();
