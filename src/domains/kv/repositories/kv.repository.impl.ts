/**
 * KV Repository Implementation
 * @description Concrete implementation of KV repository using Cloudflare KV
 */

import type { IKVRepository } from './kv.repository.interface';
import type { KVEntity, KVNamespaceConfig } from '../entities';

export class KVRepository implements IKVRepository {
  private namespaces: Map<string, KVNamespace> = new Map();

  bindNamespace(name: string, namespace: KVNamespace): void {
    this.namespaces.set(name, namespace);
  }

  private getNamespace(binding?: string): KVNamespace {
    const name = binding || 'default';
    const namespace = this.namespaces.get(name);
    if (!namespace) {
      throw new Error(`KV namespace "${name}" not bound`);
    }
    return namespace;
  }

  async findByKey(key: string, binding?: string): Promise<KVEntity | null> {
    const namespace = this.getNamespace(binding);
    const value = await namespace.get(key, 'json');

    if (value === null) return null;

    return {
      namespaceId: binding || 'default',
      key,
      value: value as string,
    };
  }

  async save(entity: KVEntity, binding?: string): Promise<void> {
    const namespace = this.getNamespace(binding);
    await namespace.put(entity.key, JSON.stringify(entity.value));
  }

  async delete(entity: KVEntity, binding?: string): Promise<void> {
    const namespace = this.getNamespace(binding);
    await namespace.delete(entity.key);
  }

  async list(options: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    binding?: string;
  }): Promise<{
    keys: KVEntity[];
    cursor?: string;
  }> {
    const namespace = this.getNamespace(options.binding);
    const list = await namespace.list({
      limit: options.limit,
      cursor: options.cursor,
      prefix: options.prefix,
    });

    type ListResultWithCursor = typeof list & { cursor?: string };
    const cursor = (list as ListResultWithCursor).cursor;

    return {
      keys: list.keys.map((k) => ({
        namespaceId: options.binding || 'default',
        key: k.name,
        value: '',
      })),
      cursor: cursor,
    };
  }

  async exists(key: string, binding?: string): Promise<boolean> {
    const entity = await this.findByKey(key, binding);
    return entity !== null;
  }
}
