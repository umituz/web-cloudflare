/**
 * Pages Domain Entities
 * Defines entities for Cloudflare Pages operations
 */

/**
 * Pages project info
 */
export interface PagesProject {
  name: string;
  production_branch?: string;
  created_on?: string;
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
export interface PagesDeployment {
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
  stages?: {
    environment: string;
    function?: string;
    url?: string;
  }[];
}

/**
 * Pages deploy options
 */
export interface PagesDeployOptions {
  projectName: string;
  directory?: string; // Build output directory (default: dist)
  branch?: string;
  preview?: boolean;
  environment?: 'preview' | 'production';
  compatibilityDate?: string;
  compatibilityFlags?: string[];
  vars?: Record<string, string>;
  functions?: boolean; // Deploy with functions
}

/**
 * Pages function info
 */
export interface PagesFunction {
  name: string;
  scriptPath?: string;
  compatibilityDate?: string;
  compatibilityFlags?: string[];
}

/**
 * Pages deployment result
 */
export interface PagesDeploymentResult {
  deployment: PagesDeployment;
  url?: string;
  alias?: string;
}
