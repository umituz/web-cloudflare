/**
 * Domain Event Base
 * @description Abstract base class for domain events with metadata
 */

export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventId: string;

  constructor() {
    this.occurredAt = new Date();
    this.eventId = this.generateEventId();
  }

  private generateEventId(): string {
    return `${this.constructor.name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get event name
   */
  getEventName(): string {
    return this.constructor.name;
  }

  /**
   * Get aggregate ID (override in subclasses)
   */
  getAggregateId(): string {
    throw new Error('getAggregateId must be implemented');
  }
}
