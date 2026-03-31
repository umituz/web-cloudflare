/**
 * KV Repository Interface
 * @description Abstract interface for KV data access operations
 */

import type { KVEntity } from '../entities';

export interface IKVRepository {
  /**
   * Find KV entity by key
   */
  findByKey(key: string, binding?: string): Promise<KVEntity | null>;

  /**
   * Save KV entity
   */
  save(entity: KVEntity, binding?: string): Promise<void>;

  /**
   * Delete KV entity
   */
  delete(entity: KVEntity, binding?: string): Promise<void>;

  /**
   * List KV entries
   */
  list(options: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    binding?: string;
  }): Promise<{
    keys: KVEntity[];
    cursor?: string;
  }>;

  /**
   * Check if key exists
   */
  exists(key: string, binding?: string): Promise<boolean>;
}
