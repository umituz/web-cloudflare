
import type {
  PagesProject,
  PagesDeployment,
  PagesDeployOptions,
  PagesFunction,
  PagesDeploymentResult,
} from '../entities';

export interface IPagesService {
  createProject(
    projectName: string,
    options?: {
      productionBranch?: string;
      compatibilityDate?: string;
    }
  ): Promise<{ success: boolean; data?: PagesProject; error?: string }>;

  listProjects(): Promise<{ success: boolean; data?: PagesProject[]; error?: string }>;

  getProject(projectName: string): Promise<{ success: boolean; data?: PagesProject; error?: string }>;

  deploy(
    options: PagesDeployOptions
  ): Promise<{ success: boolean; data?: PagesDeploymentResult; error?: string }>;

  createFunction(
    projectName: string,
    functionName: string,
    options?: {
      compatibilityDate?: string;
      compatibilityFlags?: string[];
    }
  ): Promise<{ success: boolean; data?: PagesFunction; error?: string }>;

  listDeployments(
    projectName: string
  ): Promise<{ success: boolean; data?: PagesDeployment[]; error?: string }>;

  getDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<{ success: boolean; data?: PagesDeployment; error?: string }>;

  deleteDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<{ success: boolean; error?: string }>;
}
