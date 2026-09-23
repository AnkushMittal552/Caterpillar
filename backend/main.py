from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import (
    User,
    Machine,
    Task,
    TelemetryRecord,
    Incident,
    TaskPauseEvent,
    SupportRequest,
    SupportRequestEvent,
    TrainingAttempt,
    AuditEvent,
    Notification,
    utc_now,
)
from schemas import (
    HealthResponse,
    DashboardResponse,
    TaskSchema,
    PauseTaskRequest,
    IncidentSchema,
    DemoTelemetryUpdate,
    TaskPredictionRequest,
    TaskPredictionResponse,
    UsageInsightsResponse,
    CreateSupportRequestPayload,
    RespondSupportRequestPayload,
    SupportRequestSchema,
    SupportRequestEventSchema,
    AssistantMessageRequest,
    AssistantMessageResponse,
    TrainingModuleSchema,
    TrainingModuleDetailSchema,
    TrainingRecommendation,
    TrainingSubmitRequest,
    TrainingSubmitResponse,
    ShiftHandoverResponse,
    AuditEventSchema,
    NotificationSchema,
    NotificationReadResponse,
    NotificationReadAllResponse,
    DemoScenarioResponse,
    DemoResetResponse,
    KPISummaryResponse,
)
from seed import seed_data
from services.alert_engine import alert_engine, parse_incident
from services.prediction_service import prediction_service
from services.usage_insights import usage_insights_service
from services.assistant_service import assistant_service
from services.training_service import training_service
from services.handover_service import handover_service
from services.event_bus import event_bus
from services.audit_service import record_audit_event, list_audit_events
from services.notification_service import create_notification, list_notifications, mark_as_read, mark_all_read
import services.demo_service as demo_service



# Ensure database tables exist at module load
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables are created, migrations executed, and initial seed data loaded
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


app = FastAPI(
    title="ShiftMate API",
    description="Caterpillar Smart Operator Assistant - Phase 4 Backend",
    version="4.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend development
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Phase 5: Role Enforcement Helpers
# ---------------------------------------------------------------------------


def get_current_role(
    x_role: Optional[str] = Header(None),
    role: Optional[str] = Query(None),
) -> str:
    """Extract role from X-Role header or ?role= query param (default: OPERATOR)."""
    raw_role = x_role or role or "OPERATOR"
    return raw_role.upper().strip()


def require_role(allowed_roles: List[str]):
    """Enforces caller role, returning 403 Forbidden with descriptive detail if unauthorized."""
    def _role_checker(current_role: str = Depends(get_current_role)):
        normalized_allowed = [ar.upper().strip() for ar in allowed_roles]
        if current_role not in normalized_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action requires one of roles {allowed_roles}, but caller has role '{current_role}'.",
            )
        return current_role
    return _role_checker


def require_supervisor_role(
    x_role: Optional[str] = Header(None),
    role: Optional[str] = Query(None),
) -> str:
    """
    Supervisor role enforcement:
    - If X-Role or role param is explicitly provided and is not SUPERVISOR (e.g. OPERATOR),
      raise 403 Forbidden.
    - If caller is explicitly SUPERVISOR, allow.
    - If no role is specified (default supervisor route access for backward compatibility), allow as SUPERVISOR.
    """
    raw_role = x_role or role
    if raw_role:
        normalized = raw_role.upper().strip()
        if normalized != "SUPERVISOR":
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action requires role 'SUPERVISOR', but caller has role '{normalized}'.",
            )
        return normalized
    return "SUPERVISOR"


