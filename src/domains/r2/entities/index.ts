/**
 * R2 Entity
 * @description Cloudflare R2 storage configuration and types
 */

export interface R2BucketConfig {
  readonly bucket: string;
  readonly customDomain?: string;
}

export interface R2Object {
  readonly key: string;
  readonly size: number;
  readonly uploaded: Date;
  readonly httpMetadata?: R2HTTPMetadata;
  readonly customMetadata?: Record<string, string>;
}

export interface R2HTTPMetadata {
  readonly contentType?: string;
  readonly cacheControl?: string;
  readonly contentEncoding?: string;
  readonly contentLanguage?: string;
  readonly cacheExpiry?: Date;
}

export interface R2UploadResult {
  readonly key: string;
  readonly size: number;
  readonly etag?: string;
  readonly version?: string;
}

export interface R2ListOptions {
  readonly limit?: number;
  readonly prefix?: string;
  readonly cursor?: string;
}

export interface R2ListResult {
  readonly objects: readonly R2Object[];
  readonly truncated: boolean;
  readonly cursor?: string;
}

export interface R2PutOptions {
  readonly httpMetadata?: R2HTTPMetadata;
  readonly customMetadata?: Record<string, string>;
  readonly checksum?: string;
}

export interface R2PresignedURL {
  readonly url: string;
  readonly expiresAt: Date;
}
