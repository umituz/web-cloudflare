/**
 * Queue Name Value Object
 * @description Validates and encapsulates queue name according to Cloudflare Queues naming rules
 */

export class QueueName {
  private readonly value: string;

  constructor(name: string) {
    this.validate(name);
    this.value = this.sanitize(name);
  }

  /**
   * Validate queue name
   * @private
   */
  private validate(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Queue name cannot be empty');
    }

    if (name.length > 100) {
      throw new Error('Queue name cannot exceed 100 characters');
    }

    // Cloudflare Queues naming rules:
    // - Only alphanumeric characters, hyphens, and underscores
    // - Must start with a letter
    // - Case-sensitive
    const validPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

    if (!validPattern.test(name)) {
      throw new Error(
        `Invalid queue name: "${name}". ` +
        'Queue name must start with a letter and contain only letters, numbers, hyphens, and underscores.'
      );
    }

    // Reserved prefixes
    if (name.startsWith('cf-') || name.startsWith('cloudflare-')) {
      throw new Error('Queue name cannot start with "cf-" or "cloudflare-" (reserved prefix)');
    }
  }

  /**
   * Sanitize queue name
   * @private
   */
  private sanitize(name: string): string {
    return name.trim();
  }

  /**
   * Get queue name value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check if this is a dead letter queue
   */
  isDeadLetterQueue(): boolean {
    return this.value.endsWith('-dlq') || this.value.endsWith('-dead-letter');
  }

  /**
   * Create dead letter queue name for this queue
   */
  toDeadLetterQueue(): QueueName {
    if (this.isDeadLetterQueue()) {
      return this; // Already a DLQ
    }
    return new QueueName(`${this.value}-dlq`);
  }

  /**
   * Check if two queue names are equal
   */
  equals(other: QueueName): boolean {
    return this.value === other.value;
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.value;
  }

  /**
   * Convert to JSON
   */
  toJSON(): string {
    return this.value;
  }

  /**
   * Create QueueName from string
   */
  static create(name: string): QueueName {
    return new QueueName(name);
  }

  /**
   * Validate queue name without throwing
   */
  static isValid(name: string): boolean {
    try {
      new QueueName(name);
      return true;
    } catch {
      return false;
    }
  }
}
