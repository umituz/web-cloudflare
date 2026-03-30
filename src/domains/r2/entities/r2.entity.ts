/**
 * R2 Entity
 * @description Basic R2 entity placeholder
 */

export interface R2Entity {
  bucketName: string;
  key: string;
}

export interface R2BucketConfig {
  name: string;
  location?: string;
}

export interface R2Object {
  key: string;
  size: number;
  uploaded: Date;
}

export interface R2UploadResult {
  key: string;
  etag?: string;
}

export interface R2ListOptions {
  limit?: number;
  cursor?: string;
  prefix?: string;
}

export interface R2ListResult {
  objects: R2Object[];
  cursor?: string;
}

export interface R2PutOptions {
  customMetadata?: Record<string, string>;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
}

export interface R2PresignedURL {
  url: string;
  expires: number;
}
