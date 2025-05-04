export default class AppError extends Error {
  public readonly httpCode: number;
  public readonly isOperational: boolean;

  constructor(httpCode: number, errorMessage: string, isOperational: boolean) {
    super(errorMessage);
    this.httpCode = httpCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}
