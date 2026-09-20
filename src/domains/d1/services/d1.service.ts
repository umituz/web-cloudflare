/**
 * D1 Service
 * @description Cloudflare D1 database operations with migrations, transactions, and query builder
 */

import type { D1QueryResult, D1BatchResult } from "../entities";
import type { ID1Service } from "../types/service.interface";

// ============================================================
// Migration Types
// ============================================================

export interface D1Migration {
  id: string;
  name: string;
  sql: string;
  appliedAt?: number;
  rolledBackAt?: number;
}

export interface D1MigrationHistory {
  migrations: D1Migration[];
  lastApplied?: D1Migration;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: Array<{
    column: string;
    error: string;
  }>;
  warnings: Array<{
    column: string;
    warning: string;
  }>;
}

// ============================================================
// Transaction Types
// ============================================================

export interface D1TransactionOptions {
  readonly binding?: string;
  readonly timeout?: number;
}

/**
 * Validates a SQL identifier (table/column name) before it is interpolated
 * into a statement. D1 parameter binding only covers VALUES — identifiers
 * must be allow-listed to prevent injection through builder inputs.
 */
export function validateSqlIdentifier(
  name: string,
  kind: 'table' | 'column' | 'identifier' = 'identifier'
): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      `Invalid SQL ${kind}: ${JSON.stringify(name.length > 100 ? `${name.slice(0, 100)}…` : name)}. ` +
        'Identifiers must match /^[A-Za-z_][A-Za-z0-9_]*$/ — use parameterized query() for anything else.'
    );
  }
  return name;
}

/**
 * Statement collector for D1 "transactions".
 *
 * IMPORTANT — D1 has no interactive transactions. Statements passed to
 * `query()` execute IMMEDIATELY (results are needed by the caller), so:
 * - `commit()` only marks the unit complete; it does NOT re-execute
 *   statements (the previous implementation replayed the batch without
 *   bound parameters, double-applying every write).
 * - `rollback()` cannot undo already-executed statements; it only fails
 *   the unit and prevents further statements.
 * For TRUE atomic multi-statement execution, collect statements yourself
 * and use `D1Service.batch()` — D1 batches are executed atomically.
 */
export class D1TransactionWrapper {
  private database: D1Database;
  private binding: string;
  private committed = false;
  private rolledBack = false;
  private statements: Array<{ sql: string; params?: readonly unknown[] }> = [];

  constructor(database: D1Database, binding: string) {
    this.database = database;
    this.binding = binding;
  }

  async query<T>(sql: string, params?: readonly unknown[]): Promise<D1QueryResult<T>> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction has already been committed or rolled back');
    }

    // Record for auditing, then execute immediately (see class JSDoc).
    this.statements.push({ sql, params });

    const stmt = this.database.prepare(sql);
    const result = params ? await stmt.bind(...params).all() : await stmt.all();

    return {
      rows: result.results as T[],
      meta: result.meta
        ? {
            duration: result.meta.duration,
            changes: result.meta.changes,
          }
        : undefined,
    };
  }

  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction has already been committed or rolled back');
    }

    // Statements already executed in query(); replaying them here would
    // double-apply every write.
    this.committed = true;
  }

  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction has already been committed or rolled back');
    }

    this.rolledBack = true;
  }

  isComplete(): boolean {
    return this.committed || this.rolledBack;
  }

  /** Statements executed in this unit (for logging/auditing). */
  getExecutedStatements(): ReadonlyArray<{ sql: string; params?: readonly unknown[] }> {
    return this.statements;
  }
}

// ============================================================
// Query Builder
// ============================================================

export class D1QueryBuilder {
  private table: string;
  private _select: string[] = ['*'];
  private _where: string[] = [];
  private _whereParams: unknown[] = [];
  private _join: string[] = [];
  private _orderBy: string[] = [];
  private _limit?: number;
  private _offset?: number;
  private _groupBy?: string;

  constructor(table: string) {
    this.table = validateSqlIdentifier(table, 'table');
  }

  select(columns: string[]): D1QueryBuilder {
    this._select = columns.map(c => validateSqlIdentifier(c, 'column'));
    return this;
  }

