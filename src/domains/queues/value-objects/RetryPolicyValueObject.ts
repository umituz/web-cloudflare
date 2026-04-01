/**
 * Retry Policy Value Object
 * @description Encapsulates retry strategy and configuration for failed queue messages
 */

import type { RetryPolicy as RetryPolicyType } from '../types';

export class RetryPolicy {
  private readonly config: RetryPolicyType;

  constructor(config: RetryPolicyType) {
    this.validate(config);
    this.config = { ...config };
  }

  /**
   * Validate retry policy configuration
   * @private
   */
  private validate(config: RetryPolicyType): void {
    if (config.maxAttempts < 0 || config.maxAttempts > 10) {
      throw new Error('Max attempts must be between 0 and 10');
    }

    if (config.initialDelay < 0) {
      throw new Error('Initial delay cannot be negative');
    }

    if (config.maxDelay < config.initialDelay) {
      throw new Error('Max delay cannot be less than initial delay');
    }

    if (config.backoffMultiplier < 1) {
      throw new Error('Backoff multiplier must be at least 1');
    }

    const validStrategies: Array<'fixed' | 'linear' | 'exponential'> = ['fixed', 'linear', 'exponential'];
    if (!validStrategies.includes(config.strategy)) {
      throw new Error(`Invalid strategy: ${config.strategy}. Must be one of: ${validStrategies.join(', ')}`);
    }
  }

  /**
   * Get retry policy configuration
   */
  getConfig(): RetryPolicyType {
    return { ...this.config };
  }

  /**
   * Get max retry attempts
   */
  getMaxAttempts(): number {
    return this.config.maxAttempts;
  }

  /**
   * Calculate delay for a given retry attempt
   * @param attempt Retry attempt number (1-based)
   * @returns Delay in milliseconds
   */
  calculateDelay(attempt: number): number {
    if (attempt <= 0) {
      return this.config.initialDelay;
    }

    let delay: number;

    switch (this.config.strategy) {
      case 'fixed':
        delay = this.config.initialDelay;
        break;

      case 'linear':
        delay = this.config.initialDelay * attempt;
        break;

      case 'exponential':
        delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
        break;
    }

    // Apply max delay limit
    delay = Math.min(delay, this.config.maxDelay);

    // Apply jitter if enabled
    if (this.config.useJitter) {
      // Add random jitter: ±25% of delay
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      delay = delay + jitter;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Check if retry should be attempted
   * @param attempt Current attempt number (1-based)
   * @returns True if retry should be attempted
   */
  shouldRetry(attempt: number): boolean {
    return attempt <= this.config.maxAttempts;
  }

  /**
   * Check if this is a no-retry policy
   */
  isNoRetry(): boolean {
    return this.config.maxAttempts === 0;
  }

  /**
   * Check if this uses exponential backoff
   */
  isExponentialBackoff(): boolean {
    return this.config.strategy === 'exponential';
  }

  /**
   * Create a no-retry policy
   */
  static noRetry(): RetryPolicy {
    return new RetryPolicy({
      maxAttempts: 0,
      initialDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1,
      useJitter: false,
      strategy: 'fixed',
    });
  }

  /**
   * Create a fixed delay retry policy
   * @param maxAttempts Maximum retry attempts (default: 3)
   * @param delay Delay between retries in milliseconds (default: 1000)
   */
  static fixed(maxAttempts: number = 3, delay: number = 1000): RetryPolicy {
    return new RetryPolicy({
      maxAttempts,
      initialDelay: delay,
      maxDelay: delay,
      backoffMultiplier: 1,
      useJitter: false,
      strategy: 'fixed',
    });
  }

  /**
   * Create a linear backoff retry policy
   * @param maxAttempts Maximum retry attempts (default: 5)
   * @param initialDelay Initial delay in milliseconds (default: 1000)
   * @param maxDelay Maximum delay in milliseconds (default: 30000)
   */
  static linear(
    maxAttempts: number = 5,
    initialDelay: number = 1000,
    maxDelay: number = 30000
  ): RetryPolicy {
    return new RetryPolicy({
      maxAttempts,
      initialDelay,
      maxDelay,
      backoffMultiplier: 1,
      useJitter: false,
      strategy: 'linear',
    });
  }

  /**
   * Create an exponential backoff retry policy (recommended)
   * @param maxAttempts Maximum retry attempts (default: 5)
   * @param initialDelay Initial delay in milliseconds (default: 1000)
   * @param maxDelay Maximum delay in milliseconds (default: 60000)
   * @param backoffMultiplier Backoff multiplier (default: 2)
   * @param useJitter Whether to use jitter (default: true)
   */
  static exponential(
    maxAttempts: number = 5,
    initialDelay: number = 1000,
    maxDelay: number = 60000,
    backoffMultiplier: number = 2,
    useJitter: boolean = true
  ): RetryPolicy {
    return new RetryPolicy({
      maxAttempts,
      initialDelay,
      maxDelay,
      backoffMultiplier,
      useJitter,
      strategy: 'exponential',
    });
  }

  /**
   * Create a default retry policy
   */
  static default(): RetryPolicy {
    return RetryPolicy.exponential();
  }

  /**
   * Validate retry policy without throwing
   */
  static isValid(config: RetryPolicyType): boolean {
    try {
      new RetryPolicy(config);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if two retry policies are equal
   */
  equals(other: RetryPolicy): boolean {
    return (
      this.config.maxAttempts === other.config.maxAttempts &&
      this.config.initialDelay === other.config.initialDelay &&
      this.config.maxDelay === other.config.maxDelay &&
      this.config.backoffMultiplier === other.config.backoffMultiplier &&
      this.config.useJitter === other.config.useJitter &&
      this.config.strategy === other.config.strategy
    );
  }

  /**
   * Convert to JSON
   */
  toJSON(): RetryPolicyType {
    return this.getConfig();
  }

  /**
   * Convert to string
   */
  toString(): string {
    return `RetryPolicy(${this.config.strategy}, maxAttempts=${this.config.maxAttempts})`;
  }
}
