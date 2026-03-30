/**
 * Wrangler Service Implementation
 * Wraps Wrangler CLI commands with TypeScript
 *
 * ⚠️ NODE.JS ONLY: This service requires Node.js runtime and is NOT compatible
 * with Cloudflare Workers runtime. Use this service only in build/development
 * scripts running in Node.js environment.
 */

import { execSync } from 'child_process';
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
import type { IWranglerService } from '../types/service.interface';

export class WranglerService implements IWranglerService {
  private readonly wranglerCommand: string;

  constructor(options?: { wranglerPath?: string }) {
    this.wranglerCommand = options?.wranglerPath || 'npx wrangler';
  }

  // Authentication
  async login(_options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>> {
    const result = this.executeWrangler(['login']);
    if (result.success) {
      return { success: true, data: { authenticated: true } as AuthInfo };
    }
    return { success: false, error: result.stderr };
  }

  async logout(_options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['logout']);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async whoami(_options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>> {
    const result = this.executeWrangler(['whoami']);
    if (result.success) {
      return { success: true, data: { authenticated: true } as AuthInfo };
    }
    return { success: false, error: result.stderr };
  }

  // Project management
  async init(projectName: string, template?: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const args = ['init', projectName];
    if (template) {
      args.push(template);
    }
    const result = this.executeWrangler(args);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async dev(_options?: WranglerCommandOptions & { port?: number; local?: boolean }): Promise<WranglerResult<void>> {
    const args = ['dev'];
    if (_options?.port) {
      args.push('--port', _options.port.toString());
    }
    if (_options?.local) {
      args.push('--local');
    }
    const result = this.executeWrangler(args);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async deploy(_options?: WranglerCommandOptions & { env?: string }): Promise<WranglerResult<{ url?: string }>> {
    const args = ['deploy'];
    if (_options?.env) {
      args.push('--env', _options.env);
    }
    const result = this.executeWrangler(args);
    if (result.success) {
      const url = this.extractUrl(result.stdout);
      return { success: true, data: { url } };
    }
    return { success: false, error: result.stderr };
  }

  async deleteWorker(workerName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['delete', workerName]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  // KV operations
  async kvNamespaceCreate(title: string, _options?: WranglerCommandOptions): Promise<WranglerResult<KVNamespaceInfo>> {
    const result = this.executeWrangler(['kv:namespace', 'create', title]);
    if (result.success) {
      const id = this.extractId(result.stdout) || '';
      return { success: true, data: { id, title } };
    }
    return { success: false, error: result.stderr };
  }

  async kvNamespaceList(_options?: WranglerCommandOptions): Promise<WranglerResult<KVNamespaceInfo[]>> {
    const result = this.executeWrangler(['kv:namespace', 'list']);
    if (result.success) {
      const namespaces = this.parseTableOutput(result.stdout);
      return { success: true, data: namespaces };
    }
    return { success: false, error: result.stderr };
  }

  async kvKeyPut(namespaceId: string, key: string, value: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['kv:key', 'put', '--binding', namespaceId, key, value]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async kvKeyList(namespaceId: string, _options?: WranglerCommandOptions): Promise<WranglerResult<string[]>> {
    const result = this.executeWrangler(['kv:key', 'list', '--binding', namespaceId]);
    if (result.success) {
      const keys = this.parseKeyList(result.stdout);
      return { success: true, data: keys };
    }
    return { success: false, error: result.stderr };
  }

  async kvKeyGet(namespaceId: string, key: string, _options?: WranglerCommandOptions): Promise<WranglerResult<string>> {
    const result = this.executeWrangler(['kv:key', 'get', '--binding', namespaceId, key]);
    if (result.success) {
      return { success: true, data: result.stdout.trim() };
    }
    return { success: false, error: result.stderr };
  }

  async kvKeyDelete(namespaceId: string, key: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['kv:key', 'delete', '--binding', namespaceId, key]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  // R2 operations
  async r2BucketCreate(bucketName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<R2BucketInfo>> {
    const result = this.executeWrangler(['r2:bucket', 'create', bucketName]);
    if (result.success) {
      return { success: true, data: { name: bucketName } };
    }
    return { success: false, error: result.stderr };
  }

  async r2BucketList(_options?: WranglerCommandOptions): Promise<WranglerResult<R2BucketInfo[]>> {
    const result = this.executeWrangler(['r2:bucket', 'list']);
    if (result.success) {
      const buckets = this.parseTableOutput(result.stdout);
      return { success: true, data: buckets };
    }
    return { success: false, error: result.stderr };
  }

  async r2BucketDelete(bucketName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['r2:bucket', 'delete', bucketName]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async r2ObjectPut(bucketName: string, key: string, file: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['r2:object', 'put', bucketName, key, '--file', file]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async r2ObjectGet(bucketName: string, key: string, file: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['r2:object', 'get', bucketName, key, '--file', file]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async r2ObjectDelete(bucketName: string, key: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['r2:object', 'delete', bucketName, key]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  // D1 operations
  async d1DatabaseCreate(databaseName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<D1DatabaseInfo>> {
    const result = this.executeWrangler(['d1:create', databaseName]);
    if (result.success) {
      const id = this.extractId(result.stdout) || '';
      return { success: true, data: { id, name: databaseName } as unknown as D1DatabaseInfo };
    }
    return { success: false, error: result.stderr };
  }

  async d1DatabaseList(_options?: WranglerCommandOptions): Promise<WranglerResult<D1DatabaseInfo[]>> {
    const result = this.executeWrangler(['d1:list']);
    if (result.success) {
      const databases = this.parseTableOutput(result.stdout);
      return { success: true, data: databases };
    }
    return { success: false, error: result.stderr };
  }

  async d1Create(databaseName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<D1DatabaseInfo>> {
    return this.d1DatabaseCreate(databaseName, _options);
  }

  async d1List(_options?: WranglerCommandOptions): Promise<WranglerResult<D1DatabaseInfo[]>> {
    return this.d1DatabaseList(_options);
  }

  async d1Execute(databaseName: string, command: string, file?: string, _options?: WranglerCommandOptions): Promise<WranglerResult<unknown[]>> {
    const args = ['d1:execute', databaseName];
    if (file) {
      args.push('--file', file);
    } else {
      args.push('--command', command);
    }
    const result = this.executeWrangler(args);
    if (result.success) {
      return { success: true, data: [] };
    }
    return { success: false, error: result.stderr };
  }

  // Secret management
  async secretPut(secretName: string, value: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['secret', 'put', secretName, value]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  async secretList(_options?: WranglerCommandOptions): Promise<WranglerResult<SecretInfo[]>> {
    const result = this.executeWrangler(['secret', 'list']);
    if (result.success) {
      const secrets = this.parseTableOutput(result.stdout);
      return { success: true, data: secrets };
    }
    return { success: false, error: result.stderr };
  }

  async secretDelete(secretName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['secret', 'delete', secretName]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  // Monitoring
  async tail(_options?: WranglerCommandOptions & { format?: 'pretty' | 'json' }): Promise<WranglerResult<void>> {
    const args = ['tail'];
    if (_options?.format) {
      args.push('--format', _options.format);
    }
    const result = this.executeWrangler(args);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  // Versions
  async versionsList(_options?: WranglerCommandOptions): Promise<WranglerResult<WorkerVersionInfo[]>> {
    const result = this.executeWrangler(['versions', 'list']);
    if (result.success) {
      const versions = this.parseTableOutput(result.stdout);
      return { success: true, data: versions };
    }
    return { success: false, error: result.stderr };
  }

  async versionsRollback(versionId: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['versions', 'rollback', versionId]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  // Generic command execution
  async executeCommand(command: string, args: string[], _options?: WranglerCommandOptions): Promise<WranglerResult<string>> {
    const result = this.executeWrangler([command, ...args]);
    if (result.success) {
      return { success: true, data: result.stdout };
    }
    return { success: false, error: result.stderr };
  }

  // Pages operations
  async pagesProjectCreate(projectName: string, _options?: WranglerCommandOptions & { productionBranch?: string }): Promise<WranglerResult<PagesProjectInfo>> {
    const args = ['pages', 'project', 'create', projectName];
    if (_options?.productionBranch) {
      args.push('--production-branch', _options.productionBranch);
    }
    const result = this.executeWrangler(args);
    if (result.success) {
      return { success: true, data: { name: projectName } };
    }
    return { success: false, error: result.stderr };
  }

  async pagesProjectList(_options?: WranglerCommandOptions): Promise<WranglerResult<PagesProjectInfo[]>> {
    const result = this.executeWrangler(['pages', 'project', 'list']);
    if (result.success) {
      const projects = this.parseTableOutput(result.stdout);
      return { success: true, data: projects };
    }
    return { success: false, error: result.stderr };
  }

  async pagesDeploy(options: PagesDeployOptions & WranglerCommandOptions): Promise<WranglerResult<PagesDeploymentInfo>> {
    const args = ['pages', 'deploy', options.directory || 'dist', '--project-name', options.projectName];
    if (options.branch) {
      args.push('--branch', options.branch);
    }
    const result = this.executeWrangler(args);
    if (result.success) {
      const url = this.extractUrl(result.stdout) || '';
      return { success: true, data: { id: Date.now().toString(), url, project: '' } as PagesDeploymentInfo };
    }
    return { success: false, error: result.stderr };
  }

  async pagesFunctionCreate(projectName: string, functionName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['pages', 'function', 'create', projectName, functionName]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Delete a Pages project
   */
  async pagesProjectDelete(projectName: string, _options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    const result = this.executeWrangler(['pages', 'project', 'delete', projectName]);
    if (result.success) {
      return { success: true, data: undefined };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * List all Workers
   */
  async workersList(_options?: WranglerCommandOptions): Promise<WranglerResult<string[]>> {
    const result = this.executeWrangler(['workers', 'list']);
    if (result.success) {
      const workers = this.parseTableOutput(result.stdout);
      return { success: true, data: workers.map((w: any) => w.name || w) };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Execute wrangler command
   */
  private executeWrangler(
    args: string[],
    options?: { cwd?: string; env?: Record<string, string> }
  ): { success: boolean; stdout: string; stderr: string; exitCode?: number } {
    try {
      const command = `${this.wranglerCommand} ${args.join(' ')}`;
      const stdout = execSync(command, {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        encoding: 'utf-8',
      });
      return { success: true, stdout, stderr: '', exitCode: 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        const err = error as { stdout?: string; stderr?: string; code?: number };
        return {
          success: false,
          stdout: err.stdout || '',
          stderr: err.stderr || error.message,
          exitCode: err.code,
        };
      }
      return { success: false, stdout: '', stderr: 'Unknown error', exitCode: -1 };
    }
  }

  /**
   * Extract ID from wrangler output
   */
  private extractId(stdout: string): string | undefined {
    const idMatch = stdout.match(/id\s*=\s*([a-f0-9-]+)/i);
    return idMatch ? idMatch[1] : undefined;
  }

  /**
   * Extract URL from wrangler output
   */
  private extractUrl(stdout: string): string | undefined {
    const urlMatch = stdout.match(/https?:\/\/[^\s]+\.pages\.dev[^\s]*/);
    return urlMatch ? urlMatch[0] : undefined;
  }

  /**
   * Parse table output from wrangler
   */
  private parseTableOutput(stdout: string): any[] {
    const items: any[] = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('│')) {
        const parts = line.split('│').map((s) => s.trim());
        if (parts.length >= 2 && parts[1] && parts[1] !== 'name') {
          items.push({ name: parts[1] });
        }
      }
    }
    return items;
  }

  /**
   * Parse key list from wrangler output
   */
  private parseKeyList(stdout: string): string[] {
    const keys: string[] = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('─') && !trimmed.toLowerCase().includes('key')) {
        keys.push(trimmed);
      }
    }
    return keys;
  }
}

// Export singleton instance
export const wranglerService = new WranglerService();
