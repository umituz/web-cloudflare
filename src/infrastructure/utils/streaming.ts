/**
 * Streaming and Server-Sent Events (SSE) Utilities
 * @description Helper functions for streaming responses and real-time progress updates
 */

export interface SSEMessage {
  data: unknown;
  event?: string;
  id?: string;
  retry?: number;
}

export interface ProgressCallback {
  (progress: number, status: string, data?: Record<string, unknown>): void;
}

// ============================================================
// Server-Sent Events (SSE) Helpers
// ============================================================

/**
 * Create SSE message string
 */
export function createSSEMessage(message: SSEMessage): string {
  let output = '';

  if (message.id) {
    output += `id: ${message.id}\n`;
  }

  if (message.event) {
    output += `event: ${message.event}\n`;
  }

  if (message.retry) {
    output += `retry: ${message.retry}\n`;
  }

  const data = typeof message.data === 'string'
    ? message.data
    : JSON.stringify(message.data);

  output += `data: ${data}\n`;
  output += '\n';

  return output;
}

/**
 * Create SSE stream from async generator
 */
export async function* createSSEStream(
  generator: AsyncIterable<SSEMessage>
): AsyncIterable<string> {
  for await (const message of generator) {
    yield createSSEMessage(message);
  }
}

/**
 * Create ReadableStream for SSE response
 */
export function createSSEReadableStream(
  generator: () => AsyncIterable<SSEMessage>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of generator()) {
          // `chunk` is an SSEMessage object; serialize it via the SSE
          // formatter before encoding to UTF-8 bytes.
          controller.enqueue(encoder.encode(createSSEMessage(chunk)));
        }
      } catch (error) {
        const errorMsg = createSSEMessage({
          event: 'error',
          data: { error: error instanceof Error ? error.message : String(error) }
        });
        controller.enqueue(encoder.encode(errorMsg));
      } finally {
        controller.close();
      }
    }
  });
}

/**
 * Create SSE response
 */
export function createSSEResponse(
  generator: () => AsyncIterable<SSEMessage>,
  init?: ResponseInit
): Response {
  const stream = createSSEReadableStream(generator);

  return new Response(stream, {
    ...init,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...init?.headers,
    },
  });
}

// ============================================================
// Progress Tracking
// ============================================================

/**
 * Create progress tracker with callbacks
 */
export class ProgressTracker {
  private callbacks: ProgressCallback[] = [];
  private currentProgress: number = 0;
  private currentStatus: string = '';
  private metadata: Record<string, unknown> = {};

  /**
   * Optional error sink invoked when a subscriber throws.
   * Defaults to console.error; consumers can override for telemetry.
   */
  onCallbackError?: (error: unknown) => void = (error) => {
    console.error('[ProgressTracker] subscriber threw:', error);
  };

  /**
   * Add progress callback
   */
  onProgress(callback: ProgressCallback): this {
    this.callbacks.push(callback);
    return this;
  }

  /**
   * Update progress
   */
  update(progress: number, status: string, data?: Record<string, unknown>): void {
    this.currentProgress = Math.max(0, Math.min(100, progress));
    this.currentStatus = status;

    if (data) {
      this.metadata = { ...this.metadata, ...data };
    }

    for (const callback of this.callbacks) {
      try {
        callback(this.currentProgress, this.currentStatus, this.metadata);
      } catch (error) {
        // Surface callback errors to the consumer without breaking the tracker.
        // Throwing here would abort the entire progress stream for a single
        // bad consumer; reporting preserves isolation.
        this.onCallbackError?.(error);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): {
    progress: number;
    status: string;
    metadata: Record<string, unknown>;
  } {
    return {
      progress: this.currentProgress,
      status: this.currentStatus,
      metadata: this.metadata,
    };
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.currentProgress = 0;
    this.currentStatus = '';
    this.metadata = {};
  }

  /**
   * Create SSE generator from this tracker
   */
  async *toSSE(interval: number = 1000): AsyncIterable<SSEMessage> {
    const startTime = Date.now();
    let lastProgress = -1;

    while (this.currentProgress < 100) {
      if (this.currentProgress !== lastProgress) {
        yield {
          event: 'progress',
          data: {
            progress: this.currentProgress,
            status: this.currentStatus,
            metadata: this.metadata,
            elapsed: Date.now() - startTime,
          }
        };
        lastProgress = this.currentProgress;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    // Final completion message
    yield {
      event: 'complete',
      data: {
        progress: 100,
        status: 'completed',
        metadata: this.metadata,
        elapsed: Date.now() - startTime,
      }
    };
  }
}

// ============================================================
// Streaming Helpers for Long-Running Tasks
// ============================================================

/**
 * Stream long-running task progress
 *
 * The progress counter is intentionally capped at 90% until the underlying
 * task resolves — emitting 100% before the task completes would lie to
 * consumers and break idempotent progress UIs.
 */
export async function* streamTaskProgress<T>(
  task: () => Promise<T>,
  options: {
    updateInterval?: number;
    progressCallback?: (progress: number) => void;
  } = {}
): AsyncIterable<{ progress: number; result?: T; error?: string }> {
  const { updateInterval = 500, progressCallback } = options;

  let progress = 0;
  let result: T | undefined;
  let error: string | undefined;
  let resolved = false;

  // Start task in background
  const taskPromise = task()
    .then((r) => {
      result = r;
      resolved = true;
      return r;
    })
    .catch((e) => {
      error = e instanceof Error ? e.message : String(e);
      resolved = true;
    });

  // Yield indeterminate progress until the task resolves
  while (!resolved) {
    yield { progress };
    progress = Math.min(progress + 10, 90);
    progressCallback?.(progress);
    await new Promise((resolve) => setTimeout(resolve, updateInterval));
  }

  // Wait for the task to settle in case it resolved between the loop check
  // and the final yield.
  await taskPromise.catch(() => undefined);

  if (error) {
    yield { progress, error };
  } else {
    progress = 100;
    progressCallback?.(progress);
    yield { progress, result };
  }
}


// ============================================================
// Utility Functions
// ============================================================

/**
 * Convert async generator to SSE message generator
 */
export async function* toSSEMessages<T>(
  generator: AsyncIterable<T>,
  eventName: string = 'message'
): AsyncIterable<SSEMessage> {
  for await (const data of generator) {
    yield { event: eventName, data };
  }
}

/**
 * Poll task status and yield SSE messages
 */
export async function* pollTaskStatus<T>(
  getTask: () => Promise<{ status: string; result?: T; error?: string }>,
  options: {
    interval?: number;
    maxDuration?: number;
  } = {}
): AsyncIterable<SSEMessage> {
  const { interval = 1000, maxDuration = 300000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < maxDuration) {
    const task = await getTask();

    yield {
      event: 'progress',
      data: { status: task.status }
    };

    if (task.result) {
      yield {
        event: 'complete',
        data: { result: task.result }
      };
      return;
    }

    if (task.error) {
      yield {
        event: 'error',
        data: { error: task.error }
      };
      return;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  yield {
    event: 'error',
    data: { error: 'Task timeout' }
  };
}
