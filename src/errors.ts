export class XriftSdkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XriftSdkError';
  }
}

export class XriftApiError extends XriftSdkError {
  readonly statusCode: number;
  readonly responseBody?: unknown;

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message);
    this.name = 'XriftApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class XriftAuthError extends XriftApiError {
  constructor(message: string = 'Authentication failed', responseBody?: unknown) {
    super(message, 401, responseBody);
    this.name = 'XriftAuthError';
  }
}

export class XriftNetworkError extends XriftSdkError {
  readonly cause?: Error;

  constructor(message: string = 'Network request failed', cause?: Error) {
    super(message);
    this.name = 'XriftNetworkError';
    this.cause = cause;
  }
}
