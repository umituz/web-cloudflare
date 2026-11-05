
export interface IValidator {
  validate(input: string): boolean;
  errorMessage: string;
}
