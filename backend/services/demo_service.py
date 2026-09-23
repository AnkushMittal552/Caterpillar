"""
Demo Scenario Controller and Deterministic Reset Service.
Controls reproducible simulation scenarios by modifying backend state and running normal alert/workflow engines.
"""
from typing import Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import (
    Task,
    TelemetryRecord,
    Incident,
    TaskPauseEvent,
    SupportRequest,
    SupportRequestEvent,
    TrainingAttempt,
    Notification,
    AuditEvent,
    utc_now,
)
from services.alert_engine import alert_engine
from services.prediction_service import prediction_service
from services.audit_service import record_audit_event
from services.notification_service import create_notification
from services.event_bus import event_bus


def apply_scenario(db: Session, scenario_name: str) -> Dict[str, Any]:
    """
    Applies a named demo scenario by altering underlying database telemetry or tasks,
    then executes standard business logic engines (alerts, notifications, broadcast).
    """
    scenario = scenario_name.lower().strip()

    if scenario == "normal":
        # 1. Normal Operation: restore telemetry to nominal
        telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == "EXC001").order_by(TelemetryRecord.id.desc()).first()
        if telemetry:
            telemetry.seatbelt_status = "Fastened"
            telemetry.idle_minutes = 15
            telemetry.fuel_used = 3.8
            telemetry.machine_active = True
            telemetry.timestamp = utc_now()
            db.commit()

        # Run alert engine to resolve reversible incidents
        alert_engine.evaluate_machine_alerts(db, "EXC001")

        record_audit_event(
            db,
            actor_id="DEMO_CONTROLLER",
            actor_role="SUPERVISOR",
            action="DEMO_SCENARIO_APPLIED",
            entity_type="SYSTEM",
            entity_id="EXC001",
            details={"scenario": "normal", "description": "Restored nominal telemetry conditions"},
        )

        create_notification(
            db,
            category="SYSTEM",
            priority="INFO",
            title="Nominal Conditions Active",
            message="Machine EXC001 telemetry nominal. Seatbelt fastened, idle 15m.",
            reference_type="machine",
            reference_id="EXC001",
        )

        event_bus.broadcast_sync("TELEMETRY_UPDATED", {"machine_id": "EXC001"})
        event_bus.broadcast_sync("INCIDENT_UPDATED", {"machine_id": "EXC001"})

        return {
            "scenario": "normal",
            "status": "applied",
            "message": "Normal operating conditions restored. Telemetry is nominal and clear.",
        }

    elif scenario == "seatbelt_event":
        # 2. Seatbelt Event: Unfasten seatbelt while engine active
        telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == "EXC001").order_by(TelemetryRecord.id.desc()).first()
        if telemetry:
            telemetry.seatbelt_status = "Unfastened"
            telemetry.machine_active = True
            telemetry.timestamp = utc_now()
            db.commit()

        # Run alert engine to deterministically produce incident
        incidents = alert_engine.evaluate_machine_alerts(db, "EXC001")
        new_incidents = [i for i in incidents if i.incident_type in ["SEATBELT_EVENT", "UNFASTENED_SEATBELT"]]

        record_audit_event(
            db,
            actor_id="DEMO_CONTROLLER",
            actor_role="SUPERVISOR",
            action="DEMO_SCENARIO_APPLIED",
            entity_type="INCIDENT",
            entity_id="EXC001",
            details={"scenario": "seatbelt_event", "seatbelt_status": "Unfastened"},
        )

        create_notification(
            db,
            category="SAFETY",
            priority="CRITICAL",
            title="Safety Alert: Seatbelt Unfastened",
            message="Operator seatbelt unfastened while Cat 336 engine is running. Immediate cab attention required.",
            reference_type="incident",
            reference_id="SEATBELT_EVENT",
        )

        event_bus.broadcast_sync("TELEMETRY_UPDATED", {"machine_id": "EXC001"})
        event_bus.broadcast_sync("INCIDENT_CREATED", {"incident_type": "SEATBELT_EVENT"})

        return {
            "scenario": "seatbelt_event",
            "status": "applied",
            "message": "Seatbelt unfastened event injected. Alert engine generated safety incident.",
            "incidents_count": len(new_incidents),
        }

    elif scenario == "high_idle":
        # 3. High Idle: set idle minutes to 65
        telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == "EXC001").order_by(TelemetryRecord.id.desc()).first()
        if telemetry:
            telemetry.idle_minutes = 65
            telemetry.machine_active = True
            telemetry.timestamp = utc_now()
            db.commit()

        incidents = alert_engine.evaluate_machine_alerts(db, "EXC001")
        new_incidents = [i for i in incidents if i.incident_type in ["HIGH_IDLE", "HIGH_IDLE_TIME"]]

        record_audit_event(
            db,
            actor_id="DEMO_CONTROLLER",
            actor_role="SUPERVISOR",
            action="DEMO_SCENARIO_APPLIED",
            entity_type="INCIDENT",
            entity_id="EXC001",
            details={"scenario": "high_idle", "idle_minutes": 65},
        )

        create_notification(
            db,
            category="PRODUCTIVITY",
            priority="MEDIUM",
            title="Productivity Alert: High Idle Time",
            message="Machine idle time reached 65 minutes (exceeds 45m threshold). Potential fuel inefficiency.",
            reference_type="incident",
            reference_id="HIGH_IDLE",
        )

        event_bus.broadcast_sync("TELEMETRY_UPDATED", {"machine_id": "EXC001"})
        event_bus.broadcast_sync("INCIDENT_CREATED", {"incident_type": "HIGH_IDLE"})

        return {
            "scenario": "high_idle",
            "status": "applied",
            "message": "High idle scenario applied. Productivity incident generated.",
            "incidents_count": len(new_incidents),
        }

    elif scenario == "task_delay":
        # 4. Task Delay: Pause current active task
        task = db.query(Task).filter(Task.status == "IN_PROGRESS").first()
        if not task:
            task = db.query(Task).filter(Task.task_id == "T001").first()

        if task:
            task.status = "PAUSED"
            task.pause_reason = "WEATHER"
            task.pause_note = "Severe rainstorm holding bucket operations"
            task.prediction_status = "DELAYED"

            pause_event = TaskPauseEvent(
                task_id=task.task_id,
                reason="WEATHER",
                note=task.pause_note,
                created_at=utc_now(),
            )
            db.add(pause_event)
            db.commit()

            record_audit_event(
                db,
                actor_id="OP1001",
                actor_role="OPERATOR",
                action="TASK_PAUSED",
                entity_type="TASK",
                entity_id=task.task_id,
                details={"reason": "WEATHER", "note": task.pause_note},
            )

            create_notification(
                db,
                category="TASK",
                priority="HIGH",
                title=f"Task {task.task_id} Paused",
                message=f"{task.task_type} paused due to WEATHER: {task.pause_note}",
                reference_type="task",
                reference_id=task.task_id,
            )

            event_bus.broadcast_sync("TASK_UPDATED", {"task_id": task.task_id, "status": "PAUSED"})

            return {
                "scenario": "task_delay",
                "status": "applied",
                "task_id": task.task_id,
                "message": f"Task {task.task_id} paused due to weather delay.",
            }

        return {"scenario": "task_delay", "status": "error", "message": "No active task available to pause."}

    elif scenario == "truck_request":
        # 5. Truck Request: Create an operator support request for haul truck dispatch
        count = db.query(SupportRequest).count()
        new_id = f"R{count + 1:03d}"
        while db.query(SupportRequest).filter(SupportRequest.id == new_id).first():
            count += 1
            new_id = f"R{count + 1:03d}"

        req = SupportRequest(
            id=new_id,
            operator_id="OP1001",
            machine_id="EXC001",
            task_id="T001",
            request_type="TRUCK_DISPATCH",
            message="Excavation pile full. Awaiting off-highway haul truck at Loading Bench 4.",
            status="OPEN",
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        db.add(req)

        event = SupportRequestEvent(
            request_id=new_id,
            actor_id="OP1001",
            event_type="CREATED",
            message=req.message,
            created_at=utc_now(),
        )
        db.add(event)
        db.commit()

        record_audit_event(
            db,
            actor_id="OP1001",
            actor_role="OPERATOR",
            action="REQUEST_CREATED",
            entity_type="SUPPORT_REQUEST",
            entity_id=new_id,
            details={"request_type": "TRUCK_DISPATCH", "message": req.message},
        )

        create_notification(
            db,
            category="SUPPORT",
            priority="HIGH",
            title=f"Support Request {new_id} Submitted",
            message="Operator requested haul truck dispatch at Loading Bench 4.",
            reference_type="support_request",
            reference_id=new_id,
        )

        event_bus.broadcast_sync("REQUEST_CREATED", {"id": new_id, "status": "OPEN"})

        return {
            "scenario": "truck_request",
            "status": "applied",
            "request_id": new_id,
            "message": f"Support request {new_id} dispatched for haul truck coordination.",
        }

    elif scenario == "telemetry_lost":
        # 6. Telemetry Lost: set machine_active=False
        telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == "EXC001").order_by(TelemetryRecord.id.desc()).first()
        if telemetry:
            telemetry.machine_active = False
            telemetry.timestamp = utc_now()
            db.commit()

        record_audit_event(
            db,
            actor_id="DEMO_CONTROLLER",
            actor_role="SUPERVISOR",
            action="DEMO_SCENARIO_APPLIED",
            entity_type="SYSTEM",
            entity_id="EXC001",
            details={"scenario": "telemetry_lost", "machine_active": False},
        )

        create_notification(
            db,
            category="SYSTEM",
            priority="HIGH",
            title="CAN-Bus Link Lost",
            message="Machine EXC001 CAN-Bus communication lost. Telemetry stream degraded.",
            reference_type="machine",
            reference_id="EXC001",
        )

        event_bus.broadcast_sync("TELEMETRY_UPDATED", {"machine_id": "EXC001", "machine_active": False})

        return {
            "scenario": "telemetry_lost",
            "status": "applied",
            "message": "Telemetry communication link set to degraded/lost.",
        }

    elif scenario == "restore_normal":
        # 7. Restore Normal Conditions
        telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == "EXC001").order_by(TelemetryRecord.id.desc()).first()
        if telemetry:
            telemetry.seatbelt_status = "Fastened"
            telemetry.idle_minutes = 12
            telemetry.machine_active = True
            telemetry.fuel_used = 3.8
            telemetry.timestamp = utc_now()
            db.commit()

        alert_engine.evaluate_machine_alerts(db, "EXC001")

        # Resume paused task if T001 is paused
        t001 = db.query(Task).filter(Task.task_id == "T001").first()
        if t001 and t001.status == "PAUSED":
            t001.status = "IN_PROGRESS"
            t001.pause_reason = None
            t001.pause_note = None
            db.commit()
            event_bus.broadcast_sync("TASK_UPDATED", {"task_id": "T001", "status": "IN_PROGRESS"})

        record_audit_event(
            db,
            actor_id="DEMO_CONTROLLER",
            actor_role="SUPERVISOR",
            action="DEMO_SCENARIO_APPLIED",
            entity_type="SYSTEM",
            entity_id="EXC001",
            details={"scenario": "restore_normal", "description": "Restored nominal operations"},
        )

        create_notification(
            db,
            category="SYSTEM",
            priority="INFO",
            title="Operations Nominal",
            message="Telemetry restored to nominal levels. Reversible alerts automatically cleared.",
            reference_type="machine",
            reference_id="EXC001",
        )

        event_bus.broadcast_sync("TELEMETRY_UPDATED", {"machine_id": "EXC001"})
        event_bus.broadcast_sync("INCIDENT_UPDATED", {"machine_id": "EXC001"})

        return {
            "scenario": "restore_normal",
            "status": "applied",
            "message": "All equipment conditions restored to safe nominal operation.",
        }

    else:
        raise ValueError(f"Unknown scenario '{scenario_name}'. Supported: normal, seatbelt_event, high_idle, task_delay, truck_request, telemetry_lost, restore_normal")


