/**
 * Pages Service Implementation
 * Cloudflare Pages deployment and management
 *
 * ⚠️ NODE.JS ONLY: This service requires Node.js runtime and is NOT compatible
 * with Cloudflare Workers runtime. Use this service only in build/development
 * scripts running in Node.js environment.
 */

import { execSync } from 'child_process';
import type { IPagesService } from '../types/service.interface';
import type {
  PagesProject,
  PagesDeployment,
  PagesDeployOptions,
  PagesFunction,
  PagesDeploymentResult,
} from '../entities';

export class PagesService implements IPagesService {
  private readonly wranglerCommand: string;

  constructor(options?: { wranglerPath?: string }) {
    this.wranglerCommand = options?.wranglerPath || 'npx wrangler';
  }

  /**
   * Create a new Pages project
   */
  async createProject(
    projectName: string,
    options?: {
      productionBranch?: string;
      compatibilityDate?: string;
    }
  ): Promise<{ success: boolean; data?: PagesProject; error?: string }> {
    const args = ['project', 'create', projectName];
    if (options?.productionBranch) {
      args.push('--production-branch', options.productionBranch);
    }

    const result = this.executeWranglerPages(args);
    if (result.success) {
      return {
        success: true,
        data: {
          name: projectName,
          production_branch: options?.productionBranch,
        },
      };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * List all Pages projects
   */
  async listProjects(): Promise<{ success: boolean; data?: PagesProject[]; error?: string }> {
    const result = this.executeWranglerPages(['project', 'list']);
    if (result.success) {
      // Parse output to get project list
      try {
        const projects = this.parseProjectsList(result.stdout);
        return { success: true, data: projects };
      } catch {
        return { success: true, data: [] };
      }
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Get project details
   */
  async getProject(projectName: string): Promise<{ success: boolean; data?: PagesProject; error?: string }> {
    const result = this.executeWranglerPages(['project', 'view', projectName]);
    if (result.success) {
      return {
        success: true,
        data: { name: projectName },
      };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Deploy to Pages
   */
  async deploy(
    options: PagesDeployOptions
  ): Promise<{ success: boolean; data?: PagesDeploymentResult; error?: string }> {
    const args = ['deploy', options.directory || 'dist', '--project-name', options.projectName];

    if (options.branch) {
      args.push('--branch', options.branch);
    }

    if (options.environment === 'preview') {
      args.push('--branch', `preview-${Date.now()}`);
    }

    // Add environment variables
    if (options.vars && Object.keys(options.vars).length > 0) {
      Object.entries(options.vars).forEach(([key, value]) => {
        args.push('--var', `${key}:${value}`);
      });
    }

    const result = this.executeWranglerPages(args);
    if (result.success) {
      const url = this.extractDeploymentUrl(result.stdout);
      return {
        success: true,
        data: {
          deployment: {
            id: Date.now().toString(),
            project: options.projectName,
            url: url || '',
          },
          url,
        },
      };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Create a Pages function
   */
  async createFunction(
    projectName: string,
    functionName: string,
    options?: {
      compatibilityDate?: string;
      compatibilityFlags?: string[];
    }
  ): Promise<{ success: boolean; data?: PagesFunction; error?: string }> {
    const args = ['function', 'create', projectName, functionName];

    if (options?.compatibilityDate) {
      args.push('--compatibility-date', options.compatibilityDate);
    }

    const result = this.executeWranglerPages(args);
    if (result.success) {
      return {
        success: true,
        data: {
          name: functionName,
          compatibilityDate: options?.compatibilityDate,
        },
      };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * List deployments for a project
   */
  async listDeployments(
    projectName: string
  ): Promise<{ success: boolean; data?: PagesDeployment[]; error?: string }> {
    const result = this.executeWranglerPages(['deployment', 'list', '--project-name', projectName]);
    if (result.success) {
      return { success: true, data: [] };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Get deployment details
   */
  async getDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<{ success: boolean; data?: PagesDeployment; error?: string }> {
    const result = this.executeWranglerPages([
      'deployment',
      'view',
      deploymentId,
      '--project-name',
      projectName,
    ]);
    if (result.success) {
      return {
        success: true,
        data: {
          id: deploymentId,
          project: projectName,
          url: '',
        },
      };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = this.executeWranglerPages([
      'deployment',
      'delete',
      deploymentId,
      '--project-name',
      projectName,
    ]);
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.stderr };
  }

  /**
   * Execute wrangler pages command
   */
  private executeWranglerPages(
    args: string[],
    options?: { cwd?: string; env?: Record<string, string> }
  ): { success: boolean; stdout: string; stderr: string; exitCode?: number } {
    try {
      const command = `${this.wranglerCommand} pages ${args.join(' ')}`;
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
   * Parse projects list output
   */
  private parseProjectsList(stdout: string): PagesProject[] {
    const projects: PagesProject[] = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('│')) {
        const parts = line.split('│').map((s) => s.trim());
        if (parts.length >= 2 && parts[1]) {
          projects.push({ name: parts[1] });
        }
      }
    }
    return projects;
  }

  /**
   * Extract deployment URL from wrangler output
   */
  private extractDeploymentUrl(stdout: string): string | undefined {
    const urlMatch = stdout.match(/https?:\/\/[^\s]+\.pages\.dev[^\s]*/);
    return urlMatch ? urlMatch[0] : undefined;
  }
}

export const pagesService = new PagesService();
