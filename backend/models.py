from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean
from database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    role = Column(String, nullable=False, default="OPERATOR")
    name = Column(String, nullable=True)


class Machine(Base):
    __tablename__ = "machines"

    id = Column(String, primary_key=True, index=True)
    status = Column(String, nullable=False, default="ACTIVE")
    engine_hours = Column(Float, nullable=False, default=0.0)


class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(String, primary_key=True, index=True)
    task_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="PENDING")
    planned_minutes = Column(Integer, nullable=False, default=0)
    predicted_minutes = Column(Float, nullable=True)
    progress = Column(Integer, nullable=False, default=0)

    # Phase 3 Fields for Task Prediction Details
    weather = Column(String, nullable=True)
    operator_skill = Column(String, nullable=True)
    machine_age = Column(Float, nullable=True)
    prediction_status = Column(String, nullable=True)  # ON_TRACK, AT_RISK, DELAYED, UNAVAILABLE
    prediction_basis = Column(String, nullable=True, default="synthetic_demonstration_history")


class TaskPauseEvent(Base):
    __tablename__ = "task_pause_events"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    task_id = Column(String, nullable=False, index=True)
    reason = Column(String, nullable=False)
    note = Column(String, nullable=True, default="")
    paused_at = Column(DateTime, default=utc_now, nullable=False)
    resumed_at = Column(DateTime, nullable=True)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    incident_type = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)  # SAFETY, PRODUCTIVITY, TASK, SYSTEM
    severity = Column(String, nullable=False)  # HIGH, MEDIUM, LOW, CRITICAL
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    machine_id = Column(String, nullable=False, index=True)
    task_id = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="ACTIVE", index=True)  # ACTIVE, ACKNOWLEDGED, RESOLVED
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    evidence_json = Column(String, nullable=False, default="{}")
    dedup_key = Column(String, nullable=False, index=True)


class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False)
    machine_id = Column(String, nullable=False, index=True)
    operator_id = Column(String, nullable=False, index=True)
    engine_hours = Column(Float, nullable=False)
    fuel_used = Column(Float, nullable=False)
    load_cycles = Column(Integer, nullable=False)
    idle_minutes = Column(Integer, nullable=False)
    seatbelt_status = Column(String, nullable=False)
    machine_active = Column(Boolean, default=True, nullable=True)
    source = Column(String, nullable=False, default="SUPPLIED_SAMPLE")


# ---------------------------------------------------------------------------
# Phase 3 Models: Support Request & Event Audit Trail
# ---------------------------------------------------------------------------


class SupportRequest(Base):
    __tablename__ = "support_requests"

    id = Column(String, primary_key=True, index=True)  # e.g., R001
    operator_id = Column(String, nullable=False, index=True)
    machine_id = Column(String, nullable=False, index=True)
    task_id = Column(String, nullable=True, index=True)
    request_type = Column(String, nullable=False)  # LOGISTICS, MAINTENANCE, MATERIAL, SUPERVISOR_ASSISTANCE
    message = Column(String, nullable=False)
    status = Column(String, nullable=False, default="OPEN", index=True)  # OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)


class SupportRequestEvent(Base):
    __tablename__ = "support_request_events"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    request_id = Column(String, nullable=False, index=True)
    actor_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)  # CREATED, ACKNOWLEDGED, RESPONDED, RESOLVED
    message = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


# ---------------------------------------------------------------------------
# Phase 4 Models: Training Modules, Questions, and Attempts
# ---------------------------------------------------------------------------


class TrainingModule(Base):
    __tablename__ = "training_modules"

    id = Column(String, primary_key=True, index=True)  # e.g., MOD_SEATBELT
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=False, default="SAFETY")  # SAFETY, PRODUCTIVITY
    estimated_minutes = Column(Integer, nullable=False, default=5)
    active = Column(Boolean, default=True, nullable=False)


class TrainingQuestion(Base):
    __tablename__ = "training_questions"

    id = Column(String, primary_key=True, index=True)  # e.g., Q_SB_1
    module_id = Column(String, nullable=False, index=True)
    question = Column(String, nullable=False)
    choices_json = Column(String, nullable=False)  # JSON array: [{"key": "A", "text": "..."}]
    correct_answer = Column(String, nullable=False)  # "A", "B", etc.
    explanation = Column(String, nullable=False)


class TrainingAttempt(Base):
    __tablename__ = "training_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    operator_id = Column(String, nullable=False, index=True)
    module_id = Column(String, nullable=False, index=True)
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    completed = Column(Boolean, default=True, nullable=False)
    completed_at = Column(DateTime, default=utc_now, nullable=False)

