from sqlalchemy import text
from database import SessionLocal, engine, Base
from models import User, Machine, Task, TelemetryRecord, Incident, TaskPauseEvent
from services.alert_engine import alert_engine


def run_migrations():
    """Ensure newly added columns exist in SQLite without needing external tools."""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE telemetry_records ADD COLUMN machine_active BOOLEAN DEFAULT 1"))
            conn.commit()
        except Exception:
            # Column already exists
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

        # Seed Tasks if not exist
        tasks_to_seed = [
            {
                "task_id": "T001",
                "task_type": "Earth Excavation",
                "status": "IN_PROGRESS",
                "planned_minutes": 60,
                "predicted_minutes": None,
                "progress": 0,
            },
            {
                "task_id": "T002",
                "task_type": "Trenching",
                "status": "PENDING",
                "planned_minutes": 45,
                "predicted_minutes": None,
                "progress": 0,
            },
            {
                "task_id": "T003",
                "task_type": "Material Loading",
                "status": "PENDING",
                "planned_minutes": 30,
                "predicted_minutes": None,
                "progress": 0,
            },
        ]

        for t in tasks_to_seed:
            if not db_session.query(Task).filter(Task.task_id == t["task_id"]).first():
                task_obj = Task(**t)
                db_session.add(task_obj)

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

        db_session.commit()

        # Run alert evaluation on seeded state
        alert_engine.evaluate_machine_alerts(db_session, "EXC001")
        print("Database seeded and initial alerts evaluated successfully.")
    finally:
        if close_after:
            db_session.close()


if __name__ == "__main__":
    seed_data()
