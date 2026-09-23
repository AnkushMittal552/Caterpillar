import type { DashboardResponse, Task } from '../types';

export class ApiError extends Error {
  status?: number;
  isNetworkError: boolean;

  constructor(message: string, status?: number, isNetworkError: boolean = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

const DEFAULT_TIMEOUT_MS = 4000;

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new ApiError(
        `Server returned ${response.status}: ${response.statusText || errorBody || 'Request failed'}`,
        response.status,
        false
      );
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof ApiError) {
      throw err;
    }

    const isAbort = (err as { name?: string })?.name === 'AbortError';
    const message = isAbort
      ? `Backend request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s. Server not responding.`
      : `Cannot connect to backend server. Make sure the backend is running.`;

    throw new ApiError(message, undefined, true);
  }
}

/**
 * Fetch current dashboard state from GET /api/dashboard
 */
export async function getDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>('/api/dashboard');
}

/**
 * Fetch task list from GET /api/tasks
 */
export async function getTasks(): Promise<Task[]> {
  return request<Task[]>('/api/tasks');
}
