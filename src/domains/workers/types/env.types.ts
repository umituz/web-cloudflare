/**
 * Workers Environment Types
 * @description Environment and event types for Workers
 */

import type { WorkerRequest, WorkerResponse } from '../entities';

/**
 * Base Environment types for Cloudflare Workers
 */
export interface BaseEnv {
  readonly KV?: Record<string, KVNamespace>;
  readonly R2?: Record<string, R2Bucket>;
  readonly D1?: Record<string, D1Database>;
}

/**
 * Alias for backward compatibility
 */
export type Env = BaseEnv;

/**
 * Scheduled event for cron triggers
 */
export interface ScheduledEvent {
  readonly scheduledTime: number;
  readonly cron: string;
}

/**
 * Worker Service Interface
 */
export interface IWorkerService {
  fetch(request: WorkerRequest, env?: BaseEnv): Promise<WorkerResponse>;
  scheduled(event: ScheduledEvent, env?: BaseEnv): Promise<void>;
}
