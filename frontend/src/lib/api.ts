import { getAccessToken } from './auth-storage';

/** Same-origin API when unified server runs; override for split dev if needed. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

/** Thrown when fetch cannot reach the API (backend down, wrong URL, CORS). */
export const API_NETWORK_ERROR = 'API_NETWORK_ERROR';

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export function isApiNetworkError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === API_NETWORK_ERROR ||
      err.message === 'Failed to fetch' ||
      err.name === 'TypeError')
  );
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(apiUrl(path), init);
  } catch {
    const error = new Error(API_NETWORK_ERROR) as Error & { apiBase: string };
    error.apiBase = API_BASE;
    throw error;
  }
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data.message;
    const msg =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'object' && raw && 'message' in raw
          ? String((raw as { message: string }).message)
          : Array.isArray(data.errors)
            ? `${data.errors.length} validation errors`
            : `Request failed (${res.status})`;
    const error = new Error(msg) as Error & { details?: unknown };
    error.details = data;
    throw error;
  }
  return data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseResponse<T>(res);
}

function fileNameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/** Download a protected file endpoint (plain links cannot send the JWT from localStorage). */
export async function downloadAuthenticatedFile(
  path: string,
  fallbackFileName: string,
): Promise<void> {
  const res = await apiFetch(path, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.message === 'string' ? err.message : `Download failed (${res.status})`,
    );
  }
  const blob = await res.blob();
  const fileName = fileNameFromContentDisposition(
    res.headers.get('Content-Disposition'),
    fallbackFileName,
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
