// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_AGAM_API_URL || "http://localhost:3001";
const TOKEN_STORAGE_KEY = "qdoc_auth_token";

// Carries the API's `details` payload (e.g. duplicate-match candidates on a 409)
// through to the caller instead of collapsing every error to a bare message.
export class ApiRequestError extends Error {
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "ApiRequestError";
    this.details = details;
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

const REQUEST_TIMEOUT_MS = 15000;

export async function fetchWithAuth(
  url: string | URL | Request,
  options: RequestInit = {},
) {
  const token = getAuthToken();

  const headers = {
    ...options.headers,
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  // Some browsers (notably iOS/iPadOS Safari) can leave a fetch() promise
  // pending indefinitely instead of rejecting it, so a hard timeout is
  // required to guarantee the caller's promise always settles.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? timeoutController.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchWithAuthAndRetry(
  url: any,
  options: RequestInit = {},
  retries = 2,
) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithAuth(url, options);

      // If unauthorized and we have retries left, wait a bit and try again
      if (response.status === 401 && i < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1))); // Wait longer each retry
        continue;
      }

      return response;
    } catch (error) {
      if (i === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
}
