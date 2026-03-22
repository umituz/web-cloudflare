/**
 * Wrangler Service Implementation
 * Wraps Wrangler CLI commands with TypeScript
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import type {
  WranglerResult,
  WranglerCommandOptions,
  AuthInfo,
  KVNamespaceInfo,
  R2BucketInfo,
  D1DatabaseInfo,
  SecretInfo,
  WorkerVersionInfo,
} from '../../../domain/entities/wrangler.entity';
import type { IWranglerService } from '../../../domain/interfaces/wrangler.interface';

const execAsync = promisify(exec);

export class WranglerService implements IWranglerService {
  private readonly wranglerCommand: string;

  constructor(options?: { wranglerPath?: string }) {
    this.wranglerCommand = options?.wranglerPath || 'npx wrangler';
  }

  /**
   * Execute a wrangler command
   */
  private async execute(
    args: string[],
    options: WranglerCommandOptions = {}
  ): Promise<WranglerResult<string>> {
    const { cwd = process.cwd(), env = {}, timeout = 30000, silent = false } = options;

    const command = `${this.wranglerCommand} ${args.join(' ')}`;

    try {
      if (!silent) {
        console.log(`🔧 Executing: ${command}`);
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env: { ...process.env, ...env },
        timeout,
      });

      return {
        success: true,
        data: stdout.trim(),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        error: err.stderr || err.stdout || String(error),
        exitCode: err.code,
      };
    }
  }

  /**
   * Execute a wrangler command with streaming (for dev, tail, etc.)
   */
  private executeStreaming(
    args: string[],
    options: WranglerCommandOptions = {}
  ): Promise<WranglerResult<void>> {
    return new Promise((resolve, reject) => {
      const { cwd = process.cwd(), env = {} } = options;
      const argsWithCommand = this.wranglerCommand.split(' ').concat(args);

      const child = spawn(argsWithCommand[0], argsWithCommand.slice(1), {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `Command exited with code ${code}`,
            exitCode: code,
          });
        }
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  }

  /**
   * Parse JSON from stdout
   */
  private parseJSON<T>(stdout: string): T | null {
    try {
      // Find JSON in output (wrangler sometimes outputs text before JSON)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return JSON.parse(stdout) as T;
    } catch {
      return null;
    }
  }

  // ==================== Authentication ====================

  async login(options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>> {
    const result = await this.execute(['login'], options);
    if (result.success) {
      return {
        ...result,
        data: { email: 'authenticated' },
      };
    }
    return result;
  }

  async logout(options?: WranglerCommandOptions): Promise<WranglerResult<void>> {
    return this.execute(['logout'], options);
  }

  async whoami(options?: WranglerCommandOptions): Promise<WranglerResult<AuthInfo>> {
    const result = await this.execute(['whoami', '--json'], options);
    if (result.success && result.data) {
      const data = this.parseJSON<AuthInfo>(result.data);
      return {
        ...result,
        data: data || { email: 'authenticated' },
      };
    }
    return result;
  }

  // ==================== Project Management ====================

  async init(
    projectName: string,
    template?: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    const args = ['init', projectName];
    if (template) {
      args.push('--template', template);
    }
    return this.execute(args, options);
  }

  async dev(
    options?: WranglerCommandOptions & { port?: number; local?: boolean }
  ): Promise<WranglerResult<void>> {
    const args = ['dev'];
    if (options?.port) {
      args.push('--port', options.port.toString());
    }
    if (options?.local) {
      args.push('--local');
    }
    return this.executeStreaming(args, options);
  }

  async deploy(
    options?: WranglerCommandOptions & { env?: string }
  ): Promise<WranglerResult<{ url?: string }>> {
    const args = ['deploy'];
    if (options?.env) {
      args.push('--env', options.env);
    }
    const result = await this.execute(args, options);

    if (result.success && result.data) {
      // Extract URL from output
      const urlMatch = result.data.match(/https?:\/\/[^\s]+/);
      return {
        ...result,
        data: { url: urlMatch?.[0] },
      };
    }

    return result;
  }

  async deleteWorker(
    workerName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    return this.execute(['delete', workerName], options);
  }

  // ==================== KV Operations ====================

  async kvNamespaceCreate(
    title: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<KVNamespaceInfo>> {
    const result = await this.execute(['kv:namespace', 'create', title], options);
    if (result.success && result.data) {
      const data = this.parseJSON<KVNamespaceInfo>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  async kvNamespaceList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<KVNamespaceInfo[]>> {
    const result = await this.execute(['kv:namespace', 'list'], options);
    if (result.success && result.data) {
      const data = this.parseJSON<KVNamespaceInfo[]>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  async kvKeyPut(
    namespaceId: string,
    key: string,
    value: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    return this.execute(['kv:key', 'put', '--namespace-id', namespaceId, key, value], options);
  }

  async kvKeyGet(
    namespaceId: string,
    key: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<string>> {
    return this.execute(['kv:key', 'get', '--namespace-id', namespaceId, key], options);
  }

  async kvKeyDelete(
    namespaceId: string,
    key: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    return this.execute(['kv:key', 'delete', '--namespace-id', namespaceId, key], options);
  }

  // ==================== R2 Operations ====================

  async r2BucketCreate(
    bucketName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<R2BucketInfo>> {
    const result = await this.execute(['r2', 'bucket', 'create', bucketName], options);
    if (result.success) {
      return {
        ...result,
        data: { name: bucketName },
      };
    }
    return result;
  }

  async r2BucketList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<R2BucketInfo[]>> {
    const result = await this.execute(['r2', 'bucket', 'list'], options);
    if (result.success && result.data) {
      const data = this.parseJSON<R2BucketInfo[]>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  async r2BucketDelete(
    bucketName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    return this.execute(['r2', 'bucket', 'delete', bucketName], options);
  }

  async r2ObjectPut(
    bucketName: string,
    key: string,
    file: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    return this.execute(['r2', 'object', 'put', bucketName, key, '--file', file], options);
  }

  // ==================== D1 Operations ====================

  async d1Create(
    databaseName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<D1DatabaseInfo>> {
    const result = await this.execute(['d1', 'create', databaseName], options);
    if (result.success && result.data) {
      const data = this.parseJSON<D1DatabaseInfo>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  async d1List(options?: WranglerCommandOptions): Promise<WranglerResult<D1DatabaseInfo[]>> {
    const result = await this.execute(['d1', 'list'], options);
    if (result.success && result.data) {
      const data = this.parseJSON<D1DatabaseInfo[]>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  async d1Execute(
    databaseName: string,
    command: string,
    file?: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<unknown[]>> {
    const args = ['d1', 'execute', databaseName];
    if (file) {
      args.push('--file', file);
    } else {
      args.push('--command', command);
    }
    const result = await this.execute(args, options);
    if (result.success && result.data) {
      const data = this.parseJSON<unknown[]>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  // ==================== Secrets ====================

  async secretPut(
    secretName: string,
    value: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    // For secrets, we need to use stdin
    return new Promise((resolve) => {
      const args = ['secret', 'put', secretName];
      const argsWithCommand = this.wranglerCommand.split(' ').concat(args);

      const child = spawn(argsWithCommand[0], argsWithCommand.slice(1), {
        cwd: options?.cwd || process.cwd(),
        env: { ...process.env, ...options?.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, stdout: stdout.trim() });
        } else {
          resolve({
            success: false,
            error: stderr || 'Failed to put secret',
            exitCode: code,
          });
        }
      });

      // Write the secret value to stdin
      child.stdin?.write(value);
      child.stdin?.end();
    });
  }

  async secretList(options?: WranglerCommandOptions): Promise<WranglerResult<SecretInfo[]>> {
    const result = await this.execute(['secret', 'list'], options);
    if (result.success && result.data) {
      const data = this.parseJSON<SecretInfo[]>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  async secretDelete(
    secretName: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    return this.execute(['secret', 'delete', secretName], options);
  }

  // ==================== Monitoring ====================

  async tail(
    options?: WranglerCommandOptions & { format?: 'pretty' | 'json' }
  ): Promise<WranglerResult<void>> {
    const args = ['tail'];
    if (options?.format) {
      args.push('--format', options.format);
    }
    return this.executeStreaming(args, options);
  }

  // ==================== Versions ====================

  async versionsList(
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<WorkerVersionInfo[]>> {
    const result = await this.execute(['versions', 'list'], options);
    if (result.success && result.data) {
      const data = this.parseJSON<WorkerVersionInfo[]>(result.data);
      if (data) {
        return { ...result, data };
      }
    }
    return result;
  }

  async versionsRollback(
    versionId: string,
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<void>> {
    return this.execute(['versions', 'rollback', '--version-id', versionId], options);
  }

  // ==================== Generic Command Execution ====================

  async executeCommand(
    command: string,
    args: string[],
    options?: WranglerCommandOptions
  ): Promise<WranglerResult<string>> {
    return this.execute([command, ...args], options);
  }
}
