from sqlalchemy import text
from database import SessionLocal, engine, Base
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
from services.alert_engine import alert_engine
from services.prediction_service import prediction_service


def run_migrations():
    """Ensure newly added columns exist in SQLite without needing external tools."""
    with engine.connect() as conn:
        # Check telemetry_records
        try:
            conn.execute(text("ALTER TABLE telemetry_records ADD COLUMN machine_active BOOLEAN DEFAULT 1"))
            conn.commit()
        except Exception:
            pass

        # Check tasks Phase 3 columns
        new_task_columns = [
            ("weather", "VARCHAR"),
            ("operator_skill", "VARCHAR"),
            ("machine_age", "FLOAT"),
            ("predicted_minutes", "FLOAT"),
            ("prediction_status", "VARCHAR"),
            ("prediction_basis", "VARCHAR DEFAULT 'synthetic_demonstration_history'"),
        ]
        for col_name, col_type in new_task_columns:
            try:
                conn.execute(text(f"ALTER TABLE tasks ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass


def seed_data(db_session=None):
    Base.metadata.create_all(bind=engine)
    run_migrations()

    close_after = False
    if db_session is None:
        db_session = SessionLocal()
        close_after = True

    try:
        # Seed Operator if not exists
        if not db_session.query(User).filter(User.id == "OP1001").first():
            operator = User(id="OP1001", role="OPERATOR", name="Operator OP1001")
            db_session.add(operator)

        # Seed Machine if not exists
        if not db_session.query(Machine).filter(Machine.id == "EXC001").first():
            machine = Machine(id="EXC001", status="ACTIVE", engine_hours=1524.8)
            db_session.add(machine)

        # Seed Tasks with Prediction Metadata
        tasks_to_seed = [
            {
                "task_id": "T001",
                "task_type": "Earth Excavation",
                "status": "IN_PROGRESS",
                "planned_minutes": 60,
                "progress": 0,
                "weather": "Sunny",
                "operator_skill": "Expert",
                "machine_age": 2.0,
            },
            {
                "task_id": "T002",
                "task_type": "Trenching",
                "status": "PENDING",
                "planned_minutes": 45,
                "progress": 0,
                "weather": "Rainy",
                "operator_skill": "Intermediate",
                "machine_age": 4.0,
            },
            {
                "task_id": "T003",
                "task_type": "Material Loading",
                "status": "PENDING",
                "planned_minutes": 30,
                "progress": 0,
                "weather": "Cloudy",
                "operator_skill": "Beginner",
                "machine_age": 3.0,
            },
        ]

        for t in tasks_to_seed:
            existing = db_session.query(Task).filter(Task.task_id == t["task_id"]).first()
            # Compute real prediction from prediction_service
            pred = prediction_service.predict(
                t["task_type"],
                t["weather"],
                t["operator_skill"],
                t["machine_age"],
                t["planned_minutes"],
            )

            if not existing:
                task_obj = Task(
                    **t,
                    predicted_minutes=pred["predicted_minutes"],
                    prediction_status=pred["prediction_status"],
                    prediction_basis=pred["data_basis"],
                )
                db_session.add(task_obj)
            else:
                existing.weather = t["weather"]
                existing.operator_skill = t["operator_skill"]
                existing.machine_age = t["machine_age"]
                existing.predicted_minutes = pred["predicted_minutes"]
                existing.prediction_status = pred["prediction_status"]
                existing.prediction_basis = pred["data_basis"]

        # Seed Telemetry Record if not exists
        existing_telemetry = (
            db_session.query(TelemetryRecord)
            .filter(
                TelemetryRecord.machine_id == "EXC001",
                TelemetryRecord.operator_id == "OP1001",
                TelemetryRecord.source == "SUPPLIED_SAMPLE",
            )
            .first()
        )

        if not existing_telemetry:
            telemetry = TelemetryRecord(
                machine_id="EXC001",
                operator_id="OP1001",
                engine_hours=1524.8,
                fuel_used=3.8,
                load_cycles=2,
                idle_minutes=55,
                seatbelt_status="Unfastened",
                machine_active=True,
                source="SUPPLIED_SAMPLE",
            )
            db_session.add(telemetry)
        else:
            if existing_telemetry.machine_active is None:
                existing_telemetry.machine_active = True

        # Seed Initial Demo Support Request R001 if not exists
        if not db_session.query(SupportRequest).filter(SupportRequest.id == "R001").first():
            req001 = SupportRequest(
                id="R001",
                operator_id="OP1001",
                machine_id="EXC001",
                task_id="T001",
                request_type="LOGISTICS",
                message="Additional haul truck required for earth excavation.",
                status="OPEN",
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db_session.add(req001)

            event001 = SupportRequestEvent(
                request_id="R001",
                actor_id="OP1001",
                event_type="CREATED",
                message="Support request submitted by operator OP1001.",
                created_at=utc_now(),
            )
            db_session.add(event001)

        db_session.commit()

        # Run alert evaluation on seeded state
        alert_engine.evaluate_machine_alerts(db_session, "EXC001")
        print("Database seeded with Phase 3 models, predictions, and initial alerts evaluated successfully.")
    finally:
        if close_after:
            db_session.close()


if __name__ == "__main__":
    seed_data()
