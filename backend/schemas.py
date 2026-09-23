from datetime import datetime
from typing import Optional, Dict, Any, List, Union
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str
    service: str


class OperatorSchema(BaseModel):
    id: str

    model_config = ConfigDict(from_attributes=True)


class MachineSchema(BaseModel):
    id: str
    status: str
    engine_hours: float

    model_config = ConfigDict(from_attributes=True)


class TaskSchema(BaseModel):
    task_id: str
    task_type: str
    status: str
    planned_minutes: int
    predicted_minutes: Optional[float] = None
    progress: int = 0
    weather: Optional[str] = None
    operator_skill: Optional[str] = None
    machine_age: Optional[float] = None
    prediction_status: Optional[str] = None
    prediction_basis: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PauseReason(str, Enum):
    WAITING_FOR_TRUCK = "WAITING_FOR_TRUCK"
    WEATHER = "WEATHER"
    EQUIPMENT_ISSUE = "EQUIPMENT_ISSUE"
    BREAK = "BREAK"
    MATERIAL_UNAVAILABLE = "MATERIAL_UNAVAILABLE"
    OTHER = "OTHER"


class PauseTaskRequest(BaseModel):
    reason: PauseReason
    note: Optional[str] = ""


class TelemetrySchema(BaseModel):
    engine_hours: float
    fuel_used: float
    load_cycles: int
    idle_minutes: int
    seatbelt_status: str
    machine_active: Optional[bool] = True

    model_config = ConfigDict(from_attributes=True)


class IncidentSchema(BaseModel):
    id: int
    incident_type: str
    category: str
    severity: str
    title: str
    message: str
    machine_id: str
    task_id: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    evidence: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class DashboardResponse(BaseModel):
    operator: OperatorSchema
    machine: MachineSchema
    current_task: Optional[TaskSchema] = None
    telemetry: TelemetrySchema
    active_alert_count: int = 0
    open_request_count: int = 0
    highest_priority_incident: Optional[IncidentSchema] = None


class DemoTelemetryUpdate(BaseModel):
    seatbelt_status: Optional[str] = None
    idle_minutes: Optional[int] = None
    machine_active: Optional[bool] = None
    fuel_used: Optional[float] = None
    load_cycles: Optional[int] = None
    engine_hours: Optional[float] = None


# ---------------------------------------------------------------------------
# Phase 3 Schemas
# ---------------------------------------------------------------------------


class TaskPredictionRequest(BaseModel):
    task_type: str
    weather: str
    operator_skill: str
    machine_age: float
    baseline_estimate: float


class TaskPredictionResponse(BaseModel):
    predicted_minutes: Optional[float] = None
    baseline_estimate: float
    difference_minutes: Optional[float] = None
    prediction_status: str  # ON_TRACK, AT_RISK, DELAYED, UNAVAILABLE
    model: str = "random_forest_demo"
    data_basis: str = "synthetic_demonstration_history"


class UsageInsight(BaseModel):
    type: str
    category: str
    severity: str
    message: str
    evidence: Dict[str, Any] = Field(default_factory=dict)


class UsageInsightsResponse(BaseModel):
    machine_id: str
    generated_at: str
    insights: List[UsageInsight]


class SupportRequestType(str, Enum):
    LOGISTICS = "LOGISTICS"
    MAINTENANCE = "MAINTENANCE"
    MATERIAL = "MATERIAL"
    SUPERVISOR_ASSISTANCE = "SUPERVISOR_ASSISTANCE"
    TRUCK_DISPATCH = "TRUCK_DISPATCH"
    PARTS_DELIVERY = "PARTS_DELIVERY"
    MACHINE_INSPECTION = "MACHINE_INSPECTION"
    SAFETY_HAZARD = "SAFETY_HAZARD"


class CreateSupportRequestPayload(BaseModel):
    request_type: Union[SupportRequestType, str]
    task_id: Optional[str] = None
    message: str


class RespondSupportRequestPayload(BaseModel):
    message: str


class SupportRequestEventSchema(BaseModel):
    id: int
    request_id: str
    actor_id: str
    event_type: str
    message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportRequestSchema(BaseModel):
    id: str
    operator_id: str
    machine_id: str
    task_id: Optional[str] = None
    request_type: str
    message: str
    status: str
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    latest_response: Optional[str] = None
    events: List[SupportRequestEventSchema] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Phase 4 Schemas: Grounded Assistant, Training Hub, & Handover
