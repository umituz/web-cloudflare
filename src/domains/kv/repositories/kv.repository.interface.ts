
import type { KVEntity } from '../entities';

export interface IKVRepository {
  findByKey(key: string, binding?: string): Promise<KVEntity | null>;

  save(entity: KVEntity, binding?: string): Promise<void>;

  delete(entity: KVEntity, binding?: string): Promise<void>;

  list(options: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    binding?: string;
  }): Promise<{
    keys: KVEntity[];
    cursor?: string;
  }>;

  exists(key: string, binding?: string): Promise<boolean>;
}
