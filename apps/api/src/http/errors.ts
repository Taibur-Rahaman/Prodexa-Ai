export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
};

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
