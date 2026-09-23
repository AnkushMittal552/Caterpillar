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

// ---------------------------------------------------------------------------
// Phase 4 Types: Assistant, Training Hub, & Shift Handover
// ---------------------------------------------------------------------------

export interface ReferenceItem {
  type: 'task' | 'incident' | 'support_request' | 'training' | string;
  id: string;
  label?: string;
}

export interface ProposedAction {
  type: string;
  requires_confirmation: boolean;
  payload: {
    request_type: SupportRequestType;
    task_id?: string;
    message: string;
    [key: string]: any;
  };
}

export interface AssistantResponse {
  answer: string;
  references: ReferenceItem[];
  proposed_action?: ProposedAction | null;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  references?: ReferenceItem[];
  proposed_action?: ProposedAction | null;
  timestamp: string;
}

export interface QuestionChoice {
  key: string;
  text: string;
}

export interface TrainingQuestionPublic {
  id: string;
  module_id: string;
  question: string;
  choices: QuestionChoice[];
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: 'SAFETY' | 'PRODUCTIVITY' | string;
  estimated_minutes: number;
  active: boolean;
  question_count: number;
  completed: boolean;
  last_score?: number | null;
  total_questions?: number | null;
}

export interface TrainingModuleDetail {
  module: TrainingModule;
  questions: TrainingQuestionPublic[];
}

export interface TrainingRecommendation {
  module: TrainingModule;
  reason: string;
  trigger_event?: string;
}

export interface TrainingSubmitResponse {
  module_id: string;
  score: number;
  total: number;
  completed: boolean;
  feedback?: Array<{
    question_id: string;
    submitted: string;
    correct: boolean;
    explanation: string;
  }>;
}

export interface ShiftHandoverReport {
  shift: {
    shift_id: string;
    name: string;
    operator_id: string;
    operator_name?: string;
    machine_id: string;
    machine_status: string;
    engine_hours: number;
    [key: string]: any;
  };
  tasks: {
    completed: Task[];
    unfinished: Task[];
  };
  delays: Array<{
    task_id: string;
    task_type: string;
    status: string;
    pause_reason?: string;
    pause_note?: string;
    planned_minutes: number;
    predicted_minutes?: number;
    variance_minutes?: number;
    prediction_status?: string;
  }>;
  incidents: {
    unresolved: Incident[];
    resolved: Incident[];
  };
  support_requests: {
    open: SupportRequest[];
    resolved: SupportRequest[];
  };
  training: {
    completed: Array<{
      module_id: string;
      title: string;
      score: number;
      total: number;
      completed_at: string;
    }>;
    recommended: TrainingRecommendation[];
  };
  usage_insights: UsageInsight[];
  summary_text: string;
}

// ---------------------------------------------------------------------------
// Phase 5 Types: Real-Time, Roles, Audit Trail, Notifications & Demo
// ---------------------------------------------------------------------------

export type UserRole = 'OPERATOR' | 'SUPERVISOR';

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export interface AuditEvent {
  id: number;
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  details?: Record<string, unknown> | string | null;
}

export interface NotificationItem {
  id: string;
  category: 'SAFETY' | 'PRODUCTIVITY' | 'TASK' | 'SUPPORT' | 'TRAINING' | 'SYSTEM' | string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  reference_type?: string | null;
  reference_id?: string | null;
}

export interface KPISummary {
  shift_name: string;
  operator_id: string;
  machine_id: string;
  machine_status: string;
  engine_hours: number;
  fuel_used: number;
  load_cycles: number;
  idle_minutes: number;
  tasks_total: number;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_paused: number;
  tasks_pending: number;
  active_alerts_count: number;
  resolved_alerts_count: number;
  open_requests_count: number;
  resolved_requests_count: number;
  training_completed_count: number;
  training_recommended_count: number;
}

export interface DemoScenarioResponse {
  scenario: string;
  status: string;
  message: string;
  task_id?: string;
  request_id?: string;
  incidents_count?: number;
}

export interface DemoResetResponse {
  status: string;
  operator: string;
  machine: string;
  current_task: string;
  tasks_count: number;
  telemetry: {
    engine_hours: number;
    idle_minutes: number;
    seatbelt_status: string;
  };
  message: string;
}

