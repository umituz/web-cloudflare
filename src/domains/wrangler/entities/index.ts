
export enum WranglerCommand {
  LOGIN = 'login',
  LOGOUT = 'logout',
  WHOAMI = 'whoami',

  INIT = 'init',
  DEV = 'dev',
  DEPLOY = 'deploy',
  DELETE = 'delete',

  KV_NAMESPACE_CREATE = 'kv:namespace create',
  KV_NAMESPACE_LIST = 'kv:namespace list',
  KV_KEY_PUT = 'kv:key put',
  KV_KEY_GET = 'kv:key get',
  KV_KEY_LIST = 'kv:key list',
  KV_KEY_DELETE = 'kv:key delete',

  R2_BUCKET_CREATE = 'r2 bucket create',
  R2_BUCKET_LIST = 'r2 bucket list',
  R2_BUCKET_DELETE = 'r2 bucket delete',
  R2_OBJECT_PUT = 'r2 object put',
  R2_OBJECT_GET = 'r2 object get',
  R2_OBJECT_LIST = 'r2 object list',
  R2_OBJECT_DELETE = 'r2 object delete',

  D1_CREATE = 'd1 create',
  D1_LIST = 'd1 list',
  D1_EXECUTE = 'd1 execute',
  D1_BACKUP = 'd1 backups create',

  SECRET_PUT = 'secret put',
  SECRET_LIST = 'secret list',
  SECRET_DELETE = 'secret delete',

  TAIL = 'tail',
  ANALYTICS = 'analytics',

  VERSIONS_LIST = 'versions list',
  VERSIONS_ROLLBACK = 'versions rollback',

  PAGES_PROJECT_CREATE = 'pages project create',
  PAGES_PROJECT_LIST = 'pages project list',
  PAGES_DEPLOY = 'pages deploy',
  PAGES_FUNCTION = 'pages function',
}

export interface WranglerResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export interface WranglerCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  silent?: boolean;
}

export interface AuthInfo {
  email?: string;
  accountId?: string;
  username?: string;
}

export interface KVNamespaceInfo {
  id: string;
  title: string;
  supportsUrlEncoding?: boolean;
}

export interface R2BucketInfo {
  name: string;
  creationDate?: string;
  location?: string;
}

export interface D1DatabaseInfo {
  uuid: string;
  name: string;
  created_at: string;
  version?: string;
}

export interface SecretInfo {
  name: string;
  type?: string;
}

export interface WorkerVersionInfo {
  id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface WranglerAnalyticsData {
  requests?: number;
  errors?: number;
  statusCodes?: Record<string, number>;
  countries?: Record<string, number>;
}

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

