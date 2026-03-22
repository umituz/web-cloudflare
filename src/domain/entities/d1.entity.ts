/**
 * D1 Entity
 * @description Basic D1 entity placeholder
 */

export interface D1Entity {
  databaseId: string;
  name: string;
}

export interface D1DatabaseConfig {
  name: string;
  migrations?: string[];
}

export interface D1QueryResult<T = unknown> {
  rows: T[];
  meta?: {
    duration: number;
    changes?: number;
  };
}

export interface D1BatchResult<T = unknown> {
  success: boolean;
  results?: D1QueryResult<T>[];
}
