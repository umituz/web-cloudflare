/**
 * Wrangler Service Interface
 * Defines the contract for Wrangler CLI operations
 */

import type {
  WranglerResult,
  WranglerCommandOptions,
  AuthInfo,
  KVNamespaceInfo,
  R2BucketInfo,
  D1DatabaseInfo,
  SecretInfo,
  WorkerVersionInfo,
  WranglerAnalyticsData,
} from '../entities';

export interface IWranglerService {
  // Authentication
  login(options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>>;
  logout(options?: WranglerCommandOptions): Promise<WranglerResult<void>>;
  whoami(options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>>;

  // Project management
  init(
    projectName: string,
    template?: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;
  dev(
    options?: WranglerCommandOptions & { port?: number; local?: boolean }
  ): Promise<WranglerResult<void>>;
  deploy(
    options?: WranglerCommandOptions & { env?: string }
  ): Promise<WranglerResult<{ url?: string }>>;
  deleteWorker(
    workerName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;

  // KV operations
  kvNamespaceCreate(
    title: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<KVNamespaceInfo>>;
  kvNamespaceList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<KVNamespaceInfo[]>>;
  kvKeyPut(
    namespaceId: string,
    key: string,
    value: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;
  kvKeyGet(
    namespaceId: string,
    key: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<string>>;
  kvKeyDelete(
    namespaceId: string,
    key: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;

  // R2 operations
  r2BucketCreate(
    bucketName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<R2BucketInfo>>;
  r2BucketList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<R2BucketInfo[]>>;
  r2BucketDelete(
    bucketName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;
  r2ObjectPut(
    bucketName: string,
    key: string,
    file: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;

  // D1 operations
  d1Create(
    databaseName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<D1DatabaseInfo>>;
  d1List(options?: WranglerCommandOptions): Promise<WranglerResult<D1DatabaseInfo[]>>;
  d1Execute(
    databaseName: string,
    command: string,
    file?: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<unknown[]>>;

  // Secrets
  secretPut(
    secretName: string,
    value: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;
  secretList(options?: WranglerCommandOptions): Promise<WranglerResult<SecretInfo[]>>;
  secretDelete(
    secretName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;

  // Monitoring
  tail(
    options?: WranglerCommandOptions & { format?: 'pretty' | 'json' }
  ): Promise<WranglerResult<void>>;

  // Versions
  versionsList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<WorkerVersionInfo[]>>;
  versionsRollback(
    versionId: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;

  // Generic command execution
  executeCommand(
    command: string,
    args: string[],
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<string>>;
}
