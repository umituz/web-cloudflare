/**
 * Service Interfaces
 * @description Abstract interfaces for Cloudflare services
 */

import type { WorkerRequest, WorkerResponse } from "../entities/worker.entity";
import type { KVEntry, KVListOptions, KVListResult } from "../entities/kv.entity";
import type { R2Object, R2ListOptions, R2ListResult, R2PutOptions, R2PresignedURL } from "../entities/r2.entity";
import type { D1QueryResult, D1BatchResult } from "../entities/d1.entity";
import type { ImageUploadResult, ImageUploadOptions, ImageTransformation, SignedURL } from "../entities/image.entity";
import type { AnalyticsEvent, AnalyticsData } from "../entities/analytics.entity";

/**
 * Worker Service Interface
 */
export interface IWorkerService {
  fetch(request: WorkerRequest, env?: Env): Promise<WorkerResponse>;
  scheduled(event: ScheduledEvent, env?: Env): Promise<void>;
}

/**
 * KV Service Interface
 */
export interface IKVService {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: KVListOptions): Promise<KVListResult>;
}

/**
 * R2 Service Interface
 */
export interface IR2Service {
  get(key: string): Promise<R2Object | null>;
  put(key: string, data: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: R2ListOptions): Promise<R2ListResult>;
  getPresignedURL(key: string, expiresIn?: number): Promise<R2PresignedURL>;
}

/**
 * D1 Service Interface
 */
export interface ID1Service {
  query<T>(sql: string, params?: readonly unknown[]): Promise<D1QueryResult<T>>;
  batch(statements: readonly { sql: string; params?: readonly unknown[] }[]): Promise<D1BatchResult>;
  execute<T>(sql: string, params?: readonly unknown[]): Promise<D1QueryResult<T>>;
}

/**
 * Image Service Interface
 */
export interface IImageService {
  upload(file: File | Blob, options?: ImageUploadOptions): Promise<ImageUploadResult>;
  getSignedURL(imageId: string, expiresIn?: number): Promise<SignedURL>;
  getTransformedURL(imageId: string, transform: ImageTransformation): Promise<string>;
  delete(imageId: string): Promise<boolean>;
}

/**
 * Analytics Service Interface
 */
export interface IAnalyticsService {
  trackEvent(event: AnalyticsEvent): Promise<void>;
  trackPageview(url: string, title: string, referrer?: string): Promise<void>;
  getAnalytics(): Promise<AnalyticsData>;
}

/**
 * Environment types
 */
export interface Env {
  readonly KV?: Record<string, KVNamespace>;
  readonly R2?: Record<string, R2Bucket>;
  readonly D1?: Record<string, D1Database>;
}

export interface ScheduledEvent {
  readonly scheduledTime: number;
  readonly cron: string;
}
