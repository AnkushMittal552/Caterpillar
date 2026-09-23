import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from models import Incident, TelemetryRecord, Task


DEMO_IDLE_THRESHOLD_MINUTES = 45


def utc_now():
    return datetime.now(timezone.utc)


def parse_incident(inc: Incident) -> Dict[str, Any]:
    """Helper to convert Incident model to dict with parsed evidence JSON."""
    try:
        evidence = json.loads(inc.evidence_json) if inc.evidence_json else {}
    except Exception:
        evidence = {}

    return {
        "id": inc.id,
        "incident_type": inc.incident_type,
        "category": inc.category,
        "severity": inc.severity,
        "title": inc.title,
        "message": inc.message,
        "machine_id": inc.machine_id,
        "task_id": inc.task_id,
        "status": inc.status,
        "created_at": inc.created_at,
        "updated_at": inc.updated_at,
        "acknowledged_at": inc.acknowledged_at,
        "resolved_at": inc.resolved_at,
        "evidence": evidence,
    }


class AlertEngine:
    def __init__(self, idle_threshold_minutes: int = DEMO_IDLE_THRESHOLD_MINUTES):
        self.idle_threshold_minutes = idle_threshold_minutes

    def evaluate_machine_alerts(
        self,
        db: Session,
        machine_id: str,
        current_telemetry: Optional[TelemetryRecord] = None,
        current_task: Optional[Task] = None,
    ) -> List[Incident]:
        """
        Evaluate deterministic alert rules for a specific machine.
        Handles deduplication, creation, and resolution.
        """
        if current_telemetry is None:
            current_telemetry = (
                db.query(TelemetryRecord)
                .filter(TelemetryRecord.machine_id == machine_id)
                .order_by(TelemetryRecord.id.desc())
                .first()
            )

        if current_task is None:
            current_task = (
                db.query(Task)
                .filter(Task.status == "IN_PROGRESS")
                .first()
            )
        task_id = current_task.task_id if current_task else None

        # DATA SAFETY: If telemetry is missing entirely, DO NOT treat it as a safe state.
        # Missing telemetry / loss must NOT automatically resolve existing safety incidents.
        if current_telemetry is None:
            return db.query(Incident).filter(
                Incident.machine_id == machine_id,
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
                Incident.resolved_at.is_(None),
            ).all()

        evaluated_incidents = []

        # ----------------------------------------------------
        # Rule A: SEATBELT_EVENT
        # Condition: machine_active == True AND seatbelt_status == "Unfastened"
        # ----------------------------------------------------
        seatbelt_dedup_key = f"SEATBELT_EVENT:{machine_id}"
        existing_seatbelt_incident = (
            db.query(Incident)
            .filter(
                Incident.dedup_key == seatbelt_dedup_key,
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
                Incident.resolved_at.is_(None),
            )
            .first()
        )

        # DATA SAFETY: If machine_active is None or missing, do NOT infer safe state
        if current_telemetry.seatbelt_status is not None:
            if current_telemetry.machine_active is True and current_telemetry.seatbelt_status == "Unfastened":
                evidence = {
                    "seatbelt_status": "Unfastened",
                    "machine_active": True,
                }
                if existing_seatbelt_incident:
                    # Deduplication: Update existing active or acknowledged incident
                    existing_seatbelt_incident.evidence_json = json.dumps(evidence)
                    existing_seatbelt_incident.updated_at = utc_now()
                    evaluated_incidents.append(existing_seatbelt_incident)
                else:
                    # Create new incident
                    new_incident = Incident(
                        incident_type="SEATBELT_EVENT",
                        category="SAFETY",
                        severity="HIGH",
                        title="Seatbelt Unfastened",
                        message="Seatbelt reported unfastened while the demo machine-active condition is true.",
                        machine_id=machine_id,
                        task_id=task_id,
                        status="ACTIVE",
                        created_at=utc_now(),
                        updated_at=utc_now(),
                        evidence_json=json.dumps(evidence),
                        dedup_key=seatbelt_dedup_key,
                    )
                    db.add(new_incident)
                    evaluated_incidents.append(new_incident)
            elif current_telemetry.seatbelt_status == "Fastened" or current_telemetry.machine_active is False:
                # Condition has cleared explicitly (e.g. seatbelt Fastened or machine is explicitly confirmed inactive).
                # If machine_active is None, do NOT assume safe and do NOT resolve existing incident.
                if existing_seatbelt_incident:
                    existing_seatbelt_incident.status = "RESOLVED"
                    existing_seatbelt_incident.resolved_at = utc_now()
                    existing_seatbelt_incident.updated_at = utc_now()

        # ----------------------------------------------------
        # Rule B: HIGH_IDLE
        # Condition: idle_minutes > threshold
        # ----------------------------------------------------
        idle_dedup_key = f"HIGH_IDLE:{machine_id}"
        existing_idle_incident = (
            db.query(Incident)
            .filter(
                Incident.dedup_key == idle_dedup_key,
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
                Incident.resolved_at.is_(None),
            )
            .first()
        )

        if current_telemetry.idle_minutes is not None:
            if current_telemetry.idle_minutes > self.idle_threshold_minutes:
                evidence = {
                    "idle_minutes": current_telemetry.idle_minutes,
                    "demo_threshold_minutes": self.idle_threshold_minutes,
                    "load_cycles": current_telemetry.load_cycles,
                }
                if existing_idle_incident:
                    # Deduplication: Update existing active or acknowledged incident
                    existing_idle_incident.evidence_json = json.dumps(evidence)
                    existing_idle_incident.updated_at = utc_now()
                    evaluated_incidents.append(existing_idle_incident)
                else:
                    new_incident = Incident(
                        incident_type="HIGH_IDLE",
                        category="PRODUCTIVITY",
                        severity="MEDIUM",
                        title="High Idle Time",
                        message="High idling observed during the current measurement period.",
                        machine_id=machine_id,
                        task_id=task_id,
                        status="ACTIVE",
                        created_at=utc_now(),
                        updated_at=utc_now(),
                        evidence_json=json.dumps(evidence),
                        dedup_key=idle_dedup_key,
                    )
                    db.add(new_incident)
                    evaluated_incidents.append(new_incident)
            else:
                # Condition has cleared
                if existing_idle_incident:
                    existing_idle_incident.status = "RESOLVED"
                    existing_idle_incident.resolved_at = utc_now()
                    existing_idle_incident.updated_at = utc_now()

        # Note: Rule C (LOW_PRODUCTIVITY) and Rule D (TASK_DELAY) are deferred for Phase 2
        # because the current snapshot data lacks sliding observation windows and dynamic
        # progress time metrics.

        db.commit()

        # Return all unresolved incidents for this machine
        unresolved = (
            db.query(Incident)
            .filter(
                Incident.machine_id == machine_id,
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
                Incident.resolved_at.is_(None),
            )
            .order_by(Incident.id.desc())
            .all()
        )
        return unresolved


alert_engine = AlertEngine()
