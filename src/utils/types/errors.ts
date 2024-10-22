export default class AppError extends Error {
  public readonly httpCode: number;
  public readonly name: string;
  public readonly isOperational: boolean;

  constructor(
    httpCode: number,
    name: string,
    errorMessage: string,
    isOperational: boolean
  ) {
    super(errorMessage);
    this.httpCode = httpCode;
    this.name = name;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}
