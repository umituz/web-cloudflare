/**
 * Workflow Instance Created Event
 * @description Domain event fired when a workflow instance is created
 */

import type { WorkflowInstanceId, WorkflowStatus } from '../types';

export class WorkflowInstanceCreatedEvent {
  readonly eventType = 'workflow.instance.created' as const;
  readonly timestamp: number;
  readonly instanceId: WorkflowInstanceId;
  readonly workflowId: string;
  readonly params: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;

  constructor(
    instanceId: WorkflowInstanceId,
    workflowId: string,
    params: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) {
    this.instanceId = instanceId;
    this.workflowId = workflowId;
    this.params = params;
    this.timestamp = Date.now();
    this.metadata = metadata;
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      eventType: this.eventType,
      timestamp: this.timestamp,
      instanceId: this.instanceId,
      workflowId: this.workflowId,
      params: this.params,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from instance data
   */
  static create(
    instanceId: WorkflowInstanceId,
    workflowId: string,
    params: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): WorkflowInstanceCreatedEvent {
    return new WorkflowInstanceCreatedEvent(
      instanceId,
      workflowId,
      params,
      metadata
    );
  }
}
