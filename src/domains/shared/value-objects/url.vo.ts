/**
 * URL Value Object
 * @description Immutable URL value object with validation
 */

import { ValueObject } from './base.value-object';

interface URLProps {
  value: string;
}

export class URLValue extends ValueObject<URLProps> {
  private constructor(props: URLProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  get protocol(): string {
    return new URL(this.props.value).protocol;
  }

  get hostname(): string {
    return new URL(this.props.value).hostname;
  }

  get pathname(): string {
    return new URL(this.props.value).pathname;
  }

  get search(): string {
    return new URL(this.props.value).search;
  }

  /**
   * Create URL with validation
   */
  public static create(url: string): URLValue {
    const normalized = url.trim();

    if (!normalized || normalized.length < 3) {
      throw new Error('URL cannot be empty or too short');
    }

    try {
      new URL(normalized);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    return new URLValue({ value: normalized });
  }

  /**
   * Create with protocol
   */
  public static withProtocol(protocol: 'http:' | 'https:', hostname: string, pathname?: string): URLValue {
    const path = pathname || '/';
    const url = `${protocol}//${hostname}${path}`;
    return this.create(url);
  }

  /**
   * Safe creation - returns null instead of throwing
   */
  public static createSafe(url: string): URLValue | null {
    try {
      return this.create(url);
    } catch {
      return null;
    }
  }

  /**
   * Check if same origin
   */
  isSameOrigin(other: URLValue): boolean {
    return this.hostname === other.hostname && this.protocol === other.protocol;
  }
}
