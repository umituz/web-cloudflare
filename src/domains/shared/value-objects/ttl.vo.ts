/**
 * TTL Value Object
 * @description Immutable Time-To-Live value object with validation
 */

import { ValueObject } from './base.value-object';

interface TTLProps {
  seconds: number;
}

export class TTL extends ValueObject<TTLProps> {
  private static readonly MIN_TTL = 0; // 0 means no expiration
  private static readonly MAX_TTL = 31536000; // 365 days in seconds

  private constructor(props: TTLProps) {
    super(props);
  }

  get seconds(): number {
    return this.props.seconds;
  }

  get inMinutes(): number {
    return Math.floor(this.props.seconds / 60);
  }

  get inHours(): number {
    return Math.floor(this.props.seconds / 3600);
  }

  get inDays(): number {
    return Math.floor(this.props.seconds / 86400);
  }

  /**
   * Create TTL with validation
   */
  public static create(seconds: number): TTL {
    if (!Number.isInteger(seconds)) {
      throw new Error('TTL must be an integer');
    }

    if (seconds < this.MIN_TTL) {
      throw new Error(`TTL cannot be negative`);
    }

    if (seconds > this.MAX_TTL) {
      throw new Error(`TTL cannot exceed ${this.MAX_TTL} seconds (365 days)`);
    }

    return new TTL({ seconds });
  }

  /**
   * Create from minutes
   */
  public static fromMinutes(minutes: number): TTL {
    return this.create(minutes * 60);
  }

  /**
   * Create from hours
   */
  public static fromHours(hours: number): TTL {
    return this.create(hours * 3600);
  }

  /**
   * Create from days
   */
  public static fromDays(days: number): TTL {
    return this.create(days * 86400);
  }

  /**
   * Common presets
   */
  public static readonly ONE_MINUTE = TTL.fromMinutes(1);
  public static readonly FIVE_MINUTES = TTL.fromMinutes(5);
  public static readonly FIFTEEN_MINUTES = TTL.fromMinutes(15);
  public static readonly ONE_HOUR = TTL.fromHours(1);
  public static readonly SIX_HOURS = TTL.fromHours(6);
  public static readonly ONE_DAY = TTL.fromDays(1);
  public static readonly ONE_WEEK = TTL.fromDays(7);
  public static readonly THIRTY_DAYS = TTL.fromDays(30);

  /**
   * No expiration
   */
  public static readonly NONE = TTL.create(0);

  /**
   * Check if expired
   */
  isExpired(createdAt: number): boolean {
    if (this.props.seconds === 0) return false; // Never expires
    return Date.now() - createdAt > this.props.seconds * 1000;
  }
}
