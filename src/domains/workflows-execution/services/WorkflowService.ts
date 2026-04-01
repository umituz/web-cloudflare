/**
 * Workflow Service
 * @description Service for managing workflow instances and execution
 */

import type {
  WorkflowInstance,
  WorkflowInstanceId,
  WorkflowStatus,
  WorkflowCreationOptions,
  WorkflowListOptions,
  WorkflowListResult,
  WorkflowStatusChangeOptions,
  SendEventRequest,
} from '../types';
import { WorkflowStepHelper } from './WorkflowStepHelper';
import { WorkflowInstanceCreatedEvent } from '../events/WorkflowInstanceCreatedEvent';
import { WorkflowStepCompletedEvent } from '../events/WorkflowStepCompletedEvent';
import { WorkflowFailedEvent } from '../events/WorkflowFailedEvent';
import { WorkflowCompletedEvent } from '../events/WorkflowCompletedEvent';

export class WorkflowService {
  private instances: Map<WorkflowInstanceId, WorkflowInstance>;
  private stepHelper: WorkflowStepHelper;
  private eventHandlers?: Map<string, (event: any) => Promise<void> | void>;

  constructor() {
    this.instances = new Map();
    this.stepHelper = new WorkflowStepHelper();
  }

  /**
   * Create a new workflow instance
   * @param workflowId Workflow definition ID
   * @param options Creation options
   * @returns Workflow instance
   */
  async createInstance(
    workflowId: string,
    options: WorkflowCreationOptions
  ): Promise<WorkflowInstance> {
    const instanceId = options.id || this.generateId();

    const instance: WorkflowInstance = {
      id: instanceId,
      workflowId,
      status: 'running',
      currentStep: undefined,
      completedSteps: [],
      params: options.params,
      stepResults: {},
      startedAt: Date.now(),
      metadata: options.metadata,
    };

    this.instances.set(instanceId, instance);

    // Emit event
    await this.emitEvent(
      new WorkflowInstanceCreatedEvent(
        instanceId,
        workflowId,
        options.params,
        options.metadata
      )
    );

    return instance;
  }

  /**
   * Get workflow instance status
   * @param instanceId Instance ID
   * @returns Workflow instance or null
   */
  async getInstanceStatus(
    instanceId: WorkflowInstanceId
  ): Promise<WorkflowInstance | null> {
    return this.instances.get(instanceId) || null;
  }

  /**
   * List workflow instances
   * @param options List options
   * @returns Workflow list result
   */
  async listInstances(
    options?: WorkflowListOptions
  ): Promise<WorkflowListResult> {
    let instances = Array.from(this.instances.values());

    // Apply filters
    if (options?.status) {
      instances = instances.filter((i) => i.status === options.status);
    }

    if (options?.workflowId) {
      instances = instances.filter((i) => i.workflowId === options.workflowId);
    }

    // Sort by started time (newest first)
    instances.sort((a, b) => b.startedAt - a.startedAt);

    // Apply pagination
    const page = options?.page || 1;
    const perPage = options?.perPage || 20;
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;

    const paginatedInstances = instances.slice(startIndex, endIndex);

    return {
      instances: paginatedInstances,
      total: instances.length,
      page,
      perPage,
      totalPages: Math.ceil(instances.length / perPage),
    };
  }

  /**
   * Change workflow instance status
   * @param instanceId Instance ID
   * @param options Status change options
   * @returns Updated instance
   */
  async changeStatus(
    instanceId: WorkflowInstanceId,
    options: WorkflowStatusChangeOptions
  ): Promise<WorkflowInstance> {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      throw new Error(`Workflow instance "${instanceId}" not found`);
    }

    // Update status
    instance.status = options.status;

    // If completing/failed, set completed timestamp
    if (options.status === 'completed' || options.status === 'failed') {
      instance.completedAt = Date.now();
    }

    this.instances.set(instanceId, instance);

