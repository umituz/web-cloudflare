/**
 * Workers Environment Types
 * @description Environment and event types for Workers
 */

import type { WorkerRequest, WorkerResponse } from '../entities';

/**
 * Worker environment bindings
 */
export interface Env {
  readonly KV?: Record<string, KVNamespace>;
  readonly R2?: Record<string, R2Bucket>;
  readonly D1?: Record<string, D1Database>;
}

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
  fetch(request: WorkerRequest, env?: Env): Promise<WorkerResponse>;
  scheduled(event: ScheduledEvent, env?: Env): Promise<void>;
}
