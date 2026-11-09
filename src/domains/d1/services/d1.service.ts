
import type { D1QueryResult, D1BatchResult } from "../entities";
import type { ID1Service } from "../types/service.interface";


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


export interface D1TransactionOptions {
  readonly binding?: string;
  readonly timeout?: number;
}

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

  getExecutedStatements(): ReadonlyArray<{ sql: string; params?: readonly unknown[] }> {
    return this.statements;
  }
}


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

    parts.push(`SELECT ${this._select.join(', ')}`);

    parts.push(`FROM ${this.table}`);

    if (this._join.length > 0) {
      parts.push(this._join.join(' '));
    }

    if (this._where.length > 0) {
      parts.push(`WHERE ${this._where.join(' AND ')}`);
    }

    if (this._groupBy) {
      parts.push(`GROUP BY ${this._groupBy}`);
    }

    if (this._orderBy.length > 0) {
      parts.push(`ORDER BY ${this._orderBy.join(', ')}`);
    }

    if (this._limit !== undefined) {
      parts.push(`LIMIT ${this._limit}`);
    }

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
    const grouped = new Map<string, D1PreparedStatement[]>();

    for (const stmt of sqlStatements) {
      const bindingName = stmt.binding || "default";
      const database = this.getDatabase(bindingName);

      if (!grouped.has(bindingName)) {
        grouped.set(bindingName, []);
      }

      const prepared = stmt.params?.length
        ? database.prepare(stmt.sql).bind(...stmt.params)
        : database.prepare(stmt.sql);
      grouped.get(bindingName)!.push(prepared);
    }

    if (grouped.size > 1) {
      throw new Error("Batch operations must be from the same database binding");
    }

    const first = Array.from(grouped.entries())[0];
    if (!first) {
      throw new Error('Batch requires at least one statement');
    }
    const [bindingName, preparedStatements] = first;
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

    const sql = `UPDATE ${validateSqlIdentifier(table, "table")} SET ${setClause} WHERE ${where}`;
    const params = [...values, ...whereParams];

    return this.query<T>(sql, params, binding);
  }

  async delete(table: string, where: string, params?: readonly unknown[], binding?: string): Promise<D1QueryResult> {
    const sql = `DELETE FROM ${validateSqlIdentifier(table, "table")} WHERE ${where}`;

    return this.query(sql, params, binding);
  }

  async createTable(
    table: string,
    columns: Record<string, string>,
    binding?: string
  ): Promise<void> {
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

  async runInTransaction<T>(
    callback: (txn: D1TransactionWrapper) => Promise<T>,
    binding?: string
  ): Promise<T> {
    const database = this.getDatabase(binding);
    const bindingName = binding || 'default';
    const txn = new D1TransactionWrapper(database, bindingName);

    try {
      const result = await callback(txn);

      if (!txn.isComplete()) {
        await txn.commit();
      }

      return result;
    } catch (error) {
      if (!txn.isComplete()) {
        await txn.rollback();
      }
      throw error;
    }
  }


  async createMigration(name: string, _binding?: string): Promise<string> {
    return `${Date.now()}_${name}`;
  }

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

  async rollbackMigration(
    migrationName: string,
    rollbackSql: string,
    binding?: string
  ): Promise<void> {
    await this.runMigration(rollbackSql, binding);
  }

  async getMigrationHistory(binding?: string): Promise<D1MigrationHistory> {
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


  async batchQuery<T>(
    queries: Array<{ sql: string; params?: readonly unknown[]; binding?: string }>,
    binding?: string
  ): Promise<D1BatchResult<T>> {
    const bindingName = binding || 'default';
    const database = this.getDatabase(bindingName);

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


  async validateSchema(
    table: string,
    expectedSchema: Record<string, string>,
    binding?: string
  ): Promise<SchemaValidationResult> {
    const errors: Array<{ column: string; error: string }> = [];
    const warnings: Array<{ column: string; warning: string }> = [];

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


  queryBuilder(table: string): D1QueryBuilder {
    return new D1QueryBuilder(table);
  }


  async getTableSchema(table: string, binding?: string): Promise<Record<string, string>> {
    const sql = `PRAGMA table_info(${validateSqlIdentifier(table, "table")})`;
    const result = await this.query<{ name: string; type: string }>(sql, [], binding);

    const schema: Record<string, string> = {};
    for (const col of result.rows) {
      schema[col.name] = col.type;
    }

    return schema;
  }

  async getTables(binding?: string): Promise<string[]> {
    const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
    const result = await this.query<{ name: string }>(sql, [], binding);
    return result.rows.map(r => r.name);
  }

  async truncateTable(table: string, binding?: string): Promise<void> {
    const sql = `DELETE FROM ${validateSqlIdentifier(table, "table")}`;
    await this.query(sql, [], binding);
  }

  async getRowCount(table: string, binding?: string): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${validateSqlIdentifier(table, "table")}`;
    const result = await this.findOne<{ count: number }>(sql, [], binding);
    return result?.count || 0;
  }
}

export const d1Service = new D1Service();
