// Transport shared by apps/web and apps/doctor.
//
// The only thing that differs between the two is where the auth token lives
// (localStorage on web, expo-secure-store on mobile), so that is injected as a
// TokenStore rather than reached for directly. Everything else — base URL
// handling, the timeout, 401 retry, error shape — is identical on both.

export interface TokenStore {
  get(): Promise<string | null> | string | null;
  set(token: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

/**
 * Carries the API's `details` payload (e.g. duplicate-match candidates on a
 * 409) through to the caller instead of collapsing every error to a bare
 * message.
 */
export class ApiRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  /** Defaults to 15s. */
  timeoutMs?: number;
  /** Retries on a 401 before giving up. Defaults to 2. */
  retries?: number;
  /** Called when a request still 401s after all retries — used to sign out. */
  onUnauthorized?: () => void;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skips the Authorization header — for login/forgot-password. */
  anonymous?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;

function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions["query"],
): string {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(options: ApiClientOptions) {
  const {
    baseUrl,
    tokenStore,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    onUnauthorized,
  } = options;

  async function rawFetch(
    url: string,
    init: RequestOptions,
  ): Promise<Response> {
    const token = init.anonymous ? null : await tokenStore.get();

    const hasBody = init.body !== undefined;
    const headers: Record<string, string> = {
      ...(hasBody && { "Content-Type": "application/json" }),
      ...(init.headers as Record<string, string> | undefined),
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    // Some clients (notably iOS/iPadOS Safari, and React Native on a flaky
    // connection) can leave a fetch() promise pending indefinitely instead of
    // rejecting it, so a hard timeout is required to guarantee the caller's
    // promise always settles.
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...(init as RequestInit),
        headers,
        body: hasBody ? JSON.stringify(init.body) : undefined,
        signal: init.signal ?? timeoutController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const url = buildUrl(baseUrl, path, init.query);

    let response: Response | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        response = await rawFetch(url, init);
        if (response.status === 401 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        break;
      } catch (error) {
        if (attempt === retries) throw error;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }

    if (!response) throw new ApiRequestError("Network request failed", 0);

    if (response.status === 401) {
      await tokenStore.clear();
      onUnauthorized?.();
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        details?: unknown;
      };
      throw new ApiRequestError(
        errorData.error || errorData.message || `Request failed (${response.status})`,
        response.status,
        errorData.details,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    request,
    get: <T>(path: string, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "POST", body }),
    patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "PATCH", body }),
    put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "PUT", body }),
    del: <T>(path: string, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "DELETE" }),
    tokenStore,
    apiUrl: (path: string) => buildUrl(baseUrl, path),
  };
}
