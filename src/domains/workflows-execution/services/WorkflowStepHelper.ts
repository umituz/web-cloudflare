/**
 * Workflow Step Helper
 * @description Helper service for executing workflow steps with timeout and retry logic
 */

import type {
  WorkflowExecutionContext,
  WorkflowStepConfig,
  WorkflowStepResult,
} from '../types';

export class WorkflowStepHelper {
  /**
   * Execute a workflow step with timeout and retry
   * @param stepName Step name
   * @param handler Step function
   * @param context Workflow context
   * @param config Step configuration
   * @returns Step result
   */
  async executeStep<T = unknown>(
    stepName: string,
    handler: (context: WorkflowExecutionContext) => Promise<T> | T,
    context: WorkflowExecutionContext,
    config?: WorkflowStepConfig
  ): Promise<WorkflowStepResult<T>> {
    const startTime = Date.now();
    const timeoutMs = (config?.timeout || 30) * 1000;
    const maxRetries = config?.retries?.limit || 1;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Execute step with timeout
        const data = await this.withTimeout(
          handler(context),
          timeoutMs
        );

        const executionTime = Date.now() - startTime;

        return {
          data,
          executionTime,
          completedAt: Date.now(),
          metadata: {
            stepName,
            attempt: attempt + 1,
            retried: attempt > 0,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If not the last attempt, wait before retry
        if (attempt < maxRetries - 1 && config?.retries) {
          const delay = this.parseDelay(config.retries.delay);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    throw lastError || new Error(`Step "${stepName}" failed`);
  }

  /**
   * Sleep for specified duration
   * @param ms Duration in milliseconds
   */
  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute with timeout
   * @param promise Promise to execute
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise result
   */
  private async withTimeout<T>(
    promise: Promise<T> | T,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Step timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Parse delay string to milliseconds
   * @param delay Delay string (e.g., "5 seconds", "1 minute")
   * @returns Delay in milliseconds
   */
  private parseDelay(delay: string): number {
    const match = delay.match(/^(\d+)\s*(second|minute|hour)s?$/i);
    if (!match) {
      throw new Error(`Invalid delay format: "${delay}"`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'second':
        return value * 1000;
      case 'minute':
        return value * 60 * 1000;
      case 'hour':
        return value * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown delay unit: "${unit}"`);
    }
  }

  /**
   * Combine step results
   * @param stepResults Array of step results
   * @returns Combined result
   */
  combineResults<T = unknown>(
    stepResults: WorkflowStepResult<T>[]
  ): Record<string, WorkflowStepResult<T>> {
    const combined: Record<string, WorkflowStepResult<T>> = {};

    for (const result of stepResults) {
      const stepName = result.metadata?.stepName as string;
      if (stepName) {
        combined[stepName] = result;
      }
    }

    return combined;
  }

  /**
   * Calculate total execution time
   * @param stepResults Array of step results
   * @returns Total execution time in milliseconds
   */
  calculateTotalExecutionTime(stepResults: WorkflowStepResult[]): number {
    return stepResults.reduce((total, result) => total + result.executionTime, 0);
  }
}
