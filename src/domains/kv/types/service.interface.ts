
import type { KVListOptions, KVListResult } from '../entities';

export interface IKVService {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: KVListOptions): Promise<KVListResult>;
}
