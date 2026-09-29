export class Result<T, E = Error> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  public readonly error: E | null;
  private readonly _value: T | null;

  private constructor(isSuccess: boolean, error?: E | null, value?: T) {
    if (isSuccess && error) {
      throw new Error('InvalidOperation: A result cannot be successful and contain an error');
    }
    if (!isSuccess && !error) {
      throw new Error('InvalidOperation: A failing result needs to contain an error message');
    }

    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error || null;
    this._value = value !== undefined ? value : null;
  }

  public getValue(): T {
    if (!this.isSuccess || this._value === null) {
      throw new Error('Can not get the value of an error result. Use error instead.');
    }
    return this._value;
  }

  public static ok<U>(value?: U): Result<U, never> {
    return new Result<U, never>(true, null, value);
  }

  public static fail<E>(error: E): Result<never, E> {
    return new Result<never, E>(false, error);
  }
}
