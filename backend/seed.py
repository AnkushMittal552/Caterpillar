from sqlalchemy import text
import json
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
    TrainingModule,
    TrainingQuestion,
    TrainingAttempt,
    AuditEvent,
    Notification,
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
                existing.status = t["status"]
                existing.progress = t["progress"]
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
            existing_telemetry.engine_hours = 1524.8
            existing_telemetry.fuel_used = 3.8
            existing_telemetry.load_cycles = 2
            existing_telemetry.idle_minutes = 55
            existing_telemetry.seatbelt_status = "Unfastened"
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

        # -------------------------------------------------------------------
        # Seed Phase 4 Training Modules & Questions
        # -------------------------------------------------------------------
        initial_modules = [
            {
                "id": "MOD_SEATBELT",
                "title": "Seatbelt Awareness",
                "description": "Essential safety protocols regarding continuous three-point harness use during equipment operation.",
                "category": "SAFETY",
                "estimated_minutes": 5,
                "questions": [
                    {
                        "id": "Q_SB_1",
                        "question": "When must an operator fasten their seatbelt in construction machinery?",
                        "choices": [
                            {"key": "A", "text": "Only when driving on public access roads"},
                            {"key": "B", "text": "At all times while the engine is running or machine is active"},
                            {"key": "C", "text": "Only during high-speed trenching operations"},
                            {"key": "D", "text": "Whenever requested by ground personnel"},
                        ],
                        "correct_answer": "B",
                        "explanation": "Standard heavy equipment safety policy requires seatbelts fastened whenever the machine is operating to prevent rollover ejections.",
                    },
                    {
                        "id": "Q_SB_2",
                        "question": "What is the primary function of the ROPS (Rollover Protective Structure) in conjunction with a seatbelt?",
                        "choices": [
                            {"key": "A", "text": "To protect the operator inside the structural survival space"},
                            {"key": "B", "text": "To increase cab insulation against noise"},
                            {"key": "C", "text": "To allow easy egress during machine movement"},
                            {"key": "D", "text": "To balance machine counterweight"},
                        ],
                        "correct_answer": "A",
                        "explanation": "ROPS can only protect the operator if the seatbelt keeps them securely inside the reinforced cab survival envelope.",
                    },
                ],
            },
            {
                "id": "MOD_PROXIMITY",
                "title": "Proximity Awareness",
                "description": "Ground personnel separation, swing-radius boundary management, and spotter communication.",
                "category": "SAFETY",
                "estimated_minutes": 5,
                "questions": [
                    {
                        "id": "Q_PX_1",
                        "question": "What should an operator do if ground personnel enter the excavator swing radius?",
                        "choices": [
                            {"key": "A", "text": "Sound the horn and continue digging"},
                            {"key": "B", "text": "Halt motion immediately and make eye contact"},
                            {"key": "C", "text": "Increase swing speed to finish the cycle quickly"},
                            {"key": "D", "text": "Swing to the opposite side without stopping"},
                        ],
                        "correct_answer": "B",
                        "explanation": "Immediate cessation of swing/boom motion prevents blind-spot collisions with ground workers.",
                    },
                    {
                        "id": "Q_PX_2",
                        "question": "When is a dedicated spotter required on site?",
                        "choices": [
                            {"key": "A", "text": "Only during night shifts"},
                            {"key": "B", "text": "Whenever working near utilities, tight spaces, or blind zones"},
                            {"key": "C", "text": "Never on earth excavation tasks"},
                            {"key": "D", "text": "Only when the machine is brand new"},
                        ],
                        "correct_answer": "B",
                        "explanation": "Spotters provide critical guidance when vision is obstructed or proximity to hazards is high.",
                    },
                ],
            },
            {
                "id": "MOD_IDLE",
                "title": "Understanding Idle Time",
                "description": "Optimizing cycle efficiency, lowering unnecessary fuel burn, and utilizing auto-idle features.",
                "category": "PRODUCTIVITY",
                "estimated_minutes": 5,
                "questions": [
                    {
                        "id": "Q_ID_1",
                        "question": "What is a recommended practice if haul truck queue time exceeds 5 minutes?",
                        "choices": [
                            {"key": "A", "text": "Keep engine at maximum throttle"},
                            {"key": "B", "text": "Switch machine to auto-idle or shut down engine"},
                            {"key": "C", "text": "Continuously cycle the bucket empty"},
                            {"key": "D", "text": "Disable telematics monitoring"},
                        ],
                        "correct_answer": "B",
                        "explanation": "Shutting down or utilizing auto-idle significantly reduces fuel burn and unnecessary machine hours.",
                    },
                    {
                        "id": "Q_ID_2",
                        "question": "How does excessive machine idling directly impact operating metrics?",
                        "choices": [
                            {"key": "A", "text": "It improves hydraulic fluid lifespan"},
                            {"key": "B", "text": "It burns fuel with zero productive payload cycles and skews service intervals"},
                            {"key": "C", "text": "It increases load cycle count automatically"},
                            {"key": "D", "text": "It has no impact on operating costs"},
                        ],
                        "correct_answer": "B",
                        "explanation": "Idling wastes fuel, increases carbon emissions, and accrues maintenance engine hours without completing work.",
                    },
                ],
            },
        ]

        for mod_data in initial_modules:
            existing_mod = db_session.query(TrainingModule).filter(TrainingModule.id == mod_data["id"]).first()
            if not existing_mod:
                new_mod = TrainingModule(
                    id=mod_data["id"],
                    title=mod_data["title"],
                    description=mod_data["description"],
                    category=mod_data["category"],
                    estimated_minutes=mod_data["estimated_minutes"],
                    active=True,
                )
                db_session.add(new_mod)

            for q_data in mod_data["questions"]:
                existing_q = db_session.query(TrainingQuestion).filter(TrainingQuestion.id == q_data["id"]).first()
                if not existing_q:
                    new_q = TrainingQuestion(
                        id=q_data["id"],
                        module_id=mod_data["id"],
                        question=q_data["question"],
                        choices_json=json.dumps(q_data["choices"]),
                        correct_answer=q_data["correct_answer"],
                        explanation=q_data["explanation"],
                    )
                    db_session.add(new_q)

        # Seed initial notification if empty
        if db_session.query(Notification).count() == 0:
            welcome_notif = Notification(
                id="NOTIF-0001",
                category="SYSTEM",
                priority="INFO",
                title="ShiftMate Session Initialized",
                message="Deterministic baseline loaded. Machine EXC001 operational.",
                created_at=utc_now(),
                read=False,
                reference_type="machine",
                reference_id="EXC001",
            )
            db_session.add(welcome_notif)

        # Seed initial audit event if empty
        if db_session.query(AuditEvent).count() == 0:
            init_audit = AuditEvent(
                actor_id="SYSTEM",
                actor_role="SYSTEM",
                action="SYSTEM_INITIALIZED",
                entity_type="SYSTEM",
                entity_id="EXC001",
                timestamp=utc_now(),
                details="ShiftMate Phase 5 system initialization.",
            )
            db_session.add(init_audit)

        db_session.commit()

        # Run alert evaluation on seeded state
        alert_engine.evaluate_machine_alerts(db_session, "EXC001")
        print("Database seeded with Phase 5 models, audit trail, notifications, modules, questions, and initial alerts evaluated successfully.")
    finally:
        if close_after:
            db_session.close()


if __name__ == "__main__":
    seed_data()
