/**
 * useWorkflow Hook
 * @description Workflow execution and monitoring hook
 */

import { useState, useCallback, useRef } from 'react';
import { APIClient } from '../utils/api-client';

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStep[];
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface WorkflowState {
  execution: WorkflowExecution | null;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
}

export interface UseWorkflowOptions {
  baseURL?: string;
  pollInterval?: number;
  onStepComplete?: (step: WorkflowStep) => void;
  onWorkflowComplete?: (execution: WorkflowExecution) => void;
  onWorkflowError?: (execution: WorkflowExecution) => void;
}

export interface UseWorkflowReturn {
  workflowState: WorkflowState;
  executeWorkflow: (workflowId: string, input?: unknown) => Promise<WorkflowExecution>;
  pollExecution: (executionId: string) => Promise<void>;
  cancelExecution: (executionId: string) => Promise<void>;
  resetState: () => void;
}

/**
 * Workflow hook for React apps
 */
export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowReturn {
  const {
    baseURL = '',
    pollInterval = 1000,
    onStepComplete,
    onWorkflowComplete,
    onWorkflowError,
  } = options;

  const client = useRef<APIClient>(new APIClient({ baseURL }));
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    execution: null,
    isLoading: false,
    isPolling: false,
    error: null,
  });

  /**
   * Stop polling
   */
  const stopPolling = useCallback((): void => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setWorkflowState((prev) => ({ ...prev, isPolling: false }));
  }, []);

  /**
   * Start polling execution
   */
  const startPolling = useCallback((executionId: string): void => {
    setWorkflowState((prev) => ({ ...prev, isPolling: true }));

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await client.current.get<{ execution: WorkflowExecution }>(
          `/api/workflows/executions/${executionId}`
        );

        const execution = response.data.execution;

        setWorkflowState((prev) => ({
          ...prev,
          execution,
        }));

        // Check step completions
        execution.steps.forEach((step) => {
          if (step.status === 'completed') {
            onStepComplete?.(step);
          }
        });

        // Stop polling if workflow is complete
        if (execution.status === 'completed' || execution.status === 'failed') {
          stopPolling();

          if (execution.status === 'completed') {
            onWorkflowComplete?.(execution);
          } else if (execution.status === 'failed') {
            onWorkflowError?.(execution);
          }
        }
      } catch (error) {
        stopPolling();
        setWorkflowState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Polling failed',
        }));
      }
    }, pollInterval);
  }, [pollInterval, onStepComplete, onWorkflowComplete, onWorkflowError, stopPolling]);

  /**
   * Execute workflow
   */
  const executeWorkflow = useCallback(async (
    workflowId: string,
    input?: unknown
  ): Promise<WorkflowExecution> => {
    setWorkflowState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await client.current.post<{ execution: WorkflowExecution }>(
        '/api/workflows/execute',
        {
          workflowId,
          input,
        }
      );

      const execution = response.data.execution;

      setWorkflowState((prev) => ({
        ...prev,
        execution,
        isLoading: false,
      }));

      // Start polling for updates
      startPolling(execution.id);

      return execution;
    } catch (error) {
      setWorkflowState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      }));
      throw error;
    }
  }, [startPolling]);

  /**
   * Poll execution manually
   */
  const pollExecution = useCallback(async () => {
    try {
      const response = await client.current.get<{ execution: WorkflowExecution }>(
        `/api/workflows/executions/${executionId}`
      );

      const execution = response.data.execution;

      setWorkflowState((prev) => ({
        ...prev,
        execution,
      }));
    } catch (error) {
      setWorkflowState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Poll failed',
      }));
    }
  }, []);

  /**
   * Cancel execution
   */
  const cancelExecution = useCallback(async () => {
    try {
      await client.current.post(`/api/workflows/executions/${executionId}/cancel`, {});

      stopPolling();

      setWorkflowState((prev) => ({
        ...prev,
        execution: prev.execution
          ? { ...prev.execution, status: 'cancelled' }
          : null,
      }));
    } catch (error) {
      setWorkflowState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Cancel failed',
      }));
      throw error;
    }
  }, [stopPolling]);

  /**
   * Reset state
   */
  const resetState = useCallback((): void => {
    stopPolling();
    setWorkflowState({
      execution: null,
      isLoading: false,
      isPolling: false,
      error: null,
    });
  }, [stopPolling]);

  // Cleanup on unmount
  useState(() => {
    return () => {
      stopPolling();
    };
  });

  return {
    workflowState,
    executeWorkflow,
    pollExecution,
    cancelExecution,
    resetState,
  };
}

/**
 * Batch operation hook
 */
export function useBatchWorkflow<TInput = unknown, TResult = unknown>(
  options: UseWorkflowOptions & {
    batchSize?: number;
    concurrency?: number;
  }
) {
  const {
    batchSize = 10,
    concurrency = 3,
    ...workflowOptions
  } = options;

  const [items, setItems] = useState<Array<{
    id: string;
    input: TInput;
    result?: TResult;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
  }>>([]);

  const { executeWorkflow } = useWorkflow(workflowOptions);
  const processingRef = useRef(false);

  /**
   * Add items to batch
   */
  const addItems = useCallback((newItems: Array<{ id: string; input: TInput }>): void => {
    setItems((prev) => [
      ...prev,
      ...newItems.map((item) => ({
        ...item,
        status: 'pending' as const,
      })),
    ]);
  }, []);

  /**
   * Process batch
   */
  const processBatch = useCallback(async () => {
    if (processingRef.current) return;

    processingRef.current = true;

    const pendingItems = items.filter((item) => item.status === 'pending');
    const batches: typeof pendingItems[] = [];

    for (let i = 0; i < pendingItems.length; i += batchSize) {
      batches.push(pendingItems.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const concurrencyLimit = Math.min(concurrency, batch.length);

      await Promise.all(
        batch.slice(0, concurrencyLimit).map(async (item) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'processing' } : i
            )
          );

          try {
            const execution = await executeWorkflow(workflowId, item.input);

            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: 'completed',
                      result: execution.result as TResult,
                    }
                  : i
              )
            );
          } catch (error) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: 'failed',
                      error: error instanceof Error ? error.message : 'Processing failed',
                    }
                  : i
              )
            );
          }
        })
      );
    }

    processingRef.current = false;
  }, [items, batchSize, concurrency, executeWorkflow]);

  /**
   * Clear completed items
   */
  const clearCompleted = useCallback((): void => {
    setItems((prev) => prev.filter((item) => item.status !== 'completed'));
  }, []);

  /**
   * Reset all items
   */
  const resetItems = useCallback((): void => {
    setItems([]);
  }, []);

  return {
    items,
    addItems,
    processBatch,
    clearCompleted,
    resetItems,
    isProcessing: processingRef.current,
  };
}
