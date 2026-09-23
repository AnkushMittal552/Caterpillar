import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app
from database import Base, engine, SessionLocal
from seed import seed_data
from models import Task, Incident, TelemetryRecord, TaskPauseEvent
from services.alert_engine import alert_engine


@pytest.fixture(scope="function", autouse=True)
def reset_database():
    """Reset database tables before each test function to guarantee isolation."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# Task Transition Tests (1-6)
# ---------------------------------------------------------------------------


def test_task_pending_to_start(client):
    """1. PENDING -> START works."""
    # T002 is seeded as PENDING
    response = client.post("/api/tasks/T002/start")
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "T002"
    assert data["status"] == "IN_PROGRESS"


def test_task_start_to_pause(client):
    """2. START (IN_PROGRESS) -> PAUSE works."""
    # T001 is seeded as IN_PROGRESS
    pause_payload = {
        "reason": "WAITING_FOR_TRUCK",
        "note": "Waiting for haul truck #12",
    }
    response = client.post("/api/tasks/T001/pause", json=pause_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "T001"
    assert data["status"] == "PAUSED"


def test_task_pause_stores_reason():
    """3. PAUSE stores reason in history."""
    db = SessionLocal()
    try:
        # Pause task T001
        with TestClient(app) as c:
            c.post("/api/tasks/T001/pause", json={"reason": "WEATHER", "note": "Heavy rain"})

        events = db.query(TaskPauseEvent).filter(TaskPauseEvent.task_id == "T001").all()
        assert len(events) >= 1
        last_event = events[-1]
        assert last_event.reason == "WEATHER"
        assert last_event.note == "Heavy rain"
        assert last_event.paused_at is not None
        assert last_event.resumed_at is None
    finally:
        db.close()


def test_task_paused_to_resume(client):
    """4. PAUSED -> RESUME works."""
    # Pause T001 first
    client.post("/api/tasks/T001/pause", json={"reason": "BREAK", "note": "Lunch break"})

    # Resume T001
    response = client.post("/api/tasks/T001/resume")
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "T001"
    assert data["status"] == "IN_PROGRESS"

    # Verify pause event was closed
    db = SessionLocal()
    try:
        last_event = (
            db.query(TaskPauseEvent)
            .filter(TaskPauseEvent.task_id == "T001")
            .order_by(TaskPauseEvent.id.desc())
            .first()
        )
        assert last_event is not None
        assert last_event.resumed_at is not None
    finally:
        db.close()


def test_task_in_progress_to_complete(client):
    """5. IN_PROGRESS -> COMPLETE works."""
    response = client.post("/api/tasks/T001/complete")
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "T001"
    assert data["status"] == "COMPLETED"
    assert data["progress"] == 100


def test_invalid_task_transitions_fail(client):
    """6. Invalid transitions fail."""
    # PENDING -> PAUSED must fail (400)
    res1 = client.post("/api/tasks/T002/pause", json={"reason": "BREAK"})
    assert res1.status_code == 400
    assert "PENDING" in res1.json()["detail"]

    # Complete T001
    client.post("/api/tasks/T001/complete")

    # COMPLETED -> START must fail (400)
    res2 = client.post("/api/tasks/T001/start")
    assert res2.status_code == 400

    # COMPLETED -> PAUSE must fail (400)
    res3 = client.post("/api/tasks/T001/pause", json={"reason": "OTHER"})
    assert res3.status_code == 400

    # Invalid pause reason must fail validation (422)
    client.post("/api/tasks/T002/start")  # now IN_PROGRESS
    res4 = client.post("/api/tasks/T002/pause", json={"reason": "INVALID_REASON"})
    assert res4.status_code == 422


# ---------------------------------------------------------------------------
# Incident Lifecycle & Deduplication Tests (7-15)
# ---------------------------------------------------------------------------


def test_unfastened_seatbelt_creates_incident(client):
    """7. Unfastened + machine_active creates seatbelt incident."""
    res = client.get("/api/incidents")
    assert res.status_code == 200
    incidents = res.json()

    seatbelt_inc = next((i for i in incidents if i["incident_type"] == "SEATBELT_EVENT"), None)
    assert seatbelt_inc is not None
    assert seatbelt_inc["category"] == "SAFETY"
    assert seatbelt_inc["severity"] == "HIGH"
    assert seatbelt_inc["status"] == "ACTIVE"
    assert seatbelt_inc["evidence"]["seatbelt_status"] == "Unfastened"
    assert seatbelt_inc["evidence"]["machine_active"] is True


def test_repeated_evaluation_does_not_duplicate(client):
    """8. Same condition evaluated repeatedly does not duplicate."""
    # Seeded state already generated SEATBELT_EVENT.
    # Evaluate 10 times via demo telemetry
    for _ in range(10):
        client.post("/api/demo/telemetry", json={"seatbelt_status": "Unfastened", "machine_active": True})

    res = client.get("/api/incidents?status=ACTIVE")
    incidents = res.json()
    seatbelt_incidents = [i for i in incidents if i["incident_type"] == "SEATBELT_EVENT"]
    # Exactly 1 active seatbelt incident must exist
    assert len(seatbelt_incidents) == 1


def test_acknowledge_changes_status_to_acknowledged(client):
    """9. Acknowledge changes ACTIVE -> ACKNOWLEDGED."""
    res = client.get("/api/incidents")
    seatbelt_inc = next(i for i in res.json() if i["incident_type"] == "SEATBELT_EVENT")

    ack_res = client.post(f"/api/incidents/{seatbelt_inc['id']}/acknowledge")
    assert ack_res.status_code == 200
    data = ack_res.json()
    assert data["status"] == "ACKNOWLEDGED"
    assert data["acknowledged_at"] is not None


def test_acknowledge_does_not_resolve_incident(client):
    """10. Acknowledge does not resolve incident."""
    res = client.get("/api/incidents")
    seatbelt_inc = next(i for i in res.json() if i["incident_type"] == "SEATBELT_EVENT")

    ack_res = client.post(f"/api/incidents/{seatbelt_inc['id']}/acknowledge")
    data = ack_res.json()
    assert data["status"] == "ACKNOWLEDGED"
    assert data["resolved_at"] is None

    # Verify via GET
    get_res = client.get("/api/incidents")
    updated_inc = next(i for i in get_res.json() if i["id"] == seatbelt_inc["id"])
    assert updated_inc["status"] == "ACKNOWLEDGED"
    assert updated_inc["resolved_at"] is None


def test_clearing_condition_resolves_incident(client):
    """11. Clearing condition resolves incident."""
    res = client.get("/api/incidents")
    seatbelt_inc = next(i for i in res.json() if i["incident_type"] == "SEATBELT_EVENT")
    assert seatbelt_inc["status"] == "ACTIVE"

    # Fasten seatbelt
    client.post("/api/demo/telemetry", json={"seatbelt_status": "Fastened"})

    # Fetch incidents
    all_res = client.get("/api/incidents")
    resolved_inc = next(i for i in all_res.json() if i["id"] == seatbelt_inc["id"])
    assert resolved_inc["status"] == "RESOLVED"
    assert resolved_inc["resolved_at"] is not None


def test_condition_returning_after_resolution_creates_new_incident(client):
    """12. Condition returning after resolution creates a new incident."""
    res = client.get("/api/incidents")
    initial_seatbelt = next(i for i in res.json() if i["incident_type"] == "SEATBELT_EVENT")
    first_id = initial_seatbelt["id"]

    # 1. Fasten seatbelt -> resolves initial incident
    client.post("/api/demo/telemetry", json={"seatbelt_status": "Fastened"})
    res_after_clear = client.get("/api/incidents")
    assert any(i["id"] == first_id and i["status"] == "RESOLVED" for i in res_after_clear.json())

    # 2. Unfasten seatbelt again while machine_active is true -> creates a NEW incident
    client.post("/api/demo/telemetry", json={"seatbelt_status": "Unfastened", "machine_active": True})
    res_after_retrigger = client.get("/api/incidents")
    active_seatbelt = [i for i in res_after_retrigger.json() if i["incident_type"] == "SEATBELT_EVENT" and i["status"] == "ACTIVE"]

    assert len(active_seatbelt) == 1
    new_id = active_seatbelt[0]["id"]
    assert new_id != first_id  # Brand new incident record, history preserved


def test_high_idle_creates_incident(client):
    """13. High idle creates HIGH_IDLE incident."""
    res = client.get("/api/incidents")
    idle_inc = next((i for i in res.json() if i["incident_type"] == "HIGH_IDLE"), None)
    assert idle_inc is not None
    assert idle_inc["category"] == "PRODUCTIVITY"
    assert idle_inc["severity"] == "MEDIUM"
    assert idle_inc["status"] == "ACTIVE"
    assert "High idling observed" in idle_inc["message"]
    assert idle_inc["evidence"]["idle_minutes"] == 55
    assert idle_inc["evidence"]["demo_threshold_minutes"] == 45


def test_high_idle_clear_resolves_it(client):
    """14. High idle clear resolves it."""
    # Lower idle_minutes below threshold 45
    client.post("/api/demo/telemetry", json={"idle_minutes": 20})

    res = client.get("/api/incidents")
    idle_inc = next(i for i in res.json() if i["incident_type"] == "HIGH_IDLE")
    assert idle_inc["status"] == "RESOLVED"
    assert idle_inc["resolved_at"] is not None


def test_dashboard_active_alert_count_matches_unresolved(client):
    """15. Dashboard active_alert_count matches unresolved incidents."""
    # Initial state has SEATBELT_EVENT and HIGH_IDLE unresolved (2 active)
    dash1 = client.get("/api/dashboard").json()
    assert dash1["active_alert_count"] == 2

    # Acknowledge one incident -> still unresolved, count should remain 2
    incidents = client.get("/api/incidents").json()
    first_id = incidents[0]["id"]
    client.post(f"/api/incidents/{first_id}/acknowledge")

    dash2 = client.get("/api/dashboard").json()
    assert dash2["active_alert_count"] == 2

    # Resolve seatbelt incident by fastening seatbelt
    client.post("/api/demo/telemetry", json={"seatbelt_status": "Fastened"})
    dash3 = client.get("/api/dashboard").json()
    assert dash3["active_alert_count"] == 1

    # Resolve high idle by dropping idle minutes
    client.post("/api/demo/telemetry", json={"idle_minutes": 10})
    dash4 = client.get("/api/dashboard").json()
    assert dash4["active_alert_count"] == 0


# ---------------------------------------------------------------------------
# Data Safety Tests (16-17)
# ---------------------------------------------------------------------------


def test_missing_operating_state_does_not_produce_safe():
    """16. Missing required operating-state information does not silently produce 'safe'."""
    db = SessionLocal()
    try:
        # Create telemetry with machine_active = None
        record = TelemetryRecord(
            machine_id="EXC001",
            operator_id="OP1001",
            engine_hours=1524.8,
            fuel_used=3.8,
            load_cycles=2,
            idle_minutes=20,
            seatbelt_status="Unfastened",
            machine_active=None,
            source="TEST_DATA_SAFETY",
        )
        db.add(record)
        db.commit()

        # Existing active seatbelt incident must NOT be resolved when machine_active is None
        initial_incident = db.query(Incident).filter(Incident.incident_type == "SEATBELT_EVENT").first()
        initial_status = initial_incident.status

        alert_engine.evaluate_machine_alerts(db, "EXC001", current_telemetry=record)

        db.refresh(initial_incident)
        # It must retain its active status because state was indeterminate, not safely cleared
        assert initial_incident.status == initial_status
        assert initial_incident.resolved_at is None
    finally:
        db.close()


def test_telemetry_loss_does_not_resolve_existing_incident():
    """17. Telemetry loss does not resolve existing incident."""
    db = SessionLocal()
    try:
        # Ensure there is an active incident
        active_before = (
            db.query(Incident)
            .filter(
                Incident.machine_id == "EXC001",
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
                Incident.resolved_at.is_(None),
            )
            .count()
        )
        assert active_before > 0

        # Simulate telemetry loss by evaluating with current_telemetry=None and empty DB telemetry
        db.query(TelemetryRecord).delete()
        db.commit()

        # Evaluate with no telemetry available
        unresolved = alert_engine.evaluate_machine_alerts(db, "EXC001", current_telemetry=None)

        # Existing incidents must still be unresolved
        assert len(unresolved) == active_before
        for inc in unresolved:
            assert inc.resolved_at is None
            assert inc.status in ["ACTIVE", "ACKNOWLEDGED"]
    finally:
        db.close()