# ---------------------------------------------------------------------------
# Phase 5: Real-Time WebSocket Endpoint
# ---------------------------------------------------------------------------


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time push gateway. Pushes TASK_UPDATED, INCIDENT_CREATED, INCIDENT_UPDATED,
    REQUEST_CREATED, REQUEST_UPDATED, TRAINING_UPDATED, TELEMETRY_UPDATED, NOTIFICATION_CREATED.
    """
    await event_bus.connect(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await event_bus.disconnect(websocket)
    except Exception:
        await event_bus.disconnect(websocket)


@app.get("/health", response_model=HealthResponse)
def get_health():
    return {
        "status": "ok",
        "service": "shiftmate",
    }


@app.get("/api/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    operator = db.query(User).filter(User.id == "OP1001").first()
    if not operator:
        operator = db.query(User).first()
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")

    machine = db.query(Machine).filter(Machine.id == "EXC001").first()
    if not machine:
        machine = db.query(Machine).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    current_task = db.query(Task).filter(Task.status == "IN_PROGRESS").first()

    telemetry = (
        db.query(TelemetryRecord)
        .filter(TelemetryRecord.machine_id == machine.id)
        .order_by(TelemetryRecord.id.desc())
        .first()
    )

    if not telemetry:
        raise HTTPException(status_code=404, detail="Telemetry not found")

    # Evaluate alerts to ensure active alert count matches current facts
    unresolved_incidents = alert_engine.evaluate_machine_alerts(
        db,
        machine.id,
        current_telemetry=telemetry,
        current_task=current_task,
    )

    active_alert_count = len(unresolved_incidents)
    highest_priority_incident = parse_incident(unresolved_incidents[0]) if unresolved_incidents else None

    # Count real open support requests: OPEN, ACKNOWLEDGED, IN_PROGRESS
    open_request_count = (
        db.query(SupportRequest)
        .filter(
            SupportRequest.status.in_(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]),
            SupportRequest.resolved_at.is_(None),
        )
        .count()
    )

    return {
        "operator": {
            "id": operator.id,
        },
        "machine": {
            "id": machine.id,
            "status": machine.status,
            "engine_hours": machine.engine_hours,
        },
        "current_task": current_task,
        "telemetry": {
            "engine_hours": telemetry.engine_hours,
            "fuel_used": telemetry.fuel_used,
            "load_cycles": telemetry.load_cycles,
            "idle_minutes": telemetry.idle_minutes,
            "seatbelt_status": telemetry.seatbelt_status,
            "machine_active": telemetry.machine_active,
        },
        "active_alert_count": active_alert_count,
        "open_request_count": open_request_count,
        "highest_priority_incident": highest_priority_incident,
    }


# ---------------------------------------------------------------------------
# Task Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/tasks", response_model=List[TaskSchema])
def get_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    return tasks


@app.post("/api/tasks/{task_id}/start", response_model=TaskSchema)
def start_task(
    task_id: str,
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start task from status '{task.status}'. Task must be PENDING.",
        )

    task.status = "IN_PROGRESS"
    db.commit()
    db.refresh(task)

    record_audit_event(
        db,
        actor_id="OP1001",
        actor_role=current_role,
        action="TASK_STARTED",
        entity_type="TASK",
        entity_id=task.task_id,
        details={"task_type": task.task_type},
    )
    event_bus.broadcast_sync("TASK_UPDATED", {"task_id": task.task_id, "status": task.status})

    return task


@app.post("/api/tasks/{task_id}/pause", response_model=TaskSchema)
def pause_task(
    task_id: str,
    req: PauseTaskRequest,
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pause task from status '{task.status}'. Task must be IN_PROGRESS.",
        )

    task.status = "PAUSED"

    pause_event = TaskPauseEvent(
        task_id=task.task_id,
        reason=req.reason.value,
        note=req.note or "",
        paused_at=utc_now(),
    )
    db.add(pause_event)

    db.commit()
    db.refresh(task)

    record_audit_event(
        db,
        actor_id="OP1001",
        actor_role=current_role,
        action="TASK_PAUSED",
        entity_type="TASK",
        entity_id=task.task_id,
        details={"reason": req.reason.value, "note": req.note},
    )
    create_notification(
        db,
        category="TASK",
        priority="MEDIUM",
        title=f"Task {task.task_id} Paused",
        message=f"{task.task_type} paused: {req.reason.value}" + (f' ("{req.note}")' if req.note else ""),
        reference_type="task",
        reference_id=task.task_id,
    )
    event_bus.broadcast_sync("TASK_UPDATED", {"task_id": task.task_id, "status": task.status})

    return task


@app.post("/api/tasks/{task_id}/resume", response_model=TaskSchema)
def resume_task(
    task_id: str,
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != "PAUSED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resume task from status '{task.status}'. Task must be PAUSED.",
        )

    task.status = "IN_PROGRESS"

    # Close latest open pause event
    latest_pause = (
        db.query(TaskPauseEvent)
        .filter(TaskPauseEvent.task_id == task.task_id, TaskPauseEvent.resumed_at.is_(None))
        .order_by(TaskPauseEvent.id.desc())
        .first()
    )
    if latest_pause:
        latest_pause.resumed_at = utc_now()

    db.commit()
    db.refresh(task)

    record_audit_event(
        db,
        actor_id="OP1001",
        actor_role=current_role,
        action="TASK_RESUMED",
        entity_type="TASK",
        entity_id=task.task_id,
        details={"task_type": task.task_type},
    )
    event_bus.broadcast_sync("TASK_UPDATED", {"task_id": task.task_id, "status": task.status})

    return task


@app.post("/api/tasks/{task_id}/complete", response_model=TaskSchema)
def complete_task(
    task_id: str,
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status not in ["IN_PROGRESS", "PAUSED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete task from status '{task.status}'. Task must be IN_PROGRESS or PAUSED.",
        )

    # Close any open pause event if completing from paused
    if task.status == "PAUSED":
        latest_pause = (
            db.query(TaskPauseEvent)
            .filter(TaskPauseEvent.task_id == task.task_id, TaskPauseEvent.resumed_at.is_(None))
            .order_by(TaskPauseEvent.id.desc())
            .first()
        )
        if latest_pause:
            latest_pause.resumed_at = utc_now()

    task.status = "COMPLETED"
    task.progress = 100
    db.commit()
    db.refresh(task)

    record_audit_event(
        db,
        actor_id="OP1001",
        actor_role=current_role,
        action="TASK_COMPLETED",
        entity_type="TASK",
        entity_id=task.task_id,
        details={"task_type": task.task_type},
    )
    create_notification(
        db,
        category="TASK",
        priority="INFO",
        title=f"Task {task.task_id} Completed",
        message=f"{task.task_type} marked completed.",
        reference_type="task",
        reference_id=task.task_id,
    )
    event_bus.broadcast_sync("TASK_UPDATED", {"task_id": task.task_id, "status": task.status})

    return task


# ---------------------------------------------------------------------------
# Incident Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/incidents", response_model=List[IncidentSchema])
def get_incidents(status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status.upper())

    incidents = query.order_by(Incident.id.desc()).all()
    return [parse_incident(inc) for inc in incidents]


@app.post("/api/incidents/{incident_id}/acknowledge", response_model=IncidentSchema)
def acknowledge_incident(
    incident_id: int,
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if incident.status == "ACTIVE":
        incident.status = "ACKNOWLEDGED"
        incident.acknowledged_at = utc_now()
        incident.updated_at = utc_now()
        db.commit()
        db.refresh(incident)

        record_audit_event(
            db,
            actor_id="OP1001",
            actor_role=current_role,
            action="INCIDENT_ACKNOWLEDGED",
            entity_type="INCIDENT",
            entity_id=str(incident.id),
            details={"title": incident.title, "severity": incident.severity},
        )
        event_bus.broadcast_sync("INCIDENT_UPDATED", {"incident_id": incident.id, "status": "ACKNOWLEDGED"})

    return parse_incident(incident)


# ---------------------------------------------------------------------------
# Demo Telemetry Control Endpoint
# ---------------------------------------------------------------------------


@app.post("/api/demo/telemetry")
def update_demo_telemetry(payload: DemoTelemetryUpdate, db: Session = Depends(get_db)):
    telemetry = (
        db.query(TelemetryRecord)
        .filter(TelemetryRecord.machine_id == "EXC001")
        .order_by(TelemetryRecord.id.desc())
        .first()
    )

    if not telemetry:
        telemetry = TelemetryRecord(
            machine_id="EXC001",
            operator_id="OP1001",
            engine_hours=1524.8,
            fuel_used=3.8,
            load_cycles=2,
            idle_minutes=55,
            seatbelt_status="Unfastened",
            machine_active=True,
            source="DEMO_CONTROL",
        )
        db.add(telemetry)

    # Update only fields provided
    if payload.seatbelt_status is not None:
        telemetry.seatbelt_status = payload.seatbelt_status
    if payload.idle_minutes is not None:
        telemetry.idle_minutes = payload.idle_minutes
    if payload.machine_active is not None:
        telemetry.machine_active = payload.machine_active
    if payload.fuel_used is not None:
        telemetry.fuel_used = payload.fuel_used
    if payload.load_cycles is not None:
        telemetry.load_cycles = payload.load_cycles
    if payload.engine_hours is not None:
        telemetry.engine_hours = payload.engine_hours

    db.commit()
    db.refresh(telemetry)

    # Evaluate alerts with updated telemetry
    unresolved_incidents = alert_engine.evaluate_machine_alerts(db, "EXC001", current_telemetry=telemetry)

    return {
        "telemetry": {
            "engine_hours": telemetry.engine_hours,
            "fuel_used": telemetry.fuel_used,
            "load_cycles": telemetry.load_cycles,
            "idle_minutes": telemetry.idle_minutes,
            "seatbelt_status": telemetry.seatbelt_status,
            "machine_active": telemetry.machine_active,
        },
        "incidents": [parse_incident(inc) for inc in unresolved_incidents],
    }


# ---------------------------------------------------------------------------
# Phase 3: Task-Time Prediction Endpoint
# ---------------------------------------------------------------------------


@app.post("/api/predict/task-time", response_model=TaskPredictionResponse)
def predict_task_time(payload: TaskPredictionRequest):
    result = prediction_service.predict(
        task_type=payload.task_type,
        weather=payload.weather,
        operator_skill=payload.operator_skill,
        machine_age=payload.machine_age,
        baseline_estimate=payload.baseline_estimate,
    )
    return result


# ---------------------------------------------------------------------------
# Phase 3: Usage Insights Endpoint
# ---------------------------------------------------------------------------


@app.get("/api/usage-insights", response_model=UsageInsightsResponse)
def get_usage_insights(machine_id: str = "EXC001", db: Session = Depends(get_db)):
    result = usage_insights_service.analyze_machine_usage(db, machine_id=machine_id)
    return result


# ---------------------------------------------------------------------------
# Phase 3: Operator-Supervisor Support Request Endpoints
# ---------------------------------------------------------------------------


def serialize_support_request(req: SupportRequest, db: Session) -> dict:
    events = (
        db.query(SupportRequestEvent)
        .filter(SupportRequestEvent.request_id == req.id)
        .order_by(SupportRequestEvent.created_at.asc())
        .all()
    )

    # Find latest supervisor response message if any
    latest_response = None
    for ev in reversed(events):
        if ev.event_type == "RESPONDED" and ev.message:
            latest_response = ev.message
            break

    return {
        "id": req.id,
        "operator_id": req.operator_id,
        "machine_id": req.machine_id,
        "task_id": req.task_id,
        "request_type": req.request_type,
        "message": req.message,
        "status": req.status,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
        "acknowledged_at": req.acknowledged_at,
        "resolved_at": req.resolved_at,
        "latest_response": latest_response,
        "events": events,
    }


@app.post("/api/support-requests", response_model=SupportRequestSchema)
def create_support_request(
    payload: CreateSupportRequestPayload,
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    # Determine next request ID format: R001, R002, etc.
    count = db.query(SupportRequest).count()
    new_id = f"R{count + 1:03d}"

    # Ensure unique ID in case of prior deletions
    while db.query(SupportRequest).filter(SupportRequest.id == new_id).first():
        count += 1
        new_id = f"R{count + 1:03d}"

    req_type_str = payload.request_type.value if hasattr(payload.request_type, "value") else str(payload.request_type)

    req = SupportRequest(
        id=new_id,
        operator_id="OP1001",
        machine_id="EXC001",
        task_id=payload.task_id,
        request_type=req_type_str,
        message=payload.message,
        status="OPEN",
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(req)

    event = SupportRequestEvent(
        request_id=new_id,
        actor_id="OP1001",
        event_type="CREATED",
        message=payload.message,
        created_at=utc_now(),
    )
    db.add(event)

    db.commit()
    db.refresh(req)

    record_audit_event(
        db,
        actor_id="OP1001",
        actor_role=current_role,
        action="REQUEST_CREATED",
        entity_type="SUPPORT_REQUEST",
        entity_id=new_id,
        details={"request_type": req_type_str, "message": payload.message},
    )
    create_notification(
        db,
        category="SUPPORT",
        priority="HIGH",
        title=f"Support Request {new_id} Submitted",
        message=f"{req_type_str}: {payload.message}",
        reference_type="support_request",
        reference_id=new_id,
    )
    event_bus.broadcast_sync("REQUEST_CREATED", {"id": new_id, "status": "OPEN"})

    return serialize_support_request(req, db)


@app.get("/api/support-requests", response_model=List[SupportRequestSchema])
def list_support_requests(
    status: Optional[str] = Query(None),
    operator_id: Optional[str] = Query(None),
    machine_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(SupportRequest)

    if status:
        query = query.filter(SupportRequest.status == status.upper())
    if operator_id:
        query = query.filter(SupportRequest.operator_id == operator_id)
    if machine_id:
        query = query.filter(SupportRequest.machine_id == machine_id)

    requests = query.order_by(SupportRequest.created_at.desc()).all()
    return [serialize_support_request(r, db) for r in requests]


@app.post("/api/support-requests/{request_id}/acknowledge", response_model=SupportRequestSchema)
def acknowledge_support_request(
    request_id: str,
    current_role: str = Depends(require_supervisor_role),
    db: Session = Depends(get_db),
):
    req = db.query(SupportRequest).filter(SupportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Support request not found")

    if req.status == "RESOLVED":
        raise HTTPException(status_code=400, detail="Cannot acknowledge a resolved request")

    if req.status == "OPEN":
        req.status = "ACKNOWLEDGED"
        req.acknowledged_at = utc_now()
        req.updated_at = utc_now()

        event = SupportRequestEvent(
            request_id=req.id,
            actor_id="SUP001",
            event_type="ACKNOWLEDGED",
            message="Supervisor acknowledged request.",
            created_at=utc_now(),
        )
        db.add(event)
        db.commit()
        db.refresh(req)

        record_audit_event(
            db,
            actor_id="SUP001",
            actor_role="SUPERVISOR",
            action="REQUEST_ACKNOWLEDGED",
            entity_type="SUPPORT_REQUEST",
            entity_id=req.id,
        )
        event_bus.broadcast_sync("REQUEST_UPDATED", {"id": req.id, "status": req.status})

    return serialize_support_request(req, db)


@app.post("/api/support-requests/{request_id}/respond", response_model=SupportRequestSchema)
def respond_support_request(
    request_id: str,
    payload: RespondSupportRequestPayload,
    current_role: str = Depends(require_supervisor_role),
    db: Session = Depends(get_db),
):
    req = db.query(SupportRequest).filter(SupportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Support request not found")

    if req.status == "RESOLVED":
        raise HTTPException(status_code=400, detail="Cannot respond to a resolved request")

    # Transition to IN_PROGRESS upon supervisor response
    req.status = "IN_PROGRESS"
    req.updated_at = utc_now()

    event = SupportRequestEvent(
        request_id=req.id,
        actor_id="SUP001",
        event_type="RESPONDED",
        message=payload.message,
        created_at=utc_now(),
    )
    db.add(event)
    db.commit()
    db.refresh(req)

    record_audit_event(
        db,
        actor_id="SUP001",
        actor_role="SUPERVISOR",
        action="REQUEST_RESPONDED",
        entity_type="SUPPORT_REQUEST",
        entity_id=req.id,
        details={"message": payload.message},
    )
    create_notification(
        db,
        category="SUPPORT",
        priority="MEDIUM",
        title=f"Supervisor Responded to {req.id}",
        message=f'Supervisor response: "{payload.message}"',
        reference_type="support_request",
        reference_id=req.id,
    )
    event_bus.broadcast_sync("REQUEST_UPDATED", {"id": req.id, "status": req.status, "latest_response": payload.message})

    return serialize_support_request(req, db)


@app.post("/api/support-requests/{request_id}/resolve", response_model=SupportRequestSchema)
def resolve_support_request(
    request_id: str,
    current_role: str = Depends(require_supervisor_role),
    db: Session = Depends(get_db),
):
    req = db.query(SupportRequest).filter(SupportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Support request not found")

    if req.status == "RESOLVED":
        # Idempotent return
        return serialize_support_request(req, db)

    req.status = "RESOLVED"
    req.resolved_at = utc_now()
    req.updated_at = utc_now()

    event = SupportRequestEvent(
        request_id=req.id,
        actor_id="SUP001",
        event_type="RESOLVED",
        message="Supervisor marked request resolved.",
        created_at=utc_now(),
    )
    db.add(event)
    db.commit()
    db.refresh(req)

    record_audit_event(
        db,
        actor_id="SUP001",
        actor_role="SUPERVISOR",
        action="REQUEST_RESOLVED",
        entity_type="SUPPORT_REQUEST",
        entity_id=req.id,
    )
    create_notification(
        db,
        category="SUPPORT",
        priority="INFO",
        title=f"Support Request {req.id} Resolved",
        message="Supervisor marked ticket resolved.",
        reference_type="support_request",
        reference_id=req.id,
    )
    event_bus.broadcast_sync("REQUEST_UPDATED", {"id": req.id, "status": "RESOLVED"})

    return serialize_support_request(req, db)


# ---------------------------------------------------------------------------
# Phase 4 Routes: Grounded AI Assistant
# ---------------------------------------------------------------------------


@app.post("/api/assistant", response_model=AssistantMessageResponse)
def ask_assistant(
    payload: AssistantMessageRequest,
    db: Session = Depends(get_db),
):
    """
    State-grounded AI operator assistant.
    Answers operator questions using controlled backend queries,
    proposes action workflows requiring explicit confirmation,
    and defaults to deterministic fallback answers when external LLMs are unavailable.
    """
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    return assistant_service.ask(db, payload.message.strip())


# ---------------------------------------------------------------------------
# Phase 4 Routes: Contextual Training Hub & Quizzes
# ---------------------------------------------------------------------------


@app.get("/api/training", response_model=List[TrainingModuleSchema])
def list_training_modules(
    operator_id: str = Query("OP1001"),
    db: Session = Depends(get_db),
):
    """List available training modules with completion status for the operator."""
    return training_service.get_modules(db, operator_id=operator_id)


@app.get("/api/training/recommendations", response_model=List[TrainingRecommendation])
def list_training_recommendations(
    operator_id: str = Query("OP1001"),
    db: Session = Depends(get_db),
):
    """Return deterministic training recommendations triggered by current shift events."""
    return training_service.get_recommendations(db, operator_id=operator_id)


@app.get("/api/training/{module_id}", response_model=TrainingModuleDetailSchema)
def get_training_module_detail(
    module_id: str,
    operator_id: str = Query("OP1001"),
    db: Session = Depends(get_db),
):
    """Get training module educational content and quiz questions."""
    detail = training_service.get_module_detail(db, module_id, operator_id=operator_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Training module not found")
    return detail


@app.post("/api/training/{module_id}/submit", response_model=TrainingSubmitResponse)
def submit_training_quiz(
    module_id: str,
    payload: TrainingSubmitRequest,
    operator_id: str = Query("OP1001"),
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    """Evaluate training quiz answers, calculate authoritative score, and persist completion."""
    try:
        result = training_service.submit_quiz(db, module_id, operator_id=operator_id, answers=payload.answers)
        if result.completed:
            record_audit_event(
                db,
                actor_id=operator_id,
                actor_role=current_role,
                action="TRAINING_COMPLETED",
                entity_type="TRAINING",
                entity_id=module_id,
                details={"score": result.score, "total": result.total},
            )
            create_notification(
                db,
                category="TRAINING",
                priority="INFO",
                title="Training Module Completed",
                message=f"Operator completed {module_id} with score {result.score}/{result.total}.",
                reference_type="training",
                reference_id=module_id,
            )
            event_bus.broadcast_sync("TRAINING_UPDATED", {"module_id": module_id, "score": result.score})

        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Phase 4 Routes: Automatic Shift Handover
# ---------------------------------------------------------------------------


@app.get("/api/handover", response_model=ShiftHandoverResponse)
def get_shift_handover(
    machine_id: str = Query("EXC001"),
    operator_id: str = Query("OP1001"),
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    """Generate comprehensive, factual shift handover facts and summary from database records."""
    record_audit_event(
        db,
        actor_id=operator_id,
        actor_role=current_role,
        action="HANDOVER_GENERATED",
        entity_type="HANDOVER",
        entity_id=machine_id,
    )
    return handover_service.get_handover_report(db, machine_id=machine_id, operator_id=operator_id)


# ---------------------------------------------------------------------------
# Phase 5 Routes: Audit Trail API
# ---------------------------------------------------------------------------


@app.get("/api/audit", response_model=List[AuditEventSchema])
def get_audit_trail(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    limit: int = Query(100),
    current_role: str = Depends(get_current_role),
    db: Session = Depends(get_db),
):
    """
    Query audit trail with role scoping:
    - SUPERVISOR: sees system-wide audit history.
    - OPERATOR: scoped to own actions and task/incident entities.
    """
    return list_audit_events(
        db,
        actor_role=current_role,
        current_actor_id="OP1001",
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Phase 5 Routes: Unified Notification Center
# ---------------------------------------------------------------------------


@app.get("/api/notifications", response_model=List[NotificationSchema])
def get_notifications(
    unread_only: bool = Query(False),
    category: Optional[str] = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    """Retrieve operational notifications across safety, tasks, dispatch, and training."""
    return list_notifications(db, unread_only=unread_only, category=category, limit=limit)


@app.post("/api/notifications/{notification_id}/read", response_model=NotificationReadResponse)
def read_notification(notification_id: str, db: Session = Depends(get_db)):
    """Mark a notification as read."""
    notif = mark_as_read(db, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"id": notif.id, "read": True}


@app.post("/api/notifications/read-all", response_model=NotificationReadAllResponse)
def read_all_notifications_endpoint(db: Session = Depends(get_db)):
    """Mark all unread notifications as read."""
    count = mark_all_read(db)
    return {"marked_count": count}


# ---------------------------------------------------------------------------
# Phase 5 Routes: Demo Scenario Controller & Deterministic Reset
# ---------------------------------------------------------------------------


@app.post("/api/demo/scenario/{scenario_name}", response_model=DemoScenarioResponse)
def trigger_demo_scenario(scenario_name: str, db: Session = Depends(get_db)):
    """
    Simulate a realistic operational scenario by injecting telemetry/task conditions
    and running live system engines (alert engine, notifications, WebSocket broadcasts).
    """
    try:
        return demo_service.apply_scenario(db, scenario_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/demo/reset", response_model=DemoResetResponse)
def reset_demo_state(db: Session = Depends(get_db)):
    """
    Deterministically reset all demo state (tasks, telemetry, incidents, requests)
    to standard starting baseline without deleting database schema.
    """
    return demo_service.reset_demo(db)


# ---------------------------------------------------------------------------
# Phase 5 Routes: Shift KPI Summary
# ---------------------------------------------------------------------------


@app.get("/api/kpi/summary", response_model=KPISummaryResponse)
def get_kpi_summary(
    machine_id: str = Query("EXC001"),
    operator_id: str = Query("OP1001"),
    db: Session = Depends(get_db),
):
    """
    Return strictly factual shift KPIs computed from live database records.
    No unverified claims (e.g., fuel saved or accident prevention %).
    """
    all_tasks = db.query(Task).all()
    tasks_completed = sum(1 for t in all_tasks if t.status == "COMPLETED")
    tasks_remaining = sum(1 for t in all_tasks if t.status in ["PENDING", "IN_PROGRESS", "PAUSED"])
    tasks_at_risk = sum(1 for t in all_tasks if t.prediction_status in ["AT_RISK", "DELAYED"])

    telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == machine_id).first()
    recorded_idle = float(telemetry.idle_minutes) if telemetry else 0.0

    unresolved_incidents = db.query(Incident).filter(
        Incident.machine_id == machine_id,
        Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"])
    ).count()

    requests = db.query(SupportRequest).all()
    support_requests_open = sum(1 for r in requests if r.status != "RESOLVED")
    support_requests_resolved = sum(1 for r in requests if r.status == "RESOLVED")

    training_completed = db.query(TrainingAttempt).filter(
        TrainingAttempt.operator_id == operator_id,
        TrainingAttempt.completed == True
    ).count()

    return {
        "tasks_completed": tasks_completed,
        "tasks_remaining": tasks_remaining,
        "tasks_at_risk": tasks_at_risk,
        "recorded_idle_minutes": recorded_idle,
        "unresolved_incidents": unresolved_incidents,
        "support_requests_open": support_requests_open,
        "support_requests_resolved": support_requests_resolved,
        "training_modules_completed": training_completed,
    }


