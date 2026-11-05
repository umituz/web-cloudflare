
import type {
  WranglerResult,
  WranglerCommandOptions,
  AuthInfo,
  KVNamespaceInfo,
  R2BucketInfo,
  D1DatabaseInfo,
  SecretInfo,
  WorkerVersionInfo,
  PagesProjectInfo,
  PagesDeploymentInfo,
  PagesDeployOptions,
} from '../entities';

export interface IWranglerService {
  login(options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>>;
  logout(options?: WranglerCommandOptions): Promise<WranglerResult<void>>;
  whoami(options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>>;

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

  kvNamespaceCreate(
    title: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<KVNamespaceInfo>>;
  kvNamespaceList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<Array<Pick<KVNamespaceInfo, 'title'>>>>;
  kvKeyPut(
    namespaceId: string,
    key: string,
    value: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;
  kvKeyList(
    namespaceId: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<string[]>>;
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

  d1Create(
    databaseName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<D1DatabaseInfo>>;
  d1List(options?: WranglerCommandOptions): Promise<WranglerResult<Array<Pick<D1DatabaseInfo, 'name'>>>>;
  d1Execute(
    databaseName: string,
    command: string,
    file?: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<unknown[]>>;

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

  tail(
    options?: WranglerCommandOptions & { format?: 'pretty' | 'json' }
  ): Promise<WranglerResult<void>>;

  versionsList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<Array<Pick<WorkerVersionInfo, 'id'>>>>;
  versionsRollback(
    versionId: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;

  executeCommand(
    command: string,
    args: string[],
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<string>>;

  pagesProjectCreate(
    projectName: string,
    options?: WranglerCommandOptions & { productionBranch?: string }
  ): Promise<WranglerResult<PagesProjectInfo>>;
  pagesProjectList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<PagesProjectInfo[]>>;
  pagesProjectDelete(
    projectName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;
  pagesDeploy(
    options: PagesDeployOptions & WranglerCommandOptions
  ): Promise<WranglerResult<PagesDeploymentInfo>>;
  pagesFunctionCreate(
    projectName: string,
    functionName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>>;

  workersList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<string[]>>;
}
