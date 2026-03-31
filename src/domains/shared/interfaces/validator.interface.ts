/**
 * Validator Interface
 * @description Domain layer interface for validation (Dependency Inversion)
 */

export interface IValidator {
  validate(input: string): boolean;
  errorMessage: string;
}
