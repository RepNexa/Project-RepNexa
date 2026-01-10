import type { ApiError } from "./types";

const API_BASE = "/api/v1";

let csrfTokenCache: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw await normalizeError(res, "/auth/csrf");
  }

  const data = (await res.json()) as { token: string };
  csrfTokenCache = data.token;
  return data.token;
}

export function clearCsrfTokenCache() {
  csrfTokenCache = null;
}

type ApiFetchOpts = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  requireCsrf?: boolean;
};

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOpts = {}
): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);
  const requireCsrf = opts.requireCsrf ?? isStateChanging;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers ?? {}),
  };

  if (requireCsrf) {
    const token = csrfTokenCache ?? (await fetchCsrfToken());
    headers["X-CSRF-Token"] = token;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    throw await normalizeError(res, path);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return undefined as unknown as T;
}

async function normalizeError(res: Response, path: string): Promise<ApiError> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await res.json()) as ApiError;
      // Ensure path is present even if backend omitted it
      return { ...body, path: body.path ?? path };
    } catch {
      // fall through
    }
  }
  return {
    timestamp: new Date().toISOString(),
    status: res.status,
    error: res.statusText || "Error",
    code: "HTTP_ERROR",
    message: `Request failed (${res.status})`,
    path,
  };
}
