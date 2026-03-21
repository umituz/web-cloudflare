/**
 * Cloudflare Workflows Domain Entity
 * @description Workflow types for long-running, retryable operations
 */

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  retryConfig?: RetryConfig;
  timeout?: number; // seconds
}

export interface WorkflowStep {
  id: string;
  name: string;
  handler: string; // Function name to execute
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  retryPolicy?: StepRetryPolicy;
  timeout?: number; // seconds
  dependencies?: string[]; // Step IDs that must complete first
}

export interface StepRetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
}

export interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  startedAt: number;
  completedAt?: number;
  retryCount: number;
}

export interface WorkflowInstanceState {
  executionId: string;
  stepId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Predefined workflow templates
export interface WorkflowTemplate {
  type: 'media-processing' | 'batch-operations' | 'ai-generation' | 'scheduled-tasks';
  definition: Partial<WorkflowDefinition>;
}

export interface MediaProcessingWorkflow {
  inputs: {
    mediaUrl: string;
    operations: Array<{
      type: 'transcode' | 'optimize' | 'thumbnail' | 'analyze';
      params?: Record<string, unknown>;
    }>;
  };
  outputs: {
    processedUrls: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface AIGenerationWorkflow {
  inputs: {
    prompt: string;
    model: string;
    parameters?: Record<string, unknown>;
  };
  outputs: {
    result: string;
    tokens: number;
    model: string;
  };
}

export interface BatchOperationWorkflow {
  inputs: {
    operation: string;
    items: unknown[];
    batchSize?: number;
    parallelism?: number;
  };
  outputs: {
    successful: number;
    failed: number;
    results: unknown[];
  };
}
