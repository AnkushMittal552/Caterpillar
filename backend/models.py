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
    predicted_minutes = Column(Integer, nullable=True)
    progress = Column(Integer, nullable=False, default=0)


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
