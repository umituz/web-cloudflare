/**
 * Workers Environment Types
 * @description Environment and event types for Workers
 */

import type { WorkerRequest, WorkerResponse } from '../entities';
import type { Env as BaseEnv } from '../../../domain/interfaces/services.interface';

// Re-export Env for convenience and backward compatibility
export type { Env as BaseEnv };
// Alias for backward compatibility - using the consolidated Env type
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
