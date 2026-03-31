/**
 * Base Value Object
 * @description Abstract base class for value objects with immutability and equality
 */

export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props); // Deep freeze for immutability
  }

  /**
   * Check equality based on properties
   */
  equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.constructor.name !== this.constructor.name) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  /**
   * Get properties (read-only)
   */
  get getProps(): T {
    return this.props;
  }
}
