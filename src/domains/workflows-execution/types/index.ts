/**
 * Cloudflare Workflows Types
 * @description Type definitions for Cloudflare Workflows orchestration system
 */

// ============================================================
// Workflow Types
// ============================================================

/**
 * Workflow instance status
 */
export type WorkflowStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting';

/**
 * Workflow instance identifier
 */
export type WorkflowInstanceId = string;

/**
 * Workflow step result
 */
export interface WorkflowStepResult<T = unknown> {
  /** Step output data */
  data: T;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Timestamp when step completed */
  completedAt: number;

  /** Optional step metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow instance
 */
export interface WorkflowInstance {
  /** Unique instance ID */
  id: WorkflowInstanceId;

  /** Workflow definition ID */
  workflowId: string;

  /** Current status */
  status: WorkflowStatus;

  /** Current step name (if running) */
  currentStep?: string;

  /** Completed steps */
  completedSteps: string[];

  /** Input parameters */
  params: Record<string, unknown>;

  /** Step results (by step name) */
  stepResults: Record<string, WorkflowStepResult>;

  /** Error (if failed) */
  error?: WorkflowError;

  /** Started timestamp */
  startedAt: number;

  /** Completed timestamp */
  completedAt?: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow error details
 */
export interface WorkflowError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Step where error occurred */
  step?: string;

  /** Timestamp */
  timestamp: number;
}

/**
 * Workflow step configuration
 */
export interface WorkflowStepConfig {
  /** Step name */
  name: string;

  /** Timeout in seconds */
  timeout?: number;

  /** Retry configuration */
  retries?: {
    /** Maximum retry attempts */
    limit: number;

    /** Delay between retries */
    delay: string;

    /** Backoff strategy */
    backoff?: 'linear' | 'exponential';
  };
}

// ============================================================
// Workflow Execution Types
// ============================================================

/**
 * Workflow execution event
 */
export interface WorkflowEvent {
  /** Event type */
  type: string;

  /** Event data */
  data: Record<string, unknown>;

  /** Event timestamp */
  timestamp: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  /** Workflow instance ID */
  instanceId: WorkflowInstanceId;

  /** Current step */
  currentStep: string;

  /** Previous step results */
  stepResults: Record<string, WorkflowStepResult>;

  /** Workflow params */
  params: Record<string, unknown>;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow step function
 */
export type WorkflowStepFunction<T = unknown> = (
  context: WorkflowExecutionContext
) => Promise<T> | T;

/**
 * Workflow step definition
 */
export interface WorkflowStepDefinition<T = unknown> {
  /** Step name */
  name: string;

  /** Step function */
  handler: WorkflowStepFunction<T>;

  /** Step configuration */
  config?: WorkflowStepConfig;
}

// ============================================================
// Workflow Management Types
// ============================================================

/**
 * Workflow creation options
 */
export interface WorkflowCreationOptions {
  /** Custom instance ID */
  id?: string;

  /** Input parameters */
  params: Record<string, unknown>;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow list options
 */
export interface WorkflowListOptions {
  /** Page number */
  page?: number;

  /** Items per page */
  perPage?: number;

  /** Filter by status */
  status?: WorkflowStatus;

  /** Filter by workflow ID */
  workflowId?: string;
}

/**
 * Workflow list result
 */
export interface WorkflowListResult {
  /** Workflow instances */
  instances: WorkflowInstance[];

  /** Total count */
  total: number;

  /** Page number */
  page: number;

  /** Items per page */
  perPage: number;

  /** Total pages */
  totalPages: number;
}

/**
 * Workflow status change options
 */
export interface WorkflowStatusChangeOptions {
  /** New status */
  status: 'paused' | 'running' | 'cancelled' | 'failed';

  /** Reason for status change */
  reason?: string;
}

// ============================================================
// REST API Types
// ============================================================

/**
 * Workflow definition (for REST API)
 */
export interface WorkflowDefinition {
  /** Workflow ID */
  id: string;

  /** Workflow name */
  name: string;

  /** Workflow description */
  description?: string;

  /** Workflow steps */
  steps: Array<{
    /** Step name */
    name: string;

    /** Action type */
    action: string;

    /** Action parameters */
    params?: Record<string, unknown>;

    /** Retry configuration */
    retries?: {
      limit: number;
      delay: string;
      backoff?: string;
    };

    /** Timeout */
    timeout?: string;
  }>;

  /** Created timestamp */
  createdAt: number;

  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Workflow instance creation request
 */
export interface CreateInstanceRequest {
  /** Workflow ID */
  workflowId: string;

  /** Input parameters */
  params: Record<string, unknown>;

  /** Custom instance ID */
  id?: string;
}

/**
 * Send event request
 */
export interface SendEventRequest {
  /** Event type */
  eventType: string;

  /** Event data */
  eventData: Record<string, unknown>;
}
