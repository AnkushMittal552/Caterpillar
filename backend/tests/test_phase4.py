import pytest
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, Base, engine
from models import (
    Task,
    Incident,
    SupportRequest,
    TrainingModule,
    TrainingQuestion,
    TrainingAttempt,
    TelemetryRecord,
    utc_now,
)
from seed import seed_data

client = TestClient(app)


@pytest.fixture(scope="function", autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


# ===========================================================================
# 1. AI ASSISTANT TESTS
# ===========================================================================


def test_assistant_current_task_delayed_grounding():
    """1. Current-task question uses current task record, variance, and references."""
    response = client.post("/api/assistant", json={"message": "Why is my current task delayed?"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "references" in data
    # Grounded in current task T001
    assert any(ref["id"] == "T001" and ref["type"] == "task" for ref in data["references"])
    assert "Earth Excavation" in data["answer"] or "T001" in data["answer"]


def test_assistant_active_alerts_grounding():
    """2. Alerts question uses unresolved incidents."""
    response = client.post("/api/assistant", json={"message": "What alerts are active?"})
    assert response.status_code == 200
    data = response.json()
    # At least seatbelt alert exists in seeded state
    assert len(data["references"]) >= 1
    assert any(ref["type"] == "incident" for ref in data["references"])
    assert "Seatbelt" in data["answer"] or "alert" in data["answer"].lower()


def test_assistant_support_requests_grounding():
    """3. Support question uses current request state."""
    response = client.post("/api/assistant", json={"message": "What support requests are still open?"})
    assert response.status_code == 200
    data = response.json()
    # Seeded R001 is open
    assert any(ref["id"] == "R001" and ref["type"] == "support_request" for ref in data["references"])
    assert "R001" in data["answer"]


def test_assistant_does_not_invent_nonexistent_ids():
    """4. Assistant does not invent nonexistent task or incident IDs."""
    db = SessionLocal()
    real_task_ids = {t.task_id for t in db.query(Task).all()}
    real_inc_ids = {str(i.id) for i in db.query(Incident).all()}
    real_req_ids = {r.id for r in db.query(SupportRequest).all()}
    real_mod_ids = {m.id for m in db.query(TrainingModule).all()}
    db.close()

    response = client.post("/api/assistant", json={"message": "What tasks remain today?"})
    assert response.status_code == 200
    data = response.json()
    for ref in data["references"]:
        if ref["type"] == "task":
            assert ref["id"] in real_task_ids
        elif ref["type"] == "incident":
            assert ref["id"] in real_inc_ids
        elif ref["type"] == "support_request":
            assert ref["id"] in real_req_ids
        elif ref["type"] == "training":
            assert ref["id"] in real_mod_ids


def test_assistant_action_request_returns_confirmation_required():
    """5. Action request returns confirmation-required proposal without executing directly."""
    db = SessionLocal()
    initial_request_count = db.query(SupportRequest).count()
    db.close()

    response = client.post("/api/assistant", json={"message": "Request another truck for excavation"})
    assert response.status_code == 200
    data = response.json()
    assert data["proposed_action"] is not None
    action = data["proposed_action"]
    assert action["type"] == "CREATE_SUPPORT_REQUEST"
    assert action["requires_confirmation"] is True
    assert action["payload"]["request_type"] == "LOGISTICS"

    # Verify no ticket was auto-created in database
    db = SessionLocal()
    final_request_count = db.query(SupportRequest).count()
    db.close()
    assert final_request_count == initial_request_count


def test_assistant_fallback_when_no_api_key():
    """6. AI-provider failure / absent key uses deterministic grounded fallback."""
    response = client.post("/api/assistant", json={"message": "What is my predicted completion time?"})
    assert response.status_code == 200
    data = response.json()
    assert "T001" in data["answer"] or "Earth Excavation" in data["answer"]
    assert any(ref["type"] == "task" for ref in data["references"])


def test_assistant_empty_message_validation():
    """7. Assistant validates empty messages cleanly without crashing."""
    response = client.post("/api/assistant", json={"message": ""})
    assert response.status_code == 400


# ===========================================================================
# 2. TRAINING HUB TESTS
# ===========================================================================


def test_training_seatbelt_recommendation_when_seatbelt_event_exists():
    """8. Seatbelt event recommends Seatbelt Awareness module."""
    response = client.get("/api/training/recommendations")
    assert response.status_code == 200
    recs = response.json()
    assert any(r["module"]["id"] == "MOD_SEATBELT" for r in recs)
    seatbelt_rec = next(r for r in recs if r["module"]["id"] == "MOD_SEATBELT")
    assert "Recommended based on a relevant event" in seatbelt_rec["reason"]


def test_training_proximity_recommendation_when_proximity_event_exists():
    """9. Proximity event recommends Proximity Awareness module."""
    db = SessionLocal()
    prox_inc = Incident(
        id=9901,
        incident_type="PROXIMITY_EVENT",
        category="SAFETY",
        severity="HIGH",
        title="Proximity Breach Detected",
        message="Ground personnel inside swing radius.",
        machine_id="EXC001",
        status="ACTIVE",
        dedup_key="EXC001:PROXIMITY_EVENT:1",
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(prox_inc)
    db.commit()
    db.close()

    response = client.get("/api/training/recommendations")
    assert response.status_code == 200
    recs = response.json()
    assert any(r["module"]["id"] == "MOD_PROXIMITY" for r in recs)


def test_training_high_idle_recommendation():
    """10. High-idle condition recommends Understanding Idle Time module."""
    response = client.get("/api/training/recommendations")
    assert response.status_code == 200
    recs = response.json()
    # High idle (55 min) exists in seeded telemetry
    assert any(r["module"]["id"] == "MOD_IDLE" for r in recs)


def test_training_recommendation_deduplication():
    """11. Recommendations do not contain duplicate module entries."""
    response = client.get("/api/training/recommendations")
    assert response.status_code == 200
    recs = response.json()
    mod_ids = [r["module"]["id"] for r in recs]
    assert len(mod_ids) == len(set(mod_ids))


def test_training_quiz_scoring_and_persistence():
    """12 & 13. Quiz scoring is accurate and completed attempt persists in database."""
    # MOD_SEATBELT has Q_SB_1 (B) and Q_SB_2 (A)
    submit_payload = {
        "answers": {
            "Q_SB_1": "B",
            "Q_SB_2": "A",
        }
    }
    response = client.post("/api/training/MOD_SEATBELT/submit?operator_id=OP1001", json=submit_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 2
    assert data["total"] == 2
    assert data["completed"] is True

    # Confirm persistence via GET /api/training
    list_resp = client.get("/api/training?operator_id=OP1001")
    assert list_resp.status_code == 200
    modules = list_resp.json()
    sb_mod = next(m for m in modules if m["id"] == "MOD_SEATBELT")
    assert sb_mod["completed"] is True
    assert sb_mod["last_score"] == 2


def test_training_module_detail_endpoint():
    """Training module detail returns questions without exposing answers."""
    response = client.get("/api/training/MOD_SEATBELT")
    assert response.status_code == 200
    data = response.json()
    assert data["module"]["id"] == "MOD_SEATBELT"
    assert len(data["questions"]) == 2
    for q in data["questions"]:
        assert "choices" in q
        assert len(q["choices"]) > 0
        # Security: correct_answer must NOT be in public response
        assert "correct_answer" not in q


# ===========================================================================
# 3. SHIFT HANDOVER TESTS
# ===========================================================================


def test_handover_tasks_breakdown():
    """14 & 15. Completed and unfinished tasks appear correctly in handover."""
    response = client.get("/api/handover")
    assert response.status_code == 200
    data = response.json()
    tasks = data["tasks"]
    assert "completed" in tasks
    assert "unfinished" in tasks
    # T001 is IN_PROGRESS -> unfinished
    assert any(t["task_id"] == "T001" for t in tasks["unfinished"])


def test_handover_incidents_breakdown():
    """16 & 17. Unresolved and resolved incidents appear separated in handover."""
    response = client.get("/api/handover")
    assert response.status_code == 200
    data = response.json()
    incidents = data["incidents"]
    assert "unresolved" in incidents
    assert "resolved" in incidents
    assert len(incidents["unresolved"]) >= 1


def test_handover_support_requests_breakdown():
    """18 & 19. Open and resolved support requests appear separated in handover."""
    response = client.get("/api/handover")
    assert response.status_code == 200
    data = response.json()
    requests = data["support_requests"]
    assert "open" in requests
    assert "resolved" in requests
    assert any(r["id"] == "R001" for r in requests["open"])


def test_handover_training_completed_breakdown():
    """20. Training completions appear in handover report."""
    # Complete a module first
    client.post("/api/training/MOD_SEATBELT/submit?operator_id=OP1001", json={"answers": {"Q_SB_1": "B"}})

    response = client.get("/api/handover?operator_id=OP1001")
    assert response.status_code == 200
    data = response.json()
    training = data["training"]
    assert len(training["completed"]) >= 1
    assert any(c["module_id"] == "MOD_SEATBELT" for c in training["completed"])


def test_handover_counts_match_database():
    """21. Handover counts match database records."""
    db = SessionLocal()
    task_count = db.query(Task).count()
    inc_count = db.query(Incident).filter(Incident.machine_id == "EXC001").count()
    req_count = db.query(SupportRequest).filter(SupportRequest.machine_id == "EXC001").count()
    db.close()

    response = client.get("/api/handover")
    assert response.status_code == 200
    data = response.json()

    reported_tasks = len(data["tasks"]["completed"]) + len(data["tasks"]["unfinished"])
    reported_incidents = len(data["incidents"]["unresolved"]) + len(data["incidents"]["resolved"])
    reported_requests = len(data["support_requests"]["open"]) + len(data["support_requests"]["resolved"])

    assert reported_tasks == task_count
    assert reported_incidents == inc_count
    assert reported_requests == req_count


# ===========================================================================
# 4. REGRESSION TESTS (Phases 1, 2, 3)
# ===========================================================================


def test_phase1_dashboard_regression():
    """22. GET /api/dashboard remains intact with alert count and open request count."""
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "operator" in data
    assert "machine" in data
    assert "current_task" in data
    assert "telemetry" in data
    assert "active_alert_count" in data
    assert "open_request_count" in data


def test_phase2_task_transitions_regression():
    """23. Task workflow actions continue functioning."""
    response = client.post("/api/tasks/T002/start")
    assert response.status_code == 200
    assert response.json()["status"] == "IN_PROGRESS"


def test_phase2_incidents_regression():
    """24. Incidents list and acknowledge continue functioning."""
    list_resp = client.get("/api/incidents")
    assert list_resp.status_code == 200
    incidents = list_resp.json()
    assert len(incidents) > 0
    inc_id = incidents[0]["id"]
    ack_resp = client.post(f"/api/incidents/{inc_id}/acknowledge")
    assert ack_resp.status_code == 200


def test_phase3_prediction_regression():
    """25. Task-time prediction continues functioning."""
    payload = {
        "task_type": "Trenching",
        "weather": "Sunny",
        "operator_skill": "Expert",
        "machine_age": 2.0,
        "baseline_estimate": 45.0,
    }
    response = client.post("/api/predict/task-time", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_minutes" in data
    assert "baseline_estimate" in data
    assert "difference_minutes" in data


def test_phase3_usage_insights_regression():
    """26. Usage insights continue functioning."""
    response = client.get("/api/usage-insights")
    assert response.status_code == 200
    assert "insights" in response.json()


def test_phase3_support_requests_regression():
    """27. Support request workflow continues functioning."""
    payload = {
        "request_type": "MAINTENANCE",
        "message": "Routine grease check required",
        "task_id": "T001",
    }
    create_resp = client.post("/api/support-requests", json=payload)
    assert create_resp.status_code == 200
    req_id = create_resp.json()["id"]

    ack_resp = client.post(f"/api/support-requests/{req_id}/acknowledge")
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "ACKNOWLEDGED"
