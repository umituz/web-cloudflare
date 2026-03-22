/**
 * R2 Service Interface
 * @description Abstract interface for R2 storage operations
 */

import type { R2Object, R2ListOptions, R2ListResult, R2PutOptions, R2PresignedURL } from '../entities';

export interface IR2Service {
  get(key: string, binding?: string): Promise<R2Object | null>;
  put(key: string, data: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<void>;
  delete(key: string, binding?: string): Promise<boolean>;
  list(options?: R2ListOptions): Promise<R2ListResult>;
  getPresignedURL(key: string, expiresIn?: number): Promise<R2PresignedURL>;
}
