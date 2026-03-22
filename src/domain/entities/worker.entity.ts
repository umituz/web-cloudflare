/**
 * Worker Entity
 * @description Basic Worker entity placeholder
 */

export interface WorkerEntity {
  id: string;
  name: string;
}

export interface WorkerConfig {
  name: string;
  routes?: string[];
  schedule?: string;
  bindings?: Record<string, unknown>;
}

export interface WorkerResponse {
  status: number;
  body?: BodyInit | null;
}

export interface IncomingRequestCfProperties {
  colo?: string;
  country?: string;
  httpProtocol?: string;
  tlsVersion?: string;
  tlsCipher?: string;
  asn?: number;
  requestPriority?: number;
}

export type { WorkerRequest as _WorkerRequest } from '../../domains/workers/entities';
// Re-export WorkerRequest from workers domain
export { WorkerRequest } from '../../domains/workers/entities';
