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
  AssistantResponse,
  TrainingModule,
  TrainingModuleDetail,
  TrainingRecommendation,
  TrainingSubmitResponse,
  ShiftHandoverReport,
  UserRole,
  AuditEvent,
  NotificationItem,
  KPISummary,
  DemoScenarioResponse,
  DemoResetResponse,
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

// Global active role management
let activeRole: UserRole = (localStorage.getItem('shiftmate_role') as UserRole) || 'OPERATOR';

export function getActiveRole(): UserRole {
  return activeRole;
}

export function setActiveRole(role: UserRole): void {
  activeRole = role;
  try {
    localStorage.setItem('shiftmate_role', role);
    window.dispatchEvent(new CustomEvent('shiftmate-role-changed', { detail: role }));
  } catch {
    // ignore local storage error
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
        'X-Role': activeRole,
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

// ---------------------------------------------------------------------------
// Phase 4 Client API Methods
// ---------------------------------------------------------------------------

/**
 * Ask the grounded AI operator assistant via POST /api/assistant
 */
export async function askAssistant(message: string): Promise<AssistantResponse> {
  return request<AssistantResponse>('/api/assistant', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/**
 * Fetch available training modules via GET /api/training
 */
export async function getTrainingModules(operatorId: string = 'OP1001'): Promise<TrainingModule[]> {
  return request<TrainingModule[]>(`/api/training?operator_id=${encodeURIComponent(operatorId)}`);
}

/**
 * Fetch shift event training recommendations via GET /api/training/recommendations
 */
export async function getTrainingRecommendations(operatorId: string = 'OP1001'): Promise<TrainingRecommendation[]> {
  return request<TrainingRecommendation[]>(`/api/training/recommendations?operator_id=${encodeURIComponent(operatorId)}`);
}

/**
 * Fetch module detail and quiz questions via GET /api/training/{module_id}
 */
export async function getTrainingModule(moduleId: string, operatorId: string = 'OP1001'): Promise<TrainingModuleDetail> {
  return request<TrainingModuleDetail>(`/api/training/${encodeURIComponent(moduleId)}?operator_id=${encodeURIComponent(operatorId)}`);
}

/**
 * Submit training quiz answers via POST /api/training/{module_id}/submit
 */
export async function submitTrainingQuiz(
  moduleId: string,
  answers: Record<string, string>,
  operatorId: string = 'OP1001'
): Promise<TrainingSubmitResponse> {
  return request<TrainingSubmitResponse>(`/api/training/${encodeURIComponent(moduleId)}/submit?operator_id=${encodeURIComponent(operatorId)}`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

/**
 * Fetch shift handover report via GET /api/handover
 */
export async function getHandoverReport(
  machineId: string = 'EXC001',
  operatorId: string = 'OP1001'
): Promise<ShiftHandoverReport> {
  return request<ShiftHandoverReport>(`/api/handover?machine_id=${encodeURIComponent(machineId)}&operator_id=${encodeURIComponent(operatorId)}`);
}

// ---------------------------------------------------------------------------
// Phase 5 Client API Methods: Real-Time, Audit, Notifications, Demo & KPIs
// ---------------------------------------------------------------------------

/**
 * Fetch traceable audit events via GET /api/audit
 */
export async function getAuditTrail(params?: {
  entity_type?: string;
  actor_id?: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  const queryParts: string[] = [];
  if (params?.entity_type) queryParts.push(`entity_type=${encodeURIComponent(params.entity_type)}`);
  if (params?.actor_id) queryParts.push(`actor_id=${encodeURIComponent(params.actor_id)}`);
  if (params?.limit) queryParts.push(`limit=${params.limit}`);
  const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return request<AuditEvent[]>(`/api/audit${qs}`);
}

/**
 * Fetch unified notifications via GET /api/notifications
 */
export async function getNotifications(limit: number = 50): Promise<NotificationItem[]> {
  return request<NotificationItem[]>(`/api/notifications?limit=${limit}`);
}

/**
 * Mark a notification as read via POST /api/notifications/{id}/read
 */
export async function markNotificationRead(id: string): Promise<{ id: string; read: boolean }> {
  return request<{ id: string; read: boolean }>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  });
}

/**
 * Mark all notifications as read via POST /api/notifications/read-all
 */
export async function markAllNotificationsRead(): Promise<{ message: string; marked_count: number }> {
  return request<{ message: string; marked_count: number }>('/api/notifications/read-all', {
    method: 'POST',
  });
}

/**
 * Trigger named demo scenario via POST /api/demo/scenario/{scenario_name}
 */
export async function triggerDemoScenario(scenarioName: string): Promise<DemoScenarioResponse> {
  return request<DemoScenarioResponse>(`/api/demo/scenario/${encodeURIComponent(scenarioName)}`, {
    method: 'POST',
  });
}

/**
 * Deterministic Demo Reset via POST /api/demo/reset
 */
export async function resetDemo(): Promise<DemoResetResponse> {
  return request<DemoResetResponse>('/api/demo/reset', {
    method: 'POST',
  });
}

/**
 * Fetch factual shift KPI summary via GET /api/kpi/summary
 */
export async function getKpiSummary(): Promise<KPISummary> {
  return request<KPISummary>('/api/kpi/summary');
}

