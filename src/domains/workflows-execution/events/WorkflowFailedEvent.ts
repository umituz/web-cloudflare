/**
 * Workflow Failed Event
 * @description Domain event fired when a workflow fails
 */

import type { WorkflowInstanceId, WorkflowError } from '../types';

export class WorkflowFailedEvent {
  readonly eventType = 'workflow.failed' as const;
  readonly timestamp: number;
  readonly instanceId: WorkflowInstanceId;
  readonly stepName?: string;
  readonly error: WorkflowError;
  readonly metadata?: Record<string, unknown>;

  constructor(
    instanceId: WorkflowInstanceId,
    error: WorkflowError,
    stepName?: string,
    metadata?: Record<string, unknown>
  ) {
    this.instanceId = instanceId;
    this.error = error;
    this.stepName = stepName;
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
      error: this.error,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from error
   */
  static create(
    instanceId: WorkflowInstanceId,
    error: WorkflowError,
    stepName?: string,
    metadata?: Record<string, unknown>
  ): WorkflowFailedEvent {
    return new WorkflowFailedEvent(
      instanceId,
      error,
      stepName,
      metadata
    );
  }

  /**
   * Create from Error object
   */
  static fromError(
    instanceId: WorkflowInstanceId,
    error: Error,
    stepName?: string,
    metadata?: Record<string, unknown>
  ): WorkflowFailedEvent {
    return new WorkflowFailedEvent(
      instanceId,
      {
        code: error.name || 'ERROR',
        message: error.message,
        step: stepName,
        timestamp: Date.now(),
      },
      stepName,
      metadata
    );
  }
}