def reset_demo(db: Session) -> Dict[str, Any]:
    """
    Deterministic Demo Reset.
    Restores the database state to the pristine starting baseline without deleting schema:
    - Operator: OP1001
    - Machine: EXC001 (status=OPERATIONAL, engine_hours=1524.8)
    - Tasks:
        - T001: Earth Excavation, IN_PROGRESS, planned=60, progress=15
        - T002: Trenching, PENDING, planned=45, progress=0
        - T003: Material Loading, PENDING, planned=30, progress=0
    - Telemetry: seatbelt=Fastened, idle=15m, fuel=3.8L, active=True
    - Clean unresolved incidents & requests
    - Clean audit events & reset notifications
    """
    # 1. Reset Telemetry
    telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == "EXC001").order_by(TelemetryRecord.id.desc()).first()
    if telemetry:
        telemetry.engine_hours = 1524.8
        telemetry.fuel_used = 3.8
        telemetry.load_cycles = 2
        telemetry.idle_minutes = 15
        telemetry.seatbelt_status = "Fastened"
        telemetry.machine_active = True
        telemetry.timestamp = utc_now()
    else:
        telemetry = TelemetryRecord(
            machine_id="EXC001",
            engine_hours=1524.8,
            fuel_used=3.8,
            load_cycles=2,
            idle_minutes=15,
            seatbelt_status="Fastened",
            machine_active=True,
            timestamp=utc_now(),
        )
        db.add(telemetry)

    # 2. Reset Tasks deterministically
    task_configs = [
        {"task_id": "T001", "task_type": "Earth Excavation", "status": "IN_PROGRESS", "planned_minutes": 60, "progress": 0, "weather": "Sunny", "operator_skill": "Expert", "machine_age": 2.0},
        {"task_id": "T002", "task_type": "Trenching", "status": "PENDING", "planned_minutes": 45, "progress": 0, "weather": "Rainy", "operator_skill": "Intermediate", "machine_age": 4.0},
        {"task_id": "T003", "task_type": "Material Loading", "status": "PENDING", "planned_minutes": 30, "progress": 0, "weather": "Cloudy", "operator_skill": "Beginner", "machine_age": 3.0},
    ]

    for cfg in task_configs:
        t = db.query(Task).filter(Task.task_id == cfg["task_id"]).first()
        pred = prediction_service.predict(
            cfg["task_type"], cfg["weather"], cfg["operator_skill"], cfg["machine_age"], cfg["planned_minutes"]
        )
        if t:
            t.task_type = cfg["task_type"]
            t.status = cfg["status"]
            t.planned_minutes = cfg["planned_minutes"]
            t.progress = cfg["progress"]
            t.weather = cfg["weather"]
            t.operator_skill = cfg["operator_skill"]
            t.machine_age = cfg["machine_age"]
            t.pause_reason = None
            t.pause_note = None
            t.predicted_minutes = pred["predicted_minutes"]
            t.prediction_status = pred["prediction_status"]
            t.prediction_basis = pred["data_basis"]
        else:
            t = Task(
                **cfg,
                pause_reason=None,
                pause_note=None,
                predicted_minutes=pred["predicted_minutes"],
                prediction_status=pred["prediction_status"],
                prediction_basis=pred["data_basis"],
            )
            db.add(t)

    # 3. Clean Task Pause Events
    db.query(TaskPauseEvent).delete()

    # 4. Clean Unresolved Incidents
    db.query(Incident).delete()

    # 5. Clean Support Requests and Events
    db.query(SupportRequestEvent).delete()
    db.query(SupportRequest).delete()

    # 6. Reset Notifications to initial welcome notification
    db.query(Notification).delete()
    welcome_notif = Notification(
        id="NOTIF-0001",
        category="SYSTEM",
        priority="INFO",
        title="ShiftMate Session Initialized",
        message="Deterministic baseline state loaded. Machine EXC001 ready for operation.",
        created_at=utc_now(),
        read=False,
        reference_type="machine",
        reference_id="EXC001",
    )
    db.add(welcome_notif)

    # 7. Record Reset in Audit Log
    reset_audit = AuditEvent(
        actor_id="SYSTEM",
        actor_role="SYSTEM",
        action="DEMO_RESET",
        entity_type="SYSTEM",
        entity_id="EXC001",
        timestamp=utc_now(),
        details="Demo environment reset to standard deterministic starting baseline.",
    )
    db.add(reset_audit)

    db.commit()

    # Broadcast reset to all clients
    event_bus.broadcast_sync("TASK_UPDATED", {"reset": True})
    event_bus.broadcast_sync("TELEMETRY_UPDATED", {"reset": True})
    event_bus.broadcast_sync("INCIDENT_UPDATED", {"reset": True})
    event_bus.broadcast_sync("REQUEST_UPDATED", {"reset": True})
    event_bus.broadcast_sync("NOTIFICATION_CREATED", {"reset": True})

    return {
        "status": "reset_complete",
        "operator": "OP1001",
        "machine": "EXC001",
        "current_task": "T001",
        "tasks_count": 3,
        "telemetry": {
            "engine_hours": 1524.8,
            "idle_minutes": 15,
            "seatbelt_status": "Fastened",
        },
        "message": "Deterministic state restored successfully.",
    }
