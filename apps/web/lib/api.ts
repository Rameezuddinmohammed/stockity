import type { ApiError, ErrorCode } from "@quad/shared";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Calls the Fastify API (same origin via the /api rewrite) and throws ApiClientError on failure. */
export async function api<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiClientError(0, "INTERNAL", "Can't reach Quad right now. Check your connection.");
  }
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "INTERNAL",
      err?.message ?? "Something went wrong on our side. Try again?",
      err?.details,
    );
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong on our side. Try again?";
