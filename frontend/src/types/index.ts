export interface Operator {
  id: string;
  name?: string;
}

export interface Machine {
  id: string;
  status: string;
  engine_hours: number;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | string;

export type PauseReason =
  | 'WAITING_FOR_TRUCK'
  | 'WEATHER'
  | 'EQUIPMENT_ISSUE'
  | 'BREAK'
  | 'MATERIAL_UNAVAILABLE'
  | 'OTHER';

export interface PauseTaskPayload {
  reason: PauseReason | string;
  note?: string;
}

export interface Task {
  task_id: string;
  task_type: string;
  status: TaskStatus;
  planned_minutes: number;
  predicted_minutes?: number | null;
  progress?: number;
  weather?: string;
  operator_skill?: string;
  machine_age?: number;
  prediction_status?: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'UNAVAILABLE' | string;
  prediction_basis?: string;
  pause_reason?: string;
  pause_note?: string;
}

export interface TelemetrySnapshot {
  engine_hours: number;
  fuel_used: number;
  load_cycles: number;
  idle_minutes: number;
  seatbelt_status: string;
  machine_active?: boolean;
}

export interface DashboardResponse {
  operator: Operator;
  machine: Machine;
  current_task: Task | null;
  telemetry: TelemetrySnapshot;
  active_alert_count: number;
  open_request_count: number;
}

export type IncidentCategory = 'SAFETY' | 'PRODUCTIVITY' | 'TASK' | 'SYSTEM' | string;
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
export type IncidentStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | string;

export interface Incident {
  id: string | number;
  incident_type?: string;
  type?: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  message: string;
  machine_id: string;
  task_id?: string;
  status: IncidentStatus;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  evidence?: Record<string, unknown> | Array<{ key?: string; label?: string; value: unknown }> | unknown;
}

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
}

// ---------------------------------------------------------------------------
// Phase 3 Types: Prediction, Usage Insights, and Support Requests
// ---------------------------------------------------------------------------

export interface TaskPrediction {
  predicted_minutes: number | null;
  baseline_estimate: number;
  difference_minutes: number | null;
  prediction_status: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'UNAVAILABLE' | string;
  model: string;
  data_basis: string;
}

export interface TaskPredictionPayload {
  task_type: string;
  weather: string;
  operator_skill: string;
  machine_age: number;
  baseline_estimate: number;
}

export interface UsageInsight {
  type: string;
  category: string;
  severity: string;
  message: string;
  evidence: Record<string, any>;
}

export interface UsageInsightsResponse {
  machine_id: string;
  generated_at: string;
  insights: UsageInsight[];
}

export type SupportRequestType =
  | 'LOGISTICS'
  | 'MAINTENANCE'
  | 'MATERIAL'
  | 'SUPERVISOR_ASSISTANCE';

export type SupportRequestStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED';

export interface SupportRequestEvent {
  id: number;
  request_id: string;
  actor_id: string;
  event_type: 'CREATED' | 'ACKNOWLEDGED' | 'RESPONDED' | 'RESOLVED' | string;
  message?: string;
  created_at: string;
}

export interface SupportRequest {
  id: string;
  operator_id: string;
  machine_id: string;
  task_id?: string;
  request_type: SupportRequestType;
  message: string;
  status: SupportRequestStatus;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  latest_response?: string;
  events: SupportRequestEvent[];
}

export interface CreateSupportRequestPayload {
  request_type: SupportRequestType;
  task_id?: string;
  message: string;
}
