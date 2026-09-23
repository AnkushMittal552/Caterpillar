import type {
  DashboardResponse,
  Task,
  Incident,
  PauseTaskPayload,
  TaskPrediction,
  TaskPredictionPayload,
  UsageInsightsResponse,
  SupportRequest,
  CreateSupportRequestPayload,
} from '../types';

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

const DEFAULT_TIMEOUT_MS = 5000;

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

/**
 * Fetch safety and operational incidents from GET /api/incidents
 */
export async function getIncidents(): Promise<Incident[]> {
  return request<Incident[]>('/api/incidents');
}

/**
 * Acknowledge an incident via POST /api/incidents/{id}/acknowledge
 */
export async function acknowledgeIncident(id: string | number): Promise<Incident> {
  return request<Incident>(`/api/incidents/${encodeURIComponent(String(id))}/acknowledge`, {
    method: 'POST',
  });
}

/**
 * Start a pending task via POST /api/tasks/{task_id}/start
 */
export async function startTask(taskId: string): Promise<Task> {
  return request<Task>(`/api/tasks/${encodeURIComponent(taskId)}/start`, {
    method: 'POST',
  });
}

/**
 * Pause an in-progress task via POST /api/tasks/{task_id}/pause
 */
export async function pauseTask(taskId: string, reason: string, note: string = ''): Promise<Task> {
  const payload: PauseTaskPayload = { reason, note };
  return request<Task>(`/api/tasks/${encodeURIComponent(taskId)}/pause`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Resume a paused task via POST /api/tasks/{task_id}/resume
 */
export async function resumeTask(taskId: string): Promise<Task> {
  return request<Task>(`/api/tasks/${encodeURIComponent(taskId)}/resume`, {
    method: 'POST',
  });
}

/**
 * Mark a task as completed via POST /api/tasks/{task_id}/complete
 */
export async function completeTask(taskId: string): Promise<Task> {
  return request<Task>(`/api/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Phase 3 Client API Methods
// ---------------------------------------------------------------------------

/**
 * Predict task completion time via POST /api/predict/task-time
 */
export async function predictTaskTime(payload: TaskPredictionPayload): Promise<TaskPrediction> {
  return request<TaskPrediction>('/api/predict/task-time', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch explainable machine usage insights via GET /api/usage-insights
 */
export async function getUsageInsights(machineId: string = 'EXC001'): Promise<UsageInsightsResponse> {
  return request<UsageInsightsResponse>(`/api/usage-insights?machine_id=${encodeURIComponent(machineId)}`);
}

/**
 * Fetch operator-supervisor support requests via GET /api/support-requests
 */
export async function getSupportRequests(status?: string): Promise<SupportRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<SupportRequest[]>(`/api/support-requests${query}`);
}

/**
 * Submit a new support request via POST /api/support-requests
 */
export async function createSupportRequest(payload: CreateSupportRequestPayload): Promise<SupportRequest> {
  return request<SupportRequest>('/api/support-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Supervisor acknowledges request via POST /api/support-requests/{id}/acknowledge
 */
export async function acknowledgeSupportRequest(id: string): Promise<SupportRequest> {
  return request<SupportRequest>(`/api/support-requests/${encodeURIComponent(id)}/acknowledge`, {
    method: 'POST',
  });
}

/**
 * Supervisor responds to request via POST /api/support-requests/{id}/respond
 */
export async function respondSupportRequest(id: string, message: string): Promise<SupportRequest> {
  return request<SupportRequest>(`/api/support-requests/${encodeURIComponent(id)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/**
 * Supervisor resolves request via POST /api/support-requests/{id}/resolve
 */
export async function resolveSupportRequest(id: string): Promise<SupportRequest> {
  return request<SupportRequest>(`/api/support-requests/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
  });
}
