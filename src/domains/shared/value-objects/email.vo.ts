/**
 * Email Value Object
 * @description Immutable email value object with validation
 */

import { ValueObject } from './base.value-object';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  get domain(): string {
    return this.props.value.split('@')[1];
  }

  get localPart(): string {
    return this.props.value.split('@')[0];
  }

  /**
   * Create Email with validation
   */
  public static create(email: string): Email {
    const normalized = email.trim().toLowerCase();

    if (!normalized || normalized.length === 0) {
      throw new Error('Email cannot be empty');
    }

    if (normalized.length < 3 || normalized.length > 254) {
      throw new Error('Email must be between 3 and 254 characters');
    }

    if (!normalized.includes('@')) {
      throw new Error('Email must contain @ symbol');
    }

    if (normalized.startsWith('@') || normalized.endsWith('@')) {
      throw new Error('Email cannot start or end with @ symbol');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      throw new Error('Invalid email format');
    }

    return new Email({ value: normalized });
  }

  /**
   * Safe creation - returns null instead of throwing
   */
  public static createSafe(email: string): Email | null {
    try {
      return this.create(email);
    } catch {
      return null;
    }
  }
}
