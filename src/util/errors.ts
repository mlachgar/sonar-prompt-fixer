export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly responseBody?: string;

  public constructor(message: string, statusCode: number, responseBody?: string) {
    super(message);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class ConfigurationError extends Error {}

export function isErrorWithCode(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === 'object' && 'code' in error;
}
