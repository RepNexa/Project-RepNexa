export type ApiFieldError = { field: string; message: string };

export type ApiError = {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  requestId?: string | null;
  fieldErrors?: ApiFieldError[];
};

export function isApiError(x: unknown): x is ApiError {
  if (x === null || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o["status"] === "number" &&
    typeof o["code"] === "string" &&
    typeof o["message"] === "string"
  );
}
