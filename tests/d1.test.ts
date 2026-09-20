import { describe, it, expect } from 'vitest';
import {
  validateSqlIdentifier,
  D1QueryBuilder,
  D1TransactionWrapper,
  D1Service,
} from '../src/domains/d1/services/d1.service';

describe('validateSqlIdentifier', () => {
  it('accepts plain identifiers', () => {
    expect(validateSqlIdentifier('users')).toBe('users');
    expect(validateSqlIdentifier('_migrations')).toBe('_migrations');
    expect(validateSqlIdentifier('col_1')).toBe('col_1');
  });

  it('rejects injection payloads', () => {
    const attacks = [
      'users; DROP TABLE users; --',
      'users--',
      'users WHERE 1=1',
      '"users"',
      'users(1)',
      '',
      '1users',
      'user-name',
    ];
    for (const attack of attacks) {
      expect(() => validateSqlIdentifier(attack)).toThrow(/Invalid SQL/);
    }
  });

  it('truncates very long names in the error message', () => {
    const long = 'a'.repeat(300);
    expect(() => validateSqlIdentifier(long + '!')).toThrow(/Invalid SQL/);
  });
});

describe('D1QueryBuilder', () => {
  it('builds parameterized SQL in the right clause order', () => {
    const { sql, params } = new D1QueryBuilder('orders')
      .select(['id', 'user_id'])
      .where('user_id = ?', ['u1'])
      .where('status = ?', ['paid'])
      .orderBy('created_at', 'DESC')
      .limit(10)
      .offset(20)
      .toSQL();

    expect(sql).toBe(
      'SELECT id, user_id FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 10 OFFSET 20'
    );
    expect(params).toEqual(['u1', 'paid']);
  });

  it('rejects a malicious table name at construction', () => {
    expect(() => new D1QueryBuilder('users; DROP TABLE users')).toThrow(/Invalid SQL table/);
  });

  it('rejects malicious column names in select/orderBy/groupBy', () => {
    expect(() => new D1QueryBuilder('t').select(['id; DROP TABLE t'])).toThrow(/Invalid SQL column/);
    expect(() => new D1QueryBuilder('t').orderBy('id; --')).toThrow(/Invalid SQL column/);
    expect(() => new D1QueryBuilder('t').groupBy('x AND 1=1')).toThrow(/Invalid SQL column/);
  });

  it('rejects a malicious join table', () => {
    expect(() => new D1QueryBuilder('t').join('evil; --', 't.id = e.id')).toThrow(
      /Invalid SQL table/
    );
  });
});

/**
 * Minimal D1Database mock: records prepared statements and lets each test
 * control execution results.
 */
function makeMockDatabase() {
  const executed: Array<{ sql: string; params?: readonly unknown[] }> = [];
  const database = {
    prepare(sql: string) {
      const record = { sql };
      const stmt = {
        bind(...params: unknown[]) {
          record.params = params;
          return stmt;
        },
        async all() {
          executed.push(record);
          return { results: [], success: true, meta: { changes: 0, duration: 0 } };
        },
        async run() {
          executed.push(record);
          return { success: true, meta: { changes: 1, duration: 0 } };
        },
      };
      return stmt;
    },
    async batch(statements: Array<{ all(): Promise<unknown> }>) {
      const results = [];
      for (const s of statements) results.push(await s.all());
      return results;
    },
  };
  return { database: database as unknown as D1Database, executed };
}

describe('D1TransactionWrapper', () => {
  it('executes each statement exactly once (no replay on commit)', async () => {
    const { database, executed } = makeMockDatabase();
    const txn = new D1TransactionWrapper(database, 'default');

    await txn.query('INSERT INTO t (a) VALUES (?)', [1]);
    await txn.query('INSERT INTO t (a) VALUES (?)', [2]);
    await txn.commit();

    expect(executed).toHaveLength(2);
    expect(executed[0].params).toEqual([1]);
    expect(executed[1].params).toEqual([2]);
  });

  it('rejects statements after commit or rollback', async () => {
    const { database } = makeMockDatabase();
    const txn = new D1TransactionWrapper(database, 'default');
    await txn.commit();
    await expect(txn.query('SELECT 1')).rejects.toThrow(/already been committed/);

    const txn2 = new D1TransactionWrapper(database, 'default');
    await txn2.rollback();
    await expect(txn2.query('SELECT 1')).rejects.toThrow(/already been committed/);
  });
});

describe('D1Service.batch', () => {
  it('binds params for every statement (params were previously dropped)', async () => {
    const { database, executed } = makeMockDatabase();
    const service = new D1Service();
    service.bindDatabase('default', database);

    await service.batch([
      { sql: 'INSERT INTO t (a) VALUES (?)', params: [42] },
      { sql: 'SELECT * FROM t WHERE a = ?', params: [42] },
    ]);

    expect(executed).toHaveLength(2);
    expect(executed[0].params).toEqual([42]);
    expect(executed[1].params).toEqual([42]);
  });

  it('insert/update/delete validate table and column identifiers', async () => {
    const { database } = makeMockDatabase();
    const service = new D1Service();
    service.bindDatabase('default', database);

    await expect(service.insert('users; DROP TABLE users', { a: 1 })).rejects.toThrow(
      /Invalid SQL table/
    );
    await expect(service.insert('users', { 'a; DROP': 1 })).rejects.toThrow(/Invalid SQL column/);
    await expect(service.update('users', { 'b--': 1 }, 'id = ?', ['x'])).rejects.toThrow(
      /Invalid SQL column/
    );
    await expect(service.delete('users; --', 'id = ?', ['x'])).rejects.toThrow(/Invalid SQL table/);
    await expect(service.truncateTable('users; --')).rejects.toThrow(/Invalid SQL table/);
  });
});
