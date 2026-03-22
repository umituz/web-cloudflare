/**
 * D1 Entity
 * @description Cloudflare D1 database configuration and types
 */

export interface D1DatabaseConfig {
  readonly database: string;
}

export interface D1QueryResult<T = unknown> {
  readonly results: readonly T[];
  readonly success: boolean;
  readonly meta?: D1QueryMeta;
}

export interface D1QueryMeta {
  readonly duration: number;
  readonly rows_read: number;
  readonly rows_written: number;
  readonly last_row_id?: number;
  readonly changes: number;
}

export interface D1PreparedStatement {
  readonly statement: string;
  readonly params: readonly unknown[];
}

export interface D1BatchResult {
  readonly success: boolean;
  readonly results: readonly D1QueryResult[];
}

export interface D1TransactionOptions {
  readonly rollbackOnError?: boolean;
  readonly timeout?: number;
}
