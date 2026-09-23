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
  predicted_minutes?: number;
  progress?: number;
  pause_reason?: string;
  pause_note?: string;
}

export interface TelemetrySnapshot {
  engine_hours: number;
  fuel_used: number;
  load_cycles: number;
  idle_minutes: number;
  seatbelt_status: string;
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
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' | string;
export type IncidentStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | string;

export interface Incident {
  id: string;
  type: string;
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