    return instance;
  }

  /**
   * Send event to workflow instance
   * @param instanceId Instance ID
   * @param event Event data
   * @returns Success status
   */
  async sendEvent(
    instanceId: WorkflowInstanceId,
    event: SendEventRequest
  ): Promise<boolean> {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      throw new Error(`Workflow instance "${instanceId}" not found`);
    }

    if (instance.status !== 'running' && instance.status !== 'waiting') {
      throw new Error(
        `Cannot send event to workflow in status "${instance.status}"`
      );
    }

    // Event is stored in metadata for processing by workflow
    if (!instance.metadata) {
      instance.metadata = {};
    }

    const events = (instance.metadata.events || []) as Array<{
      eventType: string;
      eventData: unknown;
      timestamp: number;
    }>;

    events.push({
      eventType: event.eventType,
      eventData: event.eventData,
      timestamp: Date.now(),
    });

    instance.metadata.events = events;

    return true;
  }

  /**
   * Delete workflow instance
   * @param instanceId Instance ID
   * @returns Success status
   */
  async deleteInstance(instanceId: WorkflowInstanceId): Promise<boolean> {
    return this.instances.delete(instanceId);
  }

  /**
   * Execute workflow step (internal method)
   * @param instanceId Instance ID
   * @param stepName Step name
   * @param handler Step handler function
   * @param config Step configuration
   * @returns Step result
   */
  async executeStep<T = unknown>(
    instanceId: WorkflowInstanceId,
    stepName: string,
    handler: (context: import('../types').WorkflowExecutionContext) => Promise<T> | T,
    config?: import('../types').WorkflowStepConfig
  ): Promise<WorkflowInstance> {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      throw new Error(`Workflow instance "${instanceId}" not found`);
    }

    if (instance.status !== 'running') {
      throw new Error(`Workflow is not running (status: ${instance.status})`);
    }

    instance.currentStep = stepName;

    // Create execution context
    const context = {
      instanceId: instance.id,
      currentStep: stepName,
      stepResults: instance.stepResults,
      params: instance.params,
      metadata: instance.metadata,
    };

    try {
      // Execute step
      const result = await this.stepHelper.executeStep(
        stepName,
        handler,
        context,
        config
      );

      // Store step result
      instance.stepResults[stepName] = result;
      instance.completedSteps.push(stepName);
      instance.currentStep = undefined;

      // Emit event
      await this.emitEvent(
        new WorkflowStepCompletedEvent(instanceId, stepName, result)
      );

      return instance;
    } catch (error) {
      // Mark as failed
      instance.status = 'failed';
      instance.error = {
        code: 'STEP_FAILED',
        message: error instanceof Error ? error.message : String(error),
        step: stepName,
        timestamp: Date.now(),
      };
      instance.completedAt = Date.now();

      // Emit event
      await this.emitEvent(
        WorkflowFailedEvent.fromError(instanceId, error as Error, stepName)
      );

      throw error;
    }
  }

  /**
   * Complete workflow execution
   * @param instanceId Instance ID
   * @param result Optional final result
   * @returns Completed instance
   */
  async completeWorkflow(
    instanceId: WorkflowInstanceId,
    result?: unknown
  ): Promise<WorkflowInstance> {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      throw new Error(`Workflow instance "${instanceId}" not found`);
    }

    const executionTime = Date.now() - instance.startedAt;

    instance.status = 'completed';
    instance.completedAt = Date.now();
    instance.currentStep = undefined;

    // Emit event
    await this.emitEvent(
      new WorkflowCompletedEvent(
        instanceId,
        instance.completedSteps.length,
        executionTime,
        result
      )
    );

    return instance;
  }

  /**
   * Configure event handler
   * @param handler Event handler function
   */
  onEvent(
    handler: (event: any) => Promise<void> | void
  ): void {
    if (!this.eventHandlers) {
      this.eventHandlers = new Map();
    }
    this.eventHandlers.set('all', handler);
  }

  /**
   * Get step helper
   */
  getStepHelper(): WorkflowStepHelper {
    return this.stepHelper;
  }

  /**
   * Generate unique instance ID
   * @private
   */
  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Emit event to registered handlers
   * @private
   */
  private async emitEvent(event: any): Promise<void> {
    if (this.eventHandlers?.has('all')) {
      const handler = this.eventHandlers.get('all')!;
      await handler(event);
    }
  }

  /**
   * Get all instances (for debugging)
   */
  getAllInstances(): WorkflowInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Clear all instances (for testing)
   */
  clearAllInstances(): void {
    this.instances.clear();
  }
}
