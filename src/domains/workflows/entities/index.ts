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
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

/**
 * Workflow execution state
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep?: string;
  startedAt: number;
  completedAt?: number;
  input: unknown;
  output?: unknown;
  error?: string;
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
