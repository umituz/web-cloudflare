
import type { IKVValidator } from '../../domains/kv/interfaces/kv-validator.interface';

export class KVValidator implements IKVValidator {
  readonly errorMessage = 'Invalid KV key format';

  validate(input: string): boolean {
    return this.isValidKey(input);
  }

  isValidKey(key: string): boolean {
    if (!key || key.trim().length === 0) return false;
    if (key.length > 512) return false;

    const validFormat = /^[a-zA-Z0-9:_\-./]+$/;
    return validFormat.test(key);
  }
}

export const kvValidator = new KVValidator();
