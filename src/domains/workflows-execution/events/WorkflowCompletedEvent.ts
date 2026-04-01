/**
 * Workflow Completed Event
 * @description Domain event fired when a workflow completes successfully
 */

import type { WorkflowInstanceId } from '../types';

export class WorkflowCompletedEvent {
  readonly eventType = 'workflow.completed' as const;
  readonly timestamp: number;
  readonly instanceId: WorkflowInstanceId;
  readonly result?: unknown;
  readonly totalSteps: number;
  readonly executionTime: number;
  readonly metadata?: Record<string, unknown>;

  constructor(
    instanceId: WorkflowInstanceId,
    totalSteps: number,
    executionTime: number,
    result?: unknown,
    metadata?: Record<string, unknown>
  ) {
    this.instanceId = instanceId;
    this.totalSteps = totalSteps;
    this.executionTime = executionTime;
    this.result = result;
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
      result: this.result,
      totalSteps: this.totalSteps,
      executionTime: this.executionTime,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from completion data
   */
  static create(
    instanceId: WorkflowInstanceId,
    totalSteps: number,
    executionTime: number,
    result?: unknown,
    metadata?: Record<string, unknown>
  ): WorkflowCompletedEvent {
    return new WorkflowCompletedEvent(
      instanceId,
      totalSteps,
      executionTime,
      result,
      metadata
    );
  }
}
