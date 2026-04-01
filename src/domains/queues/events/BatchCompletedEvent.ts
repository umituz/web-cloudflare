/**
 * Batch Completed Event
 * @description Domain event fired when a batch of messages is processed
 */

export class BatchCompletedEvent {
  readonly eventType = 'batch_completed' as const;
  readonly queue: string;
  readonly timestamp: number;
  readonly batchSize: number;
  readonly successfulCount: number;
  readonly failedCount: number;
  readonly processingTime: number;
  readonly metadata?: Record<string, unknown>;

  constructor(
    queue: string,
    batchSize: number,
    successfulCount: number,
    failedCount: number,
    processingTime: number,
    metadata?: Record<string, unknown>
  ) {
    this.queue = queue;
    this.batchSize = batchSize;
    this.successfulCount = successfulCount;
    this.failedCount = failedCount;
    this.processingTime = processingTime;
    this.timestamp = Date.now();
    this.metadata = metadata;
  }

  /**
   * Get success rate
   * @returns Success rate as percentage (0-100)
   */
  getSuccessRate(): number {
    if (this.batchSize === 0) return 100;
    return (this.successfulCount / this.batchSize) * 100;
  }

  /**
   * Check if batch was completely successful
   */
  isCompletelySuccessful(): boolean {
    return this.failedCount === 0;
  }

  /**
   * Check if batch completely failed
   */
  isCompletelyFailed(): boolean {
    return this.successfulCount === 0;
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      eventType: this.eventType,
      queue: this.queue,
      timestamp: this.timestamp,
      batchSize: this.batchSize,
      successfulCount: this.successfulCount,
      failedCount: this.failedCount,
      processingTime: this.processingTime,
      successRate: this.getSuccessRate(),
      metadata: this.metadata,
    };
  }

  /**
   * Create event from batch results
   */
  static create(
    queue: string,
    batchSize: number,
    successfulCount: number,
    failedCount: number,
    processingTime: number,
    metadata?: Record<string, unknown>
  ): BatchCompletedEvent {
    return new BatchCompletedEvent(
      queue,
      batchSize,
      successfulCount,
      failedCount,
      processingTime,
      metadata
    );
  }
}
