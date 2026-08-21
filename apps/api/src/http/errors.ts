export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
};

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function apiError(
  code: string,
  message: string,
  requestId: string,
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      request_id: requestId,
    },
  };
}
