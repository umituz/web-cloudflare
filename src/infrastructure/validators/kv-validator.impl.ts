/**
 * KV Validator Implementation
 * @description Infrastructure layer implementation of KV validation
 */

import type { IKVValidator } from '../../domains/kv/interfaces/kv-validator.interface';

export class KVValidator implements IKVValidator {
  readonly errorMessage = 'Invalid KV key format';

  validate(input: string): boolean {
    return this.isValidKey(input);
  }

  isValidKey(key: string): boolean {
    if (!key || key.trim().length === 0) return false;
    if (key.length > 512) return false;

    // KV keys can contain alphanumeric, hyphen, underscore, colon, dot, forward slash
    const validFormat = /^[a-zA-Z0-9:_\-./]+$/;
    return validFormat.test(key);
  }
}

// Export singleton
export const kvValidator = new KVValidator();
