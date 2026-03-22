/**
 * Pages Service Interface
 * Defines the contract for Cloudflare Pages operations
 */

import type {
  PagesProject,
  PagesDeployment,
  PagesDeployOptions,
  PagesFunction,
  PagesDeploymentResult,
} from '../entities';

export interface IPagesService {
  /**
   * Create a new Pages project
   */
  createProject(
    projectName: string,
    options?: {
      productionBranch?: string;
      compatibilityDate?: string;
    }
  ): Promise<{ success: boolean; data?: PagesProject; error?: string }>;

  /**
   * List all Pages projects
   */
  listProjects(): Promise<{ success: boolean; data?: PagesProject[]; error?: string }>;

  /**
   * Get project details
   */
  getProject(projectName: string): Promise<{ success: boolean; data?: PagesProject; error?: string }>;

  /**
   * Deploy to Pages
   */
  deploy(
    options: PagesDeployOptions
  ): Promise<{ success: boolean; data?: PagesDeploymentResult; error?: string }>;

  /**
   * Create a Pages function
   */
  createFunction(
    projectName: string,
    functionName: string,
    options?: {
      compatibilityDate?: string;
      compatibilityFlags?: string[];
    }
  ): Promise<{ success: boolean; data?: PagesFunction; error?: string }>;

  /**
   * List deployments for a project
   */
  listDeployments(
    projectName: string
  ): Promise<{ success: boolean; data?: PagesDeployment[]; error?: string }>;

  /**
   * Get deployment details
   */
  getDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<{ success: boolean; data?: PagesDeployment; error?: string }>;

  /**
   * Delete a deployment
   */
  deleteDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<{ success: boolean; error?: string }>;
}
