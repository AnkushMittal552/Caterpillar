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
from models import SupportRequest, SupportRequestEvent, TelemetryRecord, Incident, Task


@pytest.fixture(scope="function", autouse=True)
def reset_database():
    """Reset database tables before each test to guarantee complete test isolation."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# Prediction Tests (1-8)
# ---------------------------------------------------------------------------


def test_prediction_endpoint_schema(client):
    """1. prediction endpoint returns expected schema."""
    payload = {
        "task_type": "Trenching",
        "weather": "Rainy",
        "operator_skill": "Intermediate",
        "machine_age": 4.0,
        "baseline_estimate": 45.0,
    }
    res = client.post("/api/predict/task-time", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "predicted_minutes" in data
    assert "baseline_estimate" in data
    assert "difference_minutes" in data
    assert "prediction_status" in data
    assert "model" in data
    assert "data_basis" in data
    assert data["model"] == "random_forest_demo"
    assert data["data_basis"] == "synthetic_demonstration_history"


def test_predicted_minutes_is_numeric(client):
    """2. predicted_minutes is numeric when available."""
    payload = {
        "task_type": "Earth Excavation",
        "weather": "Sunny",
        "operator_skill": "Expert",
        "machine_age": 2.0,
        "baseline_estimate": 60.0,
    }
    res = client.post("/api/predict/task-time", json=payload)
    data = res.json()
    assert isinstance(data["predicted_minutes"], (int, float))
    assert data["predicted_minutes"] > 0


def test_deterministic_input_produces_stable_result(client):
    """3. same deterministic input produces stable result."""
    payload = {
        "task_type": "Demolition",
        "weather": "Windy",
        "operator_skill": "Intermediate",
        "machine_age": 6.0,
        "baseline_estimate": 90.0,
    }
    res1 = client.post("/api/predict/task-time", json=payload).json()
    res2 = client.post("/api/predict/task-time", json=payload).json()
    assert res1["predicted_minutes"] == res2["predicted_minutes"]
    assert res1["difference_minutes"] == res2["difference_minutes"]
    assert res1["prediction_status"] == res2["prediction_status"]


def test_missing_required_field_fails_validation(client):
    """4. missing required field fails validation (422)."""
    # Missing baseline_estimate and machine_age
    res = client.post("/api/predict/task-time", json={"task_type": "Trenching", "weather": "Rainy"})
    assert res.status_code == 422


def test_invalid_category_handled_cleanly(client):
    """5. invalid category is handled cleanly without crashing."""
    payload = {
        "task_type": "UnknownTaskCategory",
        "weather": "Tornado",
        "operator_skill": "NoviceUnseen",
        "machine_age": 12.0,
        "baseline_estimate": 50.0,
    }
    res = client.post("/api/predict/task-time", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Model uses handle_unknown='ignore' and should produce a valid prediction safely
    assert data["predicted_minutes"] is not None


def test_difference_minutes_is_correct(client):
    """6. difference_minutes is correct (predicted - baseline)."""
    payload = {
        "task_type": "Material Loading",
        "weather": "Cloudy",
        "operator_skill": "Beginner",
        "machine_age": 3.0,
        "baseline_estimate": 30.0,
    }
    data = client.post("/api/predict/task-time", json=payload).json()
    expected_diff = round(data["predicted_minutes"] - data["baseline_estimate"], 1)
    assert data["difference_minutes"] == expected_diff


def test_at_risk_state_when_predicted_exceeds_planned(client):
    """7. AT_RISK state is correct when predicted materially exceeds planned."""
    # With low baseline 25, model prediction (~40 min) will be >= 3 min over baseline
    payload = {
        "task_type": "Material Loading",
        "weather": "Cloudy",
        "operator_skill": "Beginner",
        "machine_age": 3.0,
        "baseline_estimate": 25.0,
    }
    data = client.post("/api/predict/task-time", json=payload).json()
    assert data["difference_minutes"] >= 3.0
    assert data["prediction_status"] == "AT_RISK"


def test_unavailable_prediction_handled_safely(client):
    """8. unavailable prediction handled safely."""
    payload = {
        "task_type": "Trenching",
        "weather": "Rainy",
        "operator_skill": "Intermediate",
        "machine_age": 4.0,
        "baseline_estimate": -10.0,  # invalid baseline
    }
    data = client.post("/api/predict/task-time", json=payload).json()
    assert data["predicted_minutes"] is None
    assert data["prediction_status"] == "UNAVAILABLE"


# ---------------------------------------------------------------------------
# Usage Insights Tests (9-12)
# ---------------------------------------------------------------------------


def test_high_idle_insight_appears_for_high_idle(client):
    """9. high idle insight appears for high idle."""
    res = client.get("/api/usage-insights?machine_id=EXC001")
    assert res.status_code == 200
    data = res.json()
    assert "insights" in data
    types = [i["type"] for i in data["insights"]]
    assert "HIGH_IDLE" in types


def test_high_idle_insight_disappears_under_threshold(client):
    """10. high idle insight disappears/does not appear under threshold."""
    # Update idle_minutes to 15 (below 45 min threshold)
    client.post("/api/demo/telemetry", json={"idle_minutes": 15})

    data = client.get("/api/usage-insights?machine_id=EXC001").json()
    types = [i["type"] for i in data["insights"]]
    assert "HIGH_IDLE" not in types


def test_insight_evidence_matches_telemetry(client):
    """11. evidence matches telemetry."""
    data = client.get("/api/usage-insights?machine_id=EXC001").json()
    idle_insight = next(i for i in data["insights"] if i["type"] == "HIGH_IDLE")
    evidence = idle_insight["evidence"]
    assert evidence["idle_minutes"] == 55
    assert evidence["demo_threshold_minutes"] == 45
    assert evidence["load_cycles"] == 2


def test_no_unsupported_diagnosis_language(client):
    """12. no unsupported diagnosis language is generated."""
    data = client.get("/api/usage-insights?machine_id=EXC001").json()
    for inc in data["insights"]:
        msg = inc["message"].lower()
        # Must not accuse or jump to mechanical conclusions
        assert "inefficient" not in msg
        assert "faulty" not in msg
        assert "broken" not in msg
        assert "failure" not in msg


# ---------------------------------------------------------------------------
# Support Requests Tests (13-20)
# ---------------------------------------------------------------------------


def test_create_support_request(client):
    """13. create request works."""
    payload = {
        "request_type": "LOGISTICS",
        "task_id": "T001",
        "message": "Need additional dump truck for earth excavation",
    }
    res = client.post("/api/support-requests", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OPEN"
    assert data["request_type"] == "LOGISTICS"
    assert data["message"] == payload["message"]
    assert len(data["events"]) >= 1
    assert data["events"][0]["event_type"] == "CREATED"


def test_list_support_requests_with_filter(client):
    """14. list request works with status filter."""
    res = client.get("/api/support-requests?status=OPEN")
    assert res.status_code == 200
    requests = res.json()
    assert len(requests) >= 1
    assert all(r["status"] == "OPEN" for r in requests)


def test_acknowledge_support_request(client):
    """15. acknowledge works."""
    # Seeded request R001 is OPEN
    res = client.post("/api/support-requests/R001/acknowledge")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ACKNOWLEDGED"
    assert data["acknowledged_at"] is not None

    event_types = [e["event_type"] for e in data["events"]]
    assert "ACKNOWLEDGED" in event_types


def test_respond_preserves_history(client):
    """16. respond preserves history and does not fake resolution."""
    # Acknowledge first
    client.post("/api/support-requests/R001/acknowledge")

    # Supervisor responds
    response_msg = "Truck dispatched, ETA 8 minutes."
    res = client.post("/api/support-requests/R001/respond", json={"message": response_msg})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "IN_PROGRESS"
    assert data["latest_response"] == response_msg
    assert data["resolved_at"] is None  # Does NOT prematurely resolve!

    event_types = [e["event_type"] for e in data["events"]]
    assert "CREATED" in event_types
    assert "ACKNOWLEDGED" in event_types
    assert "RESPONDED" in event_types


def test_resolve_support_request(client):
    """17. resolve works."""
    res = client.post("/api/support-requests/R001/resolve")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RESOLVED"
    assert data["resolved_at"] is not None

    event_types = [e["event_type"] for e in data["events"]]
    assert "RESOLVED" in event_types


def test_invalid_support_request_transition_fails(client):
    """18. invalid transition fails."""
    # Resolve R001
    client.post("/api/support-requests/R001/resolve")

    # Acknowledging or responding to a resolved request must fail (400)
    ack_res = client.post("/api/support-requests/R001/acknowledge")
    assert ack_res.status_code == 400

    resp_res = client.post("/api/support-requests/R001/respond", json={"message": "Too late"})
    assert resp_res.status_code == 400


def test_resolved_requests_remain_queryable(client):
    """19. resolved requests remain queryable."""
    client.post("/api/support-requests/R001/resolve")

    res = client.get("/api/support-requests?status=RESOLVED")
    assert res.status_code == 200
    requests = res.json()
    assert any(r["id"] == "R001" for r in requests)


def test_resolved_request_is_not_counted_as_open(client):
    """20. resolved request is not counted as open."""
    # Initial seeded state has R001 OPEN (open_request_count = 1)
    dash1 = client.get("/api/dashboard").json()
    assert dash1["open_request_count"] == 1

    # Resolve R001
    client.post("/api/support-requests/R001/resolve")

    # Dashboard open_request_count should drop to 0
    dash2 = client.get("/api/dashboard").json()
    assert dash2["open_request_count"] == 0


# ---------------------------------------------------------------------------
# Regression Tests (21-24)
# ---------------------------------------------------------------------------


def test_phase1_dashboard_regression(client):
    """21. Phase-1 dashboard still works."""
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data["operator"]["id"] == "OP1001"
    assert data["machine"]["id"] == "EXC001"
    assert data["current_task"]["task_id"] == "T001"


def test_phase2_incidents_regression(client):
    """22. Phase-2 incidents still work."""
    res = client.get("/api/incidents")
    assert res.status_code == 200
    incidents = res.json()
    types = [i["incident_type"] for i in incidents]
    assert "SEATBELT_EVENT" in types
    assert "HIGH_IDLE" in types


def test_task_actions_regression(client):
    """23. task actions still work."""
    # Start T002
    res = client.post("/api/tasks/T002/start")
    assert res.status_code == 200
    assert res.json()["status"] == "IN_PROGRESS"

    # Pause T002
    pause_res = client.post("/api/tasks/T002/pause", json={"reason": "BREAK"})
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "PAUSED"


def test_incident_acknowledgement_regression(client):
    """24. incident acknowledgement still works."""
    incidents = client.get("/api/incidents").json()
    first_id = incidents[0]["id"]
    res = client.post(f"/api/incidents/{first_id}/acknowledge")
    assert res.status_code == 200
    assert res.json()["status"] == "ACKNOWLEDGED"
