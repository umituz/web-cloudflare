/**
 * Batch Size Value Object
 * @description Validates and encapsulates batch size configuration for queue consumer
 */

export class BatchSize {
  private readonly value: number;
  private readonly MIN_SIZE = 1;
  private readonly MAX_SIZE = 100; // Cloudflare Queues max batch size

  constructor(size: number) {
    this.validate(size);
    this.value = size;
  }

  /**
   * Validate batch size
   * @private
   */
  private validate(size: number): void {
    if (!Number.isInteger(size)) {
      throw new Error('Batch size must be an integer');
    }

    if (size < this.MIN_SIZE) {
      throw new Error(`Batch size cannot be less than ${this.MIN_SIZE}`);
    }

    if (size > this.MAX_SIZE) {
      throw new Error(`Batch size cannot exceed ${this.MAX_SIZE}`);
    }
  }

  /**
   * Get batch size value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Check if this is a small batch (1-10)
   */
  isSmall(): boolean {
    return this.value <= 10;
  }

  /**
   * Check if this is a medium batch (11-50)
   */
  isMedium(): boolean {
    return this.value > 10 && this.value <= 50;
  }

  /**
   * Check if this is a large batch (51-100)
   */
  isLarge(): boolean {
    return this.value > 50;
  }

  /**
   * Get recommended wait time based on batch size
   * @returns Recommended max wait time in seconds
   */
  getRecommendedWaitTime(): number {
    if (this.isSmall()) {
      return 5; // 5 seconds for small batches
    } else if (this.isMedium()) {
      return 10; // 10 seconds for medium batches
    } else {
      return 20; // 20 seconds for large batches
    }
  }

  /**
   * Create a smaller batch size (half)
   */
  half(): BatchSize {
    return new BatchSize(Math.max(this.MIN_SIZE, Math.floor(this.value / 2)));
  }

  /**
   * Create a larger batch size (double)
   */
  double(): BatchSize {
    return new BatchSize(Math.min(this.MAX_SIZE, this.value * 2));
  }

  /**
   * Check if two batch sizes are equal
   */
  equals(other: BatchSize): boolean {
    return this.value === other.value;
  }

  /**
   * Convert to number
   */
  toNumber(): number {
    return this.value;
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.value.toString();
  }

  /**
   * Convert to JSON
   */
  toJSON(): number {
    return this.value;
  }

  /**
   * Create BatchSize from number
   */
  static create(size: number): BatchSize {
    return new BatchSize(size);
  }

  /**
   * Get minimum batch size
   */
  static getMinSize(): number {
    return 1;
  }

  /**
   * Get maximum batch size
   */
  static getMaxSize(): number {
    return 100;
  }

  /**
   * Validate batch size without throwing
   */
  static isValid(size: number): boolean {
    try {
      new BatchSize(size);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create small batch (1-10)
   */
  static small(size: number = 10): BatchSize {
    return new BatchSize(Math.min(10, size));
  }

  /**
   * Create medium batch (11-50)
   */
  static medium(size: number = 25): BatchSize {
    return new BatchSize(Math.min(50, Math.max(11, size)));
  }

  /**
   * Create large batch (51-100)
   */
  static large(size: number = 100): BatchSize {
    return new BatchSize(Math.min(100, Math.max(51, size)));
  }
}
