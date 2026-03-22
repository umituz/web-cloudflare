/**
 * Workflows Domain Entities
 * @description Workflow orchestration entities for Cloudflare Workers
 */

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name: string;
  handler: string;
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
  };
  dependencies?: string[];
  inputs?: Record<string, unknown>;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version?: string;
  steps: WorkflowStep[];
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
  };
}

/**
 * Workflow execution state
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  currentStep?: string;
  startedAt: number;
  completedAt?: number;
  input: unknown;
  output?: unknown;
  outputs?: Record<string, unknown>;
  error?: string;
  completedSteps: string[];
  failedSteps: string[];
  inputs: Record<string, unknown>;
  retryCount: number;
}

/**
 * Workflow config
 */
export interface CloudflareWorkflowConfig {
  enabled: boolean;
  maxExecutionTime: number;
  defaultRetries: number;
  workflows?: Record<string, WorkflowDefinition>;
  storage?: 'kv' | 'd1';
}

// Type alias for compatibility
export type WorkflowConfig = CloudflareWorkflowConfig;
