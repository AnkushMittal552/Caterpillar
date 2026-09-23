from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
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
)
from seed import seed_data
from services.alert_engine import alert_engine, parse_incident
from services.prediction_service import prediction_service
from services.usage_insights import usage_insights_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables are created, migrations executed, and initial seed data loaded
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


app = FastAPI(
    title="ShiftMate API",
    description="Caterpillar Smart Operator Assistant - Phase 3 Backend",
    version="3.0.0",
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
def start_task(task_id: str, db: Session = Depends(get_db)):
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
    return task


@app.post("/api/tasks/{task_id}/pause", response_model=TaskSchema)
def pause_task(task_id: str, req: PauseTaskRequest, db: Session = Depends(get_db)):
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
    return task


@app.post("/api/tasks/{task_id}/resume", response_model=TaskSchema)
def resume_task(task_id: str, db: Session = Depends(get_db)):
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
    return task


@app.post("/api/tasks/{task_id}/complete", response_model=TaskSchema)
def complete_task(task_id: str, db: Session = Depends(get_db)):
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
def acknowledge_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if incident.status == "ACTIVE":
        incident.status = "ACKNOWLEDGED"
        incident.acknowledged_at = utc_now()
        incident.updated_at = utc_now()
        db.commit()
        db.refresh(incident)

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
    db: Session = Depends(get_db),
):
    # Determine next request ID format: R001, R002, etc.
    count = db.query(SupportRequest).count()
    new_id = f"R{count + 1:03d}"

    # Ensure unique ID in case of prior deletions
    while db.query(SupportRequest).filter(SupportRequest.id == new_id).first():
        count += 1
        new_id = f"R{count + 1:03d}"

    req = SupportRequest(
        id=new_id,
        operator_id="OP1001",
        machine_id="EXC001",
        task_id=payload.task_id,
        request_type=payload.request_type.value,
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
def acknowledge_support_request(request_id: str, db: Session = Depends(get_db)):
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

    return serialize_support_request(req, db)


@app.post("/api/support-requests/{request_id}/respond", response_model=SupportRequestSchema)
def respond_support_request(
    request_id: str,
    payload: RespondSupportRequestPayload,
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

    return serialize_support_request(req, db)


@app.post("/api/support-requests/{request_id}/resolve", response_model=SupportRequestSchema)
def resolve_support_request(request_id: str, db: Session = Depends(get_db)):
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

    return serialize_support_request(req, db)
