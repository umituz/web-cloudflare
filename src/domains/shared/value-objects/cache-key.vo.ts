
import { ValueObject } from './base.value-object';

interface CacheKeyProps {
  value: string;
}

export class CacheKey extends ValueObject<CacheKeyProps> {
  private constructor(props: CacheKeyProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(value: string): CacheKey {
    if (!value || value.trim().length === 0) {
      throw new Error('Cache key cannot be empty');
    }

    if (value.length > 512) {
      throw new Error('Cache key cannot exceed 512 characters');
    }

    const validFormat = /^[a-zA-Z0-9:_\-./]+$/;
    if (!validFormat.test(value)) {
      throw new Error('Cache key contains invalid characters');
    }

    return new CacheKey({ value: value.trim() });
  }

  public static withPrefix(prefix: string, key: string): CacheKey {
    const fullKey = `${prefix}:${key}`;
    return this.create(fullKey);
  }

  public static forAI(key: string): CacheKey {
    return this.withPrefix('ai', key);
  }

  public static forTag(tag: string): CacheKey {
    return this.withPrefix('ai:tag', tag);
  }
}
