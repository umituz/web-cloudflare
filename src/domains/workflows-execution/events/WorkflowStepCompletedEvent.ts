/**
 * Workflow Step Completed Event
 * @description Domain event fired when a workflow step completes
 */

import type { WorkflowInstanceId } from '../types';
import type { WorkflowStepResult } from '../types';

export class WorkflowStepCompletedEvent {
  readonly eventType = 'workflow.step.completed' as const;
  readonly timestamp: number;
  readonly instanceId: WorkflowInstanceId;
  readonly stepName: string;
  readonly result: WorkflowStepResult;
  readonly metadata?: Record<string, unknown>;

  constructor(
    instanceId: WorkflowInstanceId,
    stepName: string,
    result: WorkflowStepResult,
    metadata?: Record<string, unknown>
  ) {
    this.instanceId = instanceId;
    this.stepName = stepName;
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
      stepName: this.stepName,
      result: this.result,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from step result
   */
  static create(
    instanceId: WorkflowInstanceId,
    stepName: string,
    result: WorkflowStepResult,
    metadata?: Record<string, unknown>
  ): WorkflowStepCompletedEvent {
    return new WorkflowStepCompletedEvent(
      instanceId,
      stepName,
      result,
      metadata
    );
  }
}
