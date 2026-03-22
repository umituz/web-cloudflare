/**
 * D1 Service Interface
 * @description Abstract interface for D1 database operations
 */

import type { D1QueryResult, D1BatchResult } from '../entities';

export interface ID1Service {
  query<T>(sql: string, params?: readonly unknown[]): Promise<D1QueryResult<T>>;
  batch(statements: readonly { sql: string; params?: readonly unknown[] }[]): Promise<D1BatchResult>;
  execute<T>(sql: string, params?: readonly unknown[]): Promise<D1QueryResult<T>>;
}
