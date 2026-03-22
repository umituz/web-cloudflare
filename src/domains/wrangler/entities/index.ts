/**
 * Wrangler CLI Domain Entities
 * Defines entities for Wrangler CLI operations
 */

/**
 * Wrangler command types
 */
export enum WranglerCommand {
  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  WHOAMI = 'whoami',

  // Project management
  INIT = 'init',
  DEV = 'dev',
  DEPLOY = 'deploy',
  DELETE = 'delete',

  // KV operations
  KV_NAMESPACE_CREATE = 'kv:namespace create',
  KV_NAMESPACE_LIST = 'kv:namespace list',
  KV_KEY_PUT = 'kv:key put',
  KV_KEY_GET = 'kv:key get',
  KV_KEY_LIST = 'kv:key list',
  KV_KEY_DELETE = 'kv:key delete',

  // R2 operations
  R2_BUCKET_CREATE = 'r2 bucket create',
  R2_BUCKET_LIST = 'r2 bucket list',
  R2_BUCKET_DELETE = 'r2 bucket delete',
  R2_OBJECT_PUT = 'r2 object put',
  R2_OBJECT_GET = 'r2 object get',
  R2_OBJECT_LIST = 'r2 object list',
  R2_OBJECT_DELETE = 'r2 object delete',

  // D1 operations
  D1_CREATE = 'd1 create',
  D1_LIST = 'd1 list',
  D1_EXECUTE = 'd1 execute',
  D1_BACKUP = 'd1 backups create',

  // Secrets
  SECRET_PUT = 'secret put',
  SECRET_LIST = 'secret list',
  SECRET_DELETE = 'secret delete',

  // Monitoring
  TAIL = 'tail',
  ANALYTICS = 'analytics',

  // Versions
  VERSIONS_LIST = 'versions list',
  VERSIONS_ROLLBACK = 'versions rollback',

  // Pages operations
  PAGES_PROJECT_CREATE = 'pages project create',
  PAGES_PROJECT_LIST = 'pages project list',
  PAGES_DEPLOY = 'pages deploy',
  PAGES_FUNCTION = 'pages function',
}

/**
 * Wrangler execution result
 */
export interface WranglerResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

/**
 * Wrangler command options
 */
export interface WranglerCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  silent?: boolean;
}

/**
 * Auth information
 */
export interface AuthInfo {
  email?: string;
  accountId?: string;
  username?: string;
}

/**
 * KV namespace info
 */
export interface KVNamespaceInfo {
  id: string;
  title: string;
  supportsUrlEncoding?: boolean;
}

/**
 * R2 bucket info
 */
export interface R2BucketInfo {
  name: string;
  creationDate?: string;
  location?: string;
}

/**
 * D1 database info
 */
export interface D1DatabaseInfo {
  uuid: string;
  name: string;
  created_at: string;
  version?: string;
}

/**
 * Secret info
 */
export interface SecretInfo {
  name: string;
  type?: string;
}

/**
 * Worker version info
 */
export interface WorkerVersionInfo {
  id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wrangler analytics data
 */
export interface WranglerAnalyticsData {
  requests?: number;
  errors?: number;
  statusCodes?: Record<string, number>;
  countries?: Record<string, number>;
}

/**
 * Pages project info
 */
export interface PagesProjectInfo {
  name: string;
  production_branch?: string;
  creation_date?: string;
  deployment_configs?: {
    preview?: {
      branch?: string;
      env_vars?: Record<string, string>;
    };
    production?: {
      branch?: string;
      env_vars?: Record<string, string>;
    };
  };
}

/**
 * Pages deployment info
 */
export interface PagesDeploymentInfo {
  id: string;
  project: string;
  url: string;
  latest_stage?: string;
  created_on?: string;
  deployment_trigger?: {
    metadata?: {
      branch?: string;
      commit_hash?: string;
    };
  };
}

/**
 * Pages deploy options
 */
export interface PagesDeployOptions {
  projectName: string;
  directory?: string;
  branch?: string;
  preview?: boolean;
  environment?: 'preview' | 'production';
  compatibilityDate?: string;
  compatibilityFlags?: string[];
  vars?: Record<string, string>;
}

