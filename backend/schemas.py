from datetime import datetime
from typing import Optional, Dict, Any, List
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
    predicted_minutes: Optional[int] = None
    progress: int = 0

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
