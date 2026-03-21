/**
 * D1 Service
 * @description Cloudflare D1 database operations
 */

import type { D1QueryResult, D1BatchResult } from "../../../domain/entities/d1.entity";
import type { ID1Service } from "../../../domain/interfaces/services.interface";

export interface D1ExecOptions {
  readonly binding?: string;
}

class D1Service implements ID1Service {
  private databases: Map<string, D1Database> = new Map();

  bindDatabase(name: string, database: D1Database): void {
    this.databases.set(name, database);
  }

  private getDatabase(binding?: string): D1Database {
    const name = binding || "default";
    const database = this.databases.get(name);
    if (!database) {
      throw new Error(`D1 database "${name}" not bound`);
    }
    return database;
  }

  async query<T>(sql: string, params?: readonly unknown[], binding?: string): Promise<D1QueryResult<T>> {
    const database = this.getDatabase(binding);

    const stmt = database.prepare(sql);
    const result = params ? await stmt.bind(...params).all() : await stmt.all();

    return {
      results: result.results as T[],
      success: result.success,
      meta: result.meta
        ? {
            duration: result.meta.duration,
            rows_read: result.meta.rows_read,
            rows_written: result.meta.rows_written,
            last_row_id: result.meta.last_row_id,
            changes: result.meta.changes,
          }
        : undefined,
    };
  }

  async batch(
    statements: readonly { sql: string; params?: readonly unknown[]; binding?: string }[]
  ): Promise<D1BatchResult> {
    // Group by binding
    const grouped = new Map<string, D1PreparedStatement[]>();

    for (const stmt of statements) {
      const binding = stmt.binding || "default";
      const database = this.getDatabase(binding);

      if (!grouped.has(binding)) {
        grouped.set(binding, []);
      }

      grouped.get(binding)!.push(database.prepare(stmt.sql));
    }

    // Note: D1 batch requires all statements to be from the same database
    if (grouped.size > 1) {
      throw new Error("Batch operations must be from the same database binding");
    }

    const [binding, statements] = Array.from(grouped.entries())[0];
    const database = this.getDatabase(binding);

    const results = await database.batch(statements as D1PreparedStatement[]);

    return {
      success: results.every((r) => r.success),
      results: results.map((r) => ({
        results: r.results,
        success: r.success,
        meta: r.meta,
      })),
    };
  }

  async execute<T>(sql: string, params?: readonly unknown[], binding?: string): Promise<D1QueryResult<T>> {
    return this.query<T>(sql, params, binding);
  }

  /**
   * Query helpers
   */
  async findOne<T>(sql: string, params?: readonly unknown[], binding?: string): Promise<T | null> {
    const result = await this.query<T>(sql, params, binding);

    return (result.results[0] as T) ?? null;
  }

  async insert<T>(
    table: string,
    data: Record<string, unknown>,
    binding?: string
  ): Promise<D1QueryResult<T>> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => "?").join(", ");

    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

    return this.query<T>(sql, values, binding);
  }

  async update<T>(
    table: string,
    data: Record<string, unknown>,
    where: string,
    whereParams: readonly unknown[] = [],
    binding?: string
  ): Promise<D1QueryResult<T>> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col) => `${col} = ?`).join(", ");

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
    const params = [...values, ...whereParams];

    return this.query<T>(sql, params, binding);
  }

  async delete(table: string, where: string, params?: readonly unknown[], binding?: string): Promise<D1QueryResult> {
    const sql = `DELETE FROM ${table} WHERE ${where}`;

    return this.query(sql, params, binding);
  }

  /**
   * Schema helpers
   */
  async createTable(
    table: string,
    columns: Record<string, string>,
    binding?: string
  ): Promise<void> {
    const columnDefs = Object.entries(columns)
      .map(([name, type]) => `${name} ${type}`)
      .join(", ");

    const sql = `CREATE TABLE IF NOT EXISTS ${table} (${columnDefs})`;

    await this.execute(sql, [], binding);
  }

  async dropTable(table: string, binding?: string): Promise<void> {
    const sql = `DROP TABLE IF EXISTS ${table}`;

    await this.execute(sql, [], binding);
  }

  async tableExists(table: string, binding?: string): Promise<boolean> {
    const sql = `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name=?
    `;

    const result = await this.query<{ name: string }>(sql, [table], binding);

    return result.results.length > 0;
  }

  /**
   * Transaction helpers
   */
  async runInTransaction<T>(
    callback: (txn: D1Transaction) => Promise<T>,
    binding?: string
  ): Promise<T> {
    const database = this.getDatabase(binding);

    // Note: D1 doesn't have explicit transaction API
    // Use batch operations or implement application-level logic

    throw new Error("Transactions not yet implemented for D1");
  }
}

interface D1Transaction {
  query<T>(sql: string, params?: readonly unknown[]): Promise<D1QueryResult<T>>;
}

export const d1Service = new D1Service();
