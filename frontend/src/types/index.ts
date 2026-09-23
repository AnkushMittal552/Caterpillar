export interface Operator {
  id: string;
  name?: string;
}

export interface Machine {
  id: string;
  status: string;
  engine_hours: number;
}

export interface Task {
  task_id: string;
  task_type: string;
  status: string;
  planned_minutes: number;
  predicted_minutes?: number;
  progress?: number;
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

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
}
