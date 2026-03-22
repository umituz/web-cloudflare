/**
 * Cloudflare Workflows Service
 * @description Service for orchestrating long-running, retryable operations
 */

import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  WorkflowInstanceState,
  MediaProcessingWorkflow,
  AIGenerationWorkflow,
  BatchOperationWorkflow,
} from '../entities';

export interface WorkflowServiceConfig {
  KV?: KVNamespace;
  D1?: D1Database;
  maxExecutionTime?: number; // seconds
  defaultRetries?: number;
}

export class WorkflowService {
  private kv?: KVNamespace;
  private d1?: D1Database;
  private maxExecutionTime: number;
  private defaultRetries: number;

  constructor(config: WorkflowServiceConfig = {}) {
    this.kv = config.KV;
    this.d1 = config.D1;
    this.maxExecutionTime = config.maxExecutionTime || 300; // 5 minutes default
    this.defaultRetries = config.defaultRetries || 3;
  }

  /**
   * Create a new workflow definition
   */
  async createWorkflow(definition: WorkflowDefinition): Promise<void> {
    const key = `workflow:${definition.id}`;
    if (this.kv) {
      await this.kv.put(key, JSON.stringify(definition));
    }
  }

  /**
   * Get workflow definition
   */
  async getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
    if (this.kv) {
      const data = await this.kv.get(`workflow:${workflowId}`);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * Start a workflow execution
   */
  async startExecution(
    workflowId: string,
    inputs: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const execution: WorkflowExecution = {
      id: this.generateId(),
      workflowId,
      status: 'pending',
      completedSteps: [],
      failedSteps: [],
      inputs,
      startedAt: Date.now(),
      retryCount: 0,
    };

    await this.saveExecution(execution);
    await this.executeWorkflow(execution, workflow);

    return execution;
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition
  ): Promise<void> {
    execution.status = 'running';
    await this.saveExecution(execution);

    const results: Record<string, unknown> = {};
    const stepStatus: Record<string, 'completed' | 'failed'> = {};

    // Execute steps in order, respecting dependencies
    for (const step of workflow.steps) {
      // Check if dependencies are met
      if (step.dependencies) {
        const depsMet = step.dependencies.every(
          (dep) => stepStatus[dep] === 'completed'
        );
        if (!depsMet) {
          continue; // Skip for now, will retry later
        }
      }

      try {
        // Get step state for retries
        const state = await this.getStepState(execution.id, step.id);
        const stepInputs = state?.data || { ...results, ...step.inputs };

        // Execute step
        const stepResult = await this.executeStep(step, stepInputs);

        // Store result
        results[step.id] = stepResult;
        stepStatus[step.id] = 'completed';
        execution.completedSteps.push(step.id);

        // Save step state for idempotency
        await this.saveStepState(execution.id, step.id, stepResult);

      } catch (error) {
        stepStatus[step.id] = 'failed';
        execution.failedSteps.push(step.id);
        execution.error = error instanceof Error ? error.message : String(error);

        // Check retry policy
        const retryPolicy = step.retryPolicy || workflow.retryConfig;
        if (retryPolicy && execution.retryCount < this.defaultRetries) {
          execution.retryCount++;
          execution.status = 'retrying';
          await this.saveExecution(execution);

          // Exponential backoff
          const delay = Math.min(
            retryPolicy.initialDelay * Math.pow(retryPolicy.backoffMultiplier, execution.retryCount),
            retryPolicy.maxDelay
          );
          await this.sleep(delay);

          // Retry this step
          continue;
        }

        // Max retries exceeded, mark as failed
        execution.status = 'failed';
        execution.completedAt = Date.now();
        await this.saveExecution(execution);
        throw error;
      }
    }

    // All steps completed
    execution.status = 'completed';
    execution.outputs = results;
    execution.completedAt = Date.now();
    await this.saveExecution(execution);
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    // This would call the actual handler function
    // For now, simulate execution
    const handler = this.getHandler(step.handler);
    if (!handler) {
      throw new Error(`Handler ${step.handler} not found`);
    }

    return handler(inputs);
  }

  /**
   * Resume a workflow from a specific step
   */
  async resumeExecution(
    executionId: string,
    fromStep?: string
  ): Promise<WorkflowExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const workflow = await this.getWorkflow(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${execution.workflowId} not found`);
    }

    // If fromStep is specified, reset to that step
    if (fromStep) {
      const stepIndex = workflow.steps.findIndex((s) => s.id === fromStep);
      if (stepIndex === -1) {
        throw new Error(`Step ${fromStep} not found`);
      }

      // Reset completed steps after the resume point
      execution.completedSteps = workflow.steps
        .slice(0, stepIndex)
        .map((s) => s.id);
      execution.failedSteps = [];
      execution.status = 'pending';
    }

    await this.executeWorkflow(execution, workflow);
    return execution;
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    if (this.kv) {
      const data = await this.kv.get(`execution:${executionId}`);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * List executions for a workflow
   */
  async listExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    // This would typically use D1 for proper querying
    // For now, return empty array
    return [];
  }

  /**
   * Save execution state
   */
  private async saveExecution(execution: WorkflowExecution): Promise<void> {
    if (this.kv) {
      await this.kv.put(
        `execution:${execution.id}`,
        JSON.stringify(execution),
        { expirationTtl: 86400 } // 24 hours
      );
    }
  }

  /**
   * Save step state for idempotency
   */
  private async saveStepState(
    executionId: string,
    stepId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (this.kv) {
      const state: WorkflowInstanceState = {
        executionId,
        stepId,
        data,
        timestamp: Date.now(),
      };
      await this.kv.put(
        `step:${executionId}:${stepId}`,
        JSON.stringify(state)
      );
    }
  }

  /**
   * Get step state
   */
  private async getStepState(
    executionId: string,
    stepId: string
  ): Promise<WorkflowInstanceState | null> {
    if (this.kv) {
      const data = await this.kv.get(`step:${executionId}:${stepId}`);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * Get handler function (mock implementation)
   */
  private getHandler(name: string): ((inputs: Record<string, unknown>) => Promise<unknown>) | null {
    const handlers: Record<string, (inputs: Record<string, unknown>) => Promise<unknown>> = {
      'media-process': async (inputs) => ({ processed: true, urls: [] }),
      'ai-generate': async (inputs) => ({ result: 'generated text', tokens: 100 }),
      'batch-operation': async (inputs) => ({ successful: 10, failed: 0 }),
    };
    return handlers[name] || null;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Predefined workflow templates
export const WORKFLOW_TEMPLATES: Record<string, Partial<WorkflowDefinition>> = {
  'media-processing': {
    name: 'Media Processing Workflow',
    description: 'Process media files with various operations',
    version: '1.0.0',
    steps: [
      {
        id: 'download',
        name: 'Download Media',
        handler: 'media-download',
      },
      {
        id: 'transcode',
        name: 'Transcode Media',
        handler: 'media-transcode',
        dependencies: ['download'],
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 10000,
        },
      },
      {
        id: 'optimize',
        name: 'Optimize Media',
        handler: 'media-optimize',
        dependencies: ['transcode'],
      },
      {
        id: 'upload',
        name: 'Upload to R2',
        handler: 'r2-upload',
        dependencies: ['optimize'],
      },
    ],
  },

  'ai-generation': {
    name: 'AI Content Generation',
    description: 'Generate content using AI with emotion control',
    version: '1.0.0',
    steps: [
      {
        id: 'generate-script',
        name: 'Generate Script with Workers AI',
        handler: 'workers-ai-generate',
        timeout: 30,
      },
      {
        id: 'validate-content',
        name: 'Validate Generated Content',
        handler: 'content-validate',
        dependencies: ['generate-script'],
      },
      {
        id: 'save-to-database',
        name: 'Save to Database',
        handler: 'd1-insert',
        dependencies: ['validate-content'],
      },
    ],
  },

  'batch-operations': {
    name: 'Batch Operations',
    description: 'Execute operations in batches with parallelism',
    version: '1.0.0',
    steps: [
      {
        id: 'fetch-items',
        name: 'Fetch Items to Process',
        handler: 'batch-fetch',
      },
      {
        id: 'process-batches',
        name: 'Process in Batches',
        handler: 'batch-process',
        dependencies: ['fetch-items'],
      },
      {
        id: 'aggregate-results',
        name: 'Aggregate Results',
        handler: 'batch-aggregate',
        dependencies: ['process-batches'],
      },
    ],
  },

  // Voice cloning inspired workflow
  'voice-content-creation': {
    name: 'Voice Content Creation',
    description: 'Create AI-generated audio content with cloned voice',
    version: '1.0.0',
    steps: [
      {
        id: 'clone-voice',
        name: 'Clone Voice from Sample',
        handler: 'fishaudio-clone',
        timeout: 60,
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelay: 2000,
          maxDelay: 15000,
        },
      },
      {
        id: 'generate-script',
        name: 'Generate Script with Emotion',
        handler: 'workers-ai-script',
        timeout: 30,
      },
      {
        id: 'generate-tts',
        name: 'Generate TTS with Cloned Voice',
        handler: 'fishaudio-tts',
        dependencies: ['clone-voice', 'generate-script'],
        timeout: 60,
      },
      {
        id: 'combine-audio',
        name: 'Combine Audio Tracks',
        handler: 'audio-combine',
        dependencies: ['generate-tts'],
      },
    ],
  },
};
