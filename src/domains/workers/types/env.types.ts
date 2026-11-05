
import type { WorkerRequest, WorkerResponse } from '../entities';

export interface BaseEnv {
  readonly KV?: Record<string, KVNamespace>;
  readonly R2?: Record<string, R2Bucket>;
  readonly D1?: Record<string, D1Database>;
}

export type Env = BaseEnv;

export interface ScheduledEvent {
  readonly scheduledTime: number;
  readonly cron: string;
}

export interface IWorkerService {
  fetch(request: WorkerRequest, env?: BaseEnv): Promise<WorkerResponse>;
  scheduled(event: ScheduledEvent, env?: BaseEnv): Promise<void>;
}
