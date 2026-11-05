
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

export interface PagesDeployOptions {
  projectName: string;
  directory?: string;
  branch?: string;
  preview?: boolean;
  environment?: 'preview' | 'production';
  compatibilityDate?: string;
  compatibilityFlags?: string[];
  vars?: Record<string, string>;
  functions?: boolean;
}

export interface PagesFunction {
  name: string;
  scriptPath?: string;
  compatibilityDate?: string;
  compatibilityFlags?: string[];
}

export interface PagesDeploymentResult {
  deployment: PagesDeployment;
  url?: string;
  alias?: string;
}