  where(condition: string, params?: readonly unknown[]): D1QueryBuilder {
    this._where.push(condition);
    if (params) {
      this._whereParams.push(...params);
    }
    return this;
  }

  join(table: string, on: string, type: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER'): D1QueryBuilder {
    // `on` is caller-authored SQL (conditions like "users.id = orders.user_id");
    // only the table name is validated — never pass user input as `on`.
    this._join.push(`${type} JOIN ${validateSqlIdentifier(table, 'table')} ON ${on}`);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): D1QueryBuilder {
    this._orderBy.push(`${validateSqlIdentifier(column, 'column')} ${direction}`);
    return this;
  }

  groupBy(column: string): D1QueryBuilder {
    this._groupBy = validateSqlIdentifier(column, 'column');
    return this;
  }

  limit(count: number): D1QueryBuilder {
    this._limit = count;
    return this;
  }

  offset(count: number): D1QueryBuilder {
    this._offset = count;
    return this;
  }

  toSQL(): { sql: string; params: readonly unknown[] } {
    const parts: string[] = [];

    // SELECT
    parts.push(`SELECT ${this._select.join(', ')}`);

    // FROM
    parts.push(`FROM ${this.table}`);

    // JOINs
    if (this._join.length > 0) {
      parts.push(this._join.join(' '));
    }

    // WHERE
    if (this._where.length > 0) {
      parts.push(`WHERE ${this._where.join(' AND ')}`);
    }

    // GROUP BY
    if (this._groupBy) {
      parts.push(`GROUP BY ${this._groupBy}`);
    }

    // ORDER BY
    if (this._orderBy.length > 0) {
      parts.push(`ORDER BY ${this._orderBy.join(', ')}`);
    }

    // LIMIT
    if (this._limit !== undefined) {
      parts.push(`LIMIT ${this._limit}`);
    }

    // OFFSET
    if (this._offset !== undefined) {
      parts.push(`OFFSET ${this._offset}`);
    }

    return {
      sql: parts.join(' '),
      params: this._whereParams,
    };
  }

  async execute<T>(
    service: D1Service,
    binding?: string
  ): Promise<D1QueryResult<T>> {
    const { sql, params } = this.toSQL();
    return service.query<T>(sql, params, binding);
  }
}

// ============================================================
// D1 Exec Options
// ============================================================

export interface D1ExecOptions {
  readonly binding?: string;
}

