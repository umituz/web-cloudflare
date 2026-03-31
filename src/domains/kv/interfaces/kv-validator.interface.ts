/**
 * KV Validator Interface
 * @description Domain-specific validation interface
 */

import { IValidator } from '../../shared/interfaces/validator.interface';

export interface IKVValidator extends IValidator {
  isValidKey(key: string): boolean;
}