# ---------------------------------------------------------------------------


class ReferenceItem(BaseModel):
    type: str  # task, incident, support_request, telemetry, insight, training
    id: str
    label: Optional[str] = None


class ProposedAction(BaseModel):
    type: str  # CREATE_SUPPORT_REQUEST
    requires_confirmation: bool = True
    payload: Dict[str, Any]


class AssistantMessageRequest(BaseModel):
    message: str


class AssistantMessageResponse(BaseModel):
    answer: str
    references: List[ReferenceItem] = Field(default_factory=list)
    proposed_action: Optional[ProposedAction] = None


class QuestionChoice(BaseModel):
    key: str  # "A", "B", "C", "D"
    text: str


class TrainingQuestionPublic(BaseModel):
    id: str
    module_id: str
    question: str
    choices: List[QuestionChoice]


class TrainingModuleSchema(BaseModel):
    id: str
    title: str
    description: str
    category: str
    estimated_minutes: int
    active: bool
    question_count: int = 0
    completed: bool = False
    last_score: Optional[int] = None
    total_questions: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class TrainingModuleDetailSchema(BaseModel):
    module: TrainingModuleSchema
    questions: List[TrainingQuestionPublic]


class TrainingRecommendation(BaseModel):
    module: TrainingModuleSchema
    reason: str
    trigger_event: Optional[str] = None


class TrainingSubmitRequest(BaseModel):
    answers: Dict[str, str]  # e.g., {"Q_SB_1": "B", "Q_SB_2": "A"}


class TrainingSubmitResponse(BaseModel):
    module_id: str
    score: int
    total: int
    completed: bool
    feedback: Optional[List[Dict[str, Any]]] = None


class ShiftHandoverTaskBreakdown(BaseModel):
    completed: List[TaskSchema] = Field(default_factory=list)
    unfinished: List[TaskSchema] = Field(default_factory=list)


class ShiftHandoverIncidentBreakdown(BaseModel):
    unresolved: List[IncidentSchema] = Field(default_factory=list)
    resolved: List[IncidentSchema] = Field(default_factory=list)


class ShiftHandoverRequestBreakdown(BaseModel):
    open: List[SupportRequestSchema] = Field(default_factory=list)
    resolved: List[SupportRequestSchema] = Field(default_factory=list)


class ShiftHandoverTrainingBreakdown(BaseModel):
    completed: List[Dict[str, Any]] = Field(default_factory=list)
    recommended: List[TrainingRecommendation] = Field(default_factory=list)


class ShiftHandoverResponse(BaseModel):
    shift: Dict[str, Any]
    tasks: ShiftHandoverTaskBreakdown
    delays: List[Dict[str, Any]] = Field(default_factory=list)
    incidents: ShiftHandoverIncidentBreakdown
    support_requests: ShiftHandoverRequestBreakdown
    training: ShiftHandoverTrainingBreakdown
    usage_insights: List[UsageInsight] = Field(default_factory=list)
    summary_text: str


# ---------------------------------------------------------------------------
# Phase 5 Schemas: Audit Trail, Notifications, Demo Controller, & KPIs
# ---------------------------------------------------------------------------


class AuditEventSchema(BaseModel):
    id: int
    actor_id: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: str
    timestamp: datetime
    details: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationSchema(BaseModel):
    id: str
    category: str
    priority: str
    title: str
    message: str
    created_at: datetime
    read: bool
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationReadResponse(BaseModel):
    id: str
    read: bool


class NotificationReadAllResponse(BaseModel):
    marked_count: int


class DemoScenarioResponse(BaseModel):
    scenario: str
    status: str
    message: Optional[str] = None
    incidents_count: Optional[int] = None
    request_id: Optional[str] = None
    task_id: Optional[str] = None


class DemoResetResponse(BaseModel):
    status: str
    operator: str
    machine: str
    current_task: str
    tasks_count: int
    telemetry: Dict[str, Any]
    message: str


class KPISummaryResponse(BaseModel):
    tasks_completed: int
    tasks_remaining: int
    tasks_at_risk: int
    recorded_idle_minutes: float
    unresolved_incidents: int
    support_requests_open: int
    support_requests_resolved: int
    training_modules_completed: int