export class D1Service implements ID1Service {
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
      rows: result.results as T[],
      meta: result.meta
        ? {
            duration: result.meta.duration,
            changes: result.meta.changes,
          }
        : undefined,
    };
  }

  async batch(
    sqlStatements: readonly { sql: string; params?: readonly unknown[]; binding?: string }[]
  ): Promise<D1BatchResult> {
    // Group by binding
    const grouped = new Map<string, D1PreparedStatement[]>();

    for (const stmt of sqlStatements) {
      const bindingName = stmt.binding || "default";
      const database = this.getDatabase(bindingName);

      if (!grouped.has(bindingName)) {
        grouped.set(bindingName, []);
      }

      // Bind params — prepare() without bind() drops them (D1 executes the
      // statement with unbound `?` placeholders).
      const prepared = stmt.params?.length
        ? database.prepare(stmt.sql).bind(...stmt.params)
        : database.prepare(stmt.sql);
      grouped.get(bindingName)!.push(prepared);
    }

    // Note: D1 batch requires all statements to be from the same database
    if (grouped.size > 1) {
      throw new Error("Batch operations must be from the same database binding");
    }

    const [bindingName, preparedStatements] = Array.from(grouped.entries())[0];
    const database = this.getDatabase(bindingName);

    const results = await database.batch(preparedStatements as D1PreparedStatement[]);

    return {
      success: results.every((r) => r.success),
      results: results.map((r) => ({
        rows: r.results,
        meta: r.meta ? { duration: r.meta.duration, changes: r.meta.changes } : undefined,
      })) as D1QueryResult[],
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

    return (result.rows[0] as T) ?? null;
  }

  async insert<T>(
    table: string,
    data: Record<string, unknown>,
    binding?: string
  ): Promise<D1QueryResult<T>> {
    const columns = Object.keys(data).map((c) => validateSqlIdentifier(c, "column"));
    const values = Object.values(data);
    const placeholders = values.map(() => "?").join(", ");

    const sql = `INSERT INTO ${validateSqlIdentifier(table, "table")} (${columns.join(", ")}) VALUES (${placeholders})`;

    return this.query<T>(sql, values, binding);
  }

  async update<T>(
    table: string,
    data: Record<string, unknown>,
    where: string,
    whereParams: readonly unknown[] = [],
    binding?: string
  ): Promise<D1QueryResult<T>> {
    const columns = Object.keys(data).map((c) => validateSqlIdentifier(c, "column"));
    const values = Object.values(data);
    const setClause = columns.map((col) => `${col} = ?`).join(", ");

    // `where` is caller-authored SQL — pass user input via whereParams only.
    const sql = `UPDATE ${validateSqlIdentifier(table, "table")} SET ${setClause} WHERE ${where}`;
    const params = [...values, ...whereParams];

    return this.query<T>(sql, params, binding);
  }

  async delete(table: string, where: string, params?: readonly unknown[], binding?: string): Promise<D1QueryResult> {
    const sql = `DELETE FROM ${validateSqlIdentifier(table, "table")} WHERE ${where}`;

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
    // Column names validated; types are caller-authored SQL (e.g. "TEXT PRIMARY KEY").
    const columnDefs = Object.entries(columns)
      .map(([name, type]) => `${validateSqlIdentifier(name, "column")} ${type}`)
      .join(", ");

    const sql = `CREATE TABLE IF NOT EXISTS ${validateSqlIdentifier(table, "table")} (${columnDefs})`;

    await this.query(sql, [], binding);
  }

  async dropTable(table: string, binding?: string): Promise<void> {
    const sql = `DROP TABLE IF EXISTS ${validateSqlIdentifier(table, "table")}`;

    await this.query(sql, [], binding);
  }

  async tableExists(table: string, binding?: string): Promise<boolean> {
    const sql = `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name=?
    `;

    const result = await this.query<{ name: string }>(sql, [table], binding);

    return result.rows.length > 0;
  }

  /**
   * Transaction helpers
   */
  /**
   * Run a unit of work against a D1TransactionWrapper.
   *
   * NOT ATOMIC: statements inside the callback execute immediately as they
   * are issued (D1 has no interactive transactions) — a thrown error does
   * NOT undo previously executed statements. For atomic multi-statement
   * writes, build `{ sql, params }[]` and use `batch()` (D1 batches are
   * transactional).
   */
  async runInTransaction<T>(
    callback: (txn: D1TransactionWrapper) => Promise<T>,
    binding?: string
  ): Promise<T> {
    const database = this.getDatabase(binding);
    const bindingName = binding || 'default';
    const txn = new D1TransactionWrapper(database, bindingName);

    try {
      const result = await callback(txn);

      // Auto-commit if not already committed
      if (!txn.isComplete()) {
        await txn.commit();
      }

      return result;
    } catch (error) {
      // Rollback on error
      if (!txn.isComplete()) {
        await txn.rollback();
      }
      throw error;
    }
  }

  // ============================================================
  // Migration System
  // ============================================================

  /**
   * Create a new migration ID.
   * The migration body itself is author-owned: write it to your repo or KV.
   */
  async createMigration(name: string, _binding?: string): Promise<string> {
    return `${Date.now()}_${name}`;
  }

  /**
   * Run a migration.
   *
   * NOTE: statements are split on top-level `;` — semicolons inside string
   * literals will break the split. Keep migration SQL one-statement-per-
   * semicolon, or call query()/batch() directly for anything trickier.
   */
  async runMigration(
    migrationSql: string,
    binding?: string
  ): Promise<void> {
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const sql of statements) {
      await this.query(sql, [], binding);
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(
    migrationName: string,
    rollbackSql: string,
    binding?: string
  ): Promise<void> {
    // Execute rollback statements
    await this.runMigration(rollbackSql, binding);
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(binding?: string): Promise<D1MigrationHistory> {
    // Create migrations table if not exists
    await this.createTable(
      '_migrations',
      {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        applied_at: 'INTEGER',
        rolled_back_at: 'INTEGER',
      },
      binding
    );

    const result = await this.query<D1Migration>(
      'SELECT * FROM _migrations ORDER BY applied_at DESC',
      [],
      binding
    );

    return {
      migrations: result.rows,
      lastApplied: result.rows[0],
    };
  }

  // ============================================================
  // Batch Query Helper
  // ============================================================

  /**
   * Execute multiple queries in batch
   */
  async batchQuery<T>(
    queries: Array<{ sql: string; params?: readonly unknown[]; binding?: string }>,
    binding?: string
  ): Promise<D1BatchResult<T>> {
    // All queries must use the same binding
    const bindingName = binding || 'default';
    const database = this.getDatabase(bindingName);

    // Bind params — prepare() without bind() drops them.
    const statements = queries.map(q =>
      q.params?.length ? database.prepare(q.sql).bind(...q.params) : database.prepare(q.sql)
    );
    const results = await database.batch(statements as D1PreparedStatement[]);

    return {
      success: results.every(r => r.success),
      results: results.map(r => ({
        rows: r.results as T[],
        meta: r.meta ? { duration: r.meta.duration, changes: r.meta.changes } : undefined,
      })) as D1QueryResult<T>[],
    };
  }

  // ============================================================
  // Schema Validation
  // ============================================================

  /**
   * Validate table schema
   */
  async validateSchema(
    table: string,
    expectedSchema: Record<string, string>,
    binding?: string
  ): Promise<SchemaValidationResult> {
    const errors: Array<{ column: string; error: string }> = [];
    const warnings: Array<{ column: string; warning: string }> = [];

    // Get actual schema from SQLite
    const sql = `PRAGMA table_info(${validateSqlIdentifier(table, "table")})`;
    const result = await this.query<{ cid: number; name: string; type: string; notnull: number; pk: number }>(
      sql,
      [],
      binding
    );

    const actualColumns = result.rows;
    const actualSchema: Record<string, string> = {};
    for (const col of actualColumns) {
      actualSchema[col.name] = col.type;
    }

    // Check for missing columns
    for (const [colName, colType] of Object.entries(expectedSchema)) {
      if (!(colName in actualSchema)) {
        errors.push({
          column: colName,
          error: `Column '${colName}' is missing`,
        });
      } else if (actualSchema[colName] !== colType) {
        warnings.push({
          column: colName,
          warning: `Type mismatch: expected '${colType}', got '${actualSchema[colName]}'`,
        });
      }
    }

    // Check for extra columns
    for (const colName of Object.keys(actualSchema)) {
      if (!(colName in expectedSchema) && colName !== 'id') {
        warnings.push({
          column: colName,
          warning: `Extra column '${colName}' found`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================
  // Query Builder
  // ============================================================

  /**
   * Create a query builder for a table
   */
  queryBuilder(table: string): D1QueryBuilder {
    return new D1QueryBuilder(table);
  }

  // ============================================================
  // Table Information
  // ============================================================

  /**
   * Get table schema information
   */
  async getTableSchema(table: string, binding?: string): Promise<Record<string, string>> {
    const sql = `PRAGMA table_info(${validateSqlIdentifier(table, "table")})`;
    const result = await this.query<{ name: string; type: string }>(sql, [], binding);

    const schema: Record<string, string> = {};
    for (const col of result.rows) {
      schema[col.name] = col.type;
    }

    return schema;
  }

  /**
   * Get all tables
   */
  async getTables(binding?: string): Promise<string[]> {
    const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
    const result = await this.query<{ name: string }>(sql, [], binding);
    return result.rows.map(r => r.name);
  }

  /**
   * Truncate table (delete all rows)
   */
  async truncateTable(table: string, binding?: string): Promise<void> {
    const sql = `DELETE FROM ${validateSqlIdentifier(table, "table")}`;
    await this.query(sql, [], binding);
  }

  /**
   * Get table row count
   */
  async getRowCount(table: string, binding?: string): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${validateSqlIdentifier(table, "table")}`;
    const result = await this.findOne<{ count: number }>(sql, [], binding);
    return result?.count || 0;
  }
}

// Export singleton instance
export const d1Service = new D1Service();
