
export interface SSEMessage {
  data: unknown;
  event?: string;
  id?: string;
  retry?: number;
}

export interface ProgressCallback {
  (progress: number, status: string, data?: Record<string, unknown>): void;
}


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

export async function* createSSEStream(
  generator: AsyncIterable<SSEMessage>
): AsyncIterable<string> {
  for await (const message of generator) {
    yield createSSEMessage(message);
  }
}

export function createSSEReadableStream(
  generator: () => AsyncIterable<SSEMessage>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of generator()) {
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


export class ProgressTracker {
  private callbacks: ProgressCallback[] = [];
  private currentProgress: number = 0;
  private currentStatus: string = '';
  private metadata: Record<string, unknown> = {};

  onCallbackError?: (error: unknown) => void = (error) => {
    console.error('[ProgressTracker] subscriber threw:', error);
  };

  onProgress(callback: ProgressCallback): this {
    this.callbacks.push(callback);
    return this;
  }

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
        this.onCallbackError?.(error);
      }
    }
  }

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

  reset(): void {
    this.currentProgress = 0;
    this.currentStatus = '';
    this.metadata = {};
  }

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

  while (!resolved) {
    yield { progress };
    progress = Math.min(progress + 10, 90);
    progressCallback?.(progress);
    await new Promise((resolve) => setTimeout(resolve, updateInterval));
  }

  await taskPromise.catch(() => undefined);

  if (error) {
    yield { progress, error };
  } else {
    progress = 100;
    progressCallback?.(progress);
    yield { progress, result };
  }
}



export async function* toSSEMessages<T>(
  generator: AsyncIterable<T>,
  eventName: string = 'message'
): AsyncIterable<SSEMessage> {
  for await (const data of generator) {
    yield { event: eventName, data };
  }
}

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
