import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import Task, TelemetryRecord, Incident, SupportRequest, AuditEvent, Notification, TrainingAttempt

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_to_clean_state():
    """Ensure every test runs on a clean deterministic baseline."""
    client.post("/api/demo/reset")
    yield
    client.post("/api/demo/reset")


# ---------------------------------------------------------------------------
# 1. Role Enforcement Tests
# ---------------------------------------------------------------------------


def test_operator_cannot_acknowledge_support_request():
    """Operator role cannot perform supervisor-only acknowledge action (returns 403)."""
    # Create request as operator
    req_res = client.post(
        "/api/support-requests",
        json={"request_type": "PARTS_DELIVERY", "message": "Need replacement filter"},
        headers={"X-Role": "OPERATOR"},
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["id"]

    # Attempt acknowledge with operator role
    ack_res = client.post(
        f"/api/support-requests/{req_id}/acknowledge",
        headers={"X-Role": "OPERATOR"},
    )
    assert ack_res.status_code == 403
    assert "Forbidden" in ack_res.json()["detail"]


def test_operator_cannot_respond_to_support_request():
    """Operator role cannot perform supervisor-only respond action (returns 403)."""
    req_res = client.post(
        "/api/support-requests",
        json={"request_type": "MACHINE_INSPECTION", "message": "Hydraulic noise"},
        headers={"X-Role": "OPERATOR"},
    )
    req_id = req_res.json()["id"]

    resp_res = client.post(
        f"/api/support-requests/{req_id}/respond",
        json={"message": "Maintenance team dispatched."},
        headers={"X-Role": "OPERATOR"},
    )
    assert resp_res.status_code == 403
    assert "Forbidden" in resp_res.json()["detail"]


def test_operator_cannot_resolve_support_request():
    """Operator role cannot perform supervisor-only resolve action (returns 403)."""
    req_res = client.post(
        "/api/support-requests",
        json={"request_type": "SAFETY_HAZARD", "message": "Unstable trench wall"},
        headers={"X-Role": "OPERATOR"},
    )
    req_id = req_res.json()["id"]

    res_res = client.post(
        f"/api/support-requests/{req_id}/resolve",
        headers={"X-Role": "OPERATOR"},
    )
    assert res_res.status_code == 403


def test_supervisor_can_perform_all_workflow_actions():
    """Supervisor role successfully acknowledges, responds, and resolves requests."""
    req_res = client.post(
        "/api/support-requests",
        json={"request_type": "TRUCK_DISPATCH", "message": "Need haul truck"},
        headers={"X-Role": "OPERATOR"},
    )
    req_id = req_res.json()["id"]

    # 1. Supervisor acknowledge
    ack_res = client.post(
        f"/api/support-requests/{req_id}/acknowledge",
        headers={"X-Role": "SUPERVISOR"},
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # 2. Supervisor respond
    resp_res = client.post(
        f"/api/support-requests/{req_id}/respond",
        json={"message": "Truck 104 en route. ETA 6 min."},
        headers={"X-Role": "SUPERVISOR"},
    )
    assert resp_res.status_code == 200
    assert resp_res.json()["status"] == "IN_PROGRESS"
    assert resp_res.json()["latest_response"] == "Truck 104 en route. ETA 6 min."

    # 3. Supervisor resolve
    res_res = client.post(
        f"/api/support-requests/{req_id}/resolve",
        headers={"X-Role": "SUPERVISOR"},
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"


# ---------------------------------------------------------------------------
# 2. Audit Trail Tests
# ---------------------------------------------------------------------------


def test_task_lifecycle_creates_audit_entries():
    """Starting, pausing, resuming, and completing a task records audit events."""
    # Start T002
    start_res = client.post("/api/tasks/T002/start", headers={"X-Role": "OPERATOR"})
    assert start_res.status_code == 200

    # Pause T002
    pause_res = client.post(
        "/api/tasks/T002/pause",
        json={"reason": "WEATHER", "note": "Rain pause"},
        headers={"X-Role": "OPERATOR"},
    )
    assert pause_res.status_code == 200

    # Resume T002
    resume_res = client.post("/api/tasks/T002/resume", headers={"X-Role": "OPERATOR"})
    assert resume_res.status_code == 200

    # Complete T002
    complete_res = client.post("/api/tasks/T002/complete", headers={"X-Role": "OPERATOR"})
    assert complete_res.status_code == 200

    # Query audit trail
    audit_res = client.get("/api/audit?entity_id=T002", headers={"X-Role": "SUPERVISOR"})
    assert audit_res.status_code == 200
    events = audit_res.json()
    actions = [e["action"] for e in events]

    assert "TASK_STARTED" in actions
    assert "TASK_PAUSED" in actions
    assert "TASK_RESUMED" in actions
    assert "TASK_COMPLETED" in actions


def test_support_request_lifecycle_creates_audit_entries():
    """Support request actions generate audit entries with appropriate roles."""
    req_res = client.post(
        "/api/support-requests",
        json={"request_type": "SAFETY_HAZARD", "message": "Rockfall observed"},
        headers={"X-Role": "OPERATOR"},
    )
    req_id = req_res.json()["id"]

    client.post(f"/api/support-requests/{req_id}/acknowledge", headers={"X-Role": "SUPERVISOR"})
    client.post(
        f"/api/support-requests/{req_id}/respond",
        json={"message": "Clearing zone."},
        headers={"X-Role": "SUPERVISOR"},
    )
    client.post(f"/api/support-requests/{req_id}/resolve", headers={"X-Role": "SUPERVISOR"})

    audit_res = client.get(f"/api/audit?entity_id={req_id}", headers={"X-Role": "SUPERVISOR"})
    assert audit_res.status_code == 200
    events = audit_res.json()
    actions = [e["action"] for e in events]

    assert "REQUEST_CREATED" in actions
    assert "REQUEST_ACKNOWLEDGED" in actions
    assert "REQUEST_RESPONDED" in actions
    assert "REQUEST_RESOLVED" in actions


def test_training_completion_creates_audit_entry():
    """Completing a training quiz records an audit event."""
    submit_res = client.post(
        "/api/training/MOD_SEATBELT/submit?operator_id=OP1001",
        json={"answers": {"Q_SB_1": "B", "Q_SB_2": "A"}},
        headers={"X-Role": "OPERATOR"},
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["completed"] is True

    audit_res = client.get("/api/audit?entity_type=TRAINING", headers={"X-Role": "SUPERVISOR"})
    assert audit_res.status_code == 200
    events = audit_res.json()
    assert any(e["action"] == "TRAINING_COMPLETED" and e["entity_id"] == "MOD_SEATBELT" for e in events)


# ---------------------------------------------------------------------------
# 3. Notification Center Tests
# ---------------------------------------------------------------------------


def test_notification_creation_and_mark_read():
    """Notifications are created from events and can be marked as read."""
    # Trigger a scenario that creates a notification
    client.post("/api/demo/scenario/seatbelt_event")

    # List notifications
    notif_res = client.get("/api/notifications")
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert len(notifs) > 0

    unread_item = notifs[0]
    notif_id = unread_item["id"]

    # Mark single notification as read
    read_res = client.post(f"/api/notifications/{notif_id}/read")
    assert read_res.status_code == 200
    assert read_res.json()["read"] is True

    # Mark all read
    all_res = client.post("/api/notifications/read-all")
    assert all_res.status_code == 200
    assert "marked_count" in all_res.json()


# ---------------------------------------------------------------------------
# 4. Demo Scenarios & Deterministic Reset Tests
# ---------------------------------------------------------------------------


def test_demo_scenario_seatbelt_event():
    """Seatbelt scenario updates telemetry, alert engine triggers incident, notification generated."""
    res = client.post("/api/demo/scenario/seatbelt_event")
    assert res.status_code == 200
    assert res.json()["status"] == "applied"

    # Verify incident created
    inc_res = client.get("/api/incidents?status=ACTIVE")
    assert inc_res.status_code == 200
    incidents = inc_res.json()
    assert any(i["category"] == "SAFETY" and "SEATBELT" in i["title"].upper() for i in incidents)

    # Verify dashboard alert count
    dash_res = client.get("/api/dashboard")
    assert dash_res.status_code == 200
    assert dash_res.json()["active_alert_count"] >= 1


def test_demo_scenario_high_idle():
    """High idle scenario updates telemetry and produces productivity alert."""
    res = client.post("/api/demo/scenario/high_idle")
    assert res.status_code == 200

    inc_res = client.get("/api/incidents?status=ACTIVE")
    assert inc_res.status_code == 200
    incidents = inc_res.json()
    assert any("IDLE" in i["title"].upper() for i in incidents)


def test_demo_scenario_restore_normal_resolves_conditions():
    """Restore normal resolves active alerts that are cleared."""
    # First inject seatbelt event
    client.post("/api/demo/scenario/seatbelt_event")
    active_before = len(client.get("/api/incidents?status=ACTIVE").json())
    assert active_before >= 1

    # Restore normal
    restore_res = client.post("/api/demo/scenario/restore_normal")
    assert restore_res.status_code == 200

    # Incident should now be resolved
    inc_res = client.get("/api/incidents?status=ACTIVE")
    assert len(inc_res.json()) == 0


def test_demo_deterministic_reset():
    """Demo reset returns exact known starting baseline."""
    # Create some changes
    client.post("/api/demo/scenario/seatbelt_event")
    client.post("/api/tasks/T001/pause", json={"reason": "WEATHER"})

    # Reset
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200
    data = reset_res.json()

    assert data["operator"] == "OP1001"
    assert data["machine"] == "EXC001"
    assert data["current_task"] == "T001"
    assert data["telemetry"]["seatbelt_status"] == "Fastened"

    # Check tasks state
    tasks_res = client.get("/api/tasks")
    tasks = {t["task_id"]: t for t in tasks_res.json()}
    assert tasks["T001"]["status"] == "IN_PROGRESS"
    assert tasks["T002"]["status"] == "PENDING"
    assert tasks["T003"]["status"] == "PENDING"

    # Check unresolved incidents
    active_incidents = client.get("/api/incidents?status=ACTIVE").json()
    assert len(active_incidents) == 0


def test_repeated_reset_is_idempotent():
    """Repeated demo resets produce the exact same deterministic state."""
    res1 = client.post("/api/demo/reset").json()
    res2 = client.post("/api/demo/reset").json()

    assert res1["status"] == res2["status"]
    assert res1["current_task"] == res2["current_task"]
    assert res1["tasks_count"] == res2["tasks_count"]


# ---------------------------------------------------------------------------
# 5. KPI Summary Tests
# ---------------------------------------------------------------------------


def test_kpi_summary_returns_factual_counts():
    """KPI summary reflects exact database state without inflated claims."""
    kpi_res = client.get("/api/kpi/summary")
    assert kpi_res.status_code == 200
    kpis = kpi_res.json()

    assert "tasks_completed" in kpis
    assert "tasks_remaining" in kpis
    assert "tasks_at_risk" in kpis
    assert "recorded_idle_minutes" in kpis
    assert "unresolved_incidents" in kpis
    assert "support_requests_open" in kpis
    assert "support_requests_resolved" in kpis
    assert "training_modules_completed" in kpis

    # Verify no ungrounded claims
    assert "fuel_saved" not in kpis
    assert "productivity_percentage" not in kpis
    assert kpis["tasks_remaining"] == 3  # T001 in progress, T002 pending, T003 pending


# ---------------------------------------------------------------------------
# 6. Full Regression Tests (Phases 1 - 4)
# ---------------------------------------------------------------------------


def test_phase1_dashboard_regression():
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data["operator"]["id"] == "OP1001"
    assert data["machine"]["id"] == "EXC001"


def test_phase2_alert_engine_regression():
    # Update telemetry directly to unfastened
    client.post("/api/demo/telemetry", json={"seatbelt_status": "Unfastened"})
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    assert res.json()["active_alert_count"] >= 1


def test_phase3_prediction_regression():
    res = client.post(
        "/api/predict/task-time",
        json={
            "task_type": "Earth Excavation",
            "weather": "Sunny",
            "operator_skill": "Expert",
            "machine_age": 2.0,
            "baseline_estimate": 60,
        },
    )
    assert res.status_code == 200
    assert "predicted_minutes" in res.json()


def test_phase4_assistant_regression():
    res = client.post("/api/assistant", json={"message": "What is my current task?"})
    assert res.status_code == 200
    assert "Earth Excavation" in res.json()["answer"]


def test_phase4_training_regression():
    res = client.get("/api/training")
    assert res.status_code == 200
    assert len(res.json()) >= 3


def test_phase4_handover_regression():
    res = client.get("/api/handover")
    assert res.status_code == 200
    data = res.json()
    assert "summary_text" in data
    assert "tasks" in data
