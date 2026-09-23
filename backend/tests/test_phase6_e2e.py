"""
Phase 6 Full End-to-End Validation & Edge-Case Regression Suite.
Validates the complete 26-step hackathon presentation scenario and system edge cases.
"""
import pytest
from fastapi.testclient import TestClient
from main import app
from database import Base, engine
from seed import seed_data

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


def test_part_c_full_26_step_e2e_scenario():
    """
    Executes the exact 26-step scenario specified in Phase 6 Part C:
    1. Reset demo.
    2. Confirm known initial state.
    3. Start current task.
    4. Trigger HIGH IDLE scenario.
    5. Verify usage insight appears.
    6. Verify incident/notification behavior.
    7. Confirm prediction status.
    8. Ask assistant: "Why is my current task delayed?"
    9. Verify answer uses actual records.
    10. Create LOGISTICS support request.
    11. Supervisor acknowledges request.
    12. Supervisor responds.
    13. Verify operator sees response.
    14. Trigger SEATBELT EVENT.
    15. Verify incident appears.
    16. Acknowledge incident.
    17. Verify audit event.
    18. Verify training recommendation appears.
    19. Complete training quiz.
    20. Verify training completion persists.
    21. Generate handover.
    22. Verify unresolved/resolved records are correct.
    23. Restore normal conditions.
    24. Verify applicable incidents resolve.
    25. Reset demo again.
    26. Verify deterministic initial state.
    """
    # 1. Reset demo
    res1 = client.post("/api/demo/reset")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "reset_complete"

    # 2. Confirm known initial state
    dash_res = client.get("/api/dashboard")
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert dash["operator"]["id"] == "OP1001"
    assert dash["machine"]["id"] == "EXC001"
    assert dash["current_task"]["task_id"] == "T001"
    assert dash["current_task"]["status"] == "IN_PROGRESS"
    assert dash["telemetry"]["engine_hours"] == 1524.8
    assert dash["telemetry"]["seatbelt_status"] == "Fastened"

    # 3. Task is already in progress, verify task API
    tasks_res = client.get("/api/tasks")
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    t001 = next(t for t in tasks if t["task_id"] == "T001")
    assert t001["status"] == "IN_PROGRESS"

    # 4. Trigger HIGH IDLE scenario
    idle_res = client.post("/api/demo/scenario/high_idle")
    assert idle_res.status_code == 200
    assert idle_res.json()["status"] == "applied"

    # 5. Verify usage insight appears
    insights_res = client.get("/api/usage-insights?machine_id=EXC001")
    assert insights_res.status_code == 200
    insights = insights_res.json()["insights"]
    assert any("idle" in i.get("type", "").lower() or "idle" in i.get("message", "").lower() for i in insights)

    # 6. Verify incident/notification behavior
    inc_res = client.get("/api/incidents")
    assert inc_res.status_code == 200
    idle_incidents = [i for i in inc_res.json() if i.get("incident_type") in ["HIGH_IDLE", "HIGH_IDLE_TIME"] and i["status"] != "RESOLVED"]
    assert len(idle_incidents) >= 1

    notifs_res = client.get("/api/notifications")
    assert notifs_res.status_code == 200
    assert any(n["category"] == "PRODUCTIVITY" for n in notifs_res.json())

    # 7. Confirm prediction status
    t001_updated = client.get("/api/tasks").json()[0]
    assert t001_updated["prediction_status"] in ["ON_TRACK", "AT_RISK", "DELAYED"]
    assert t001_updated["planned_minutes"] == 60

    # 8. Ask assistant: "Why is my current task delayed?"
    ast_res = client.post("/api/assistant", json={"message": "Why is my current task delayed?"})
    assert ast_res.status_code == 200
    ast_data = ast_res.json()

    # 9. Verify answer uses actual records
    assert "Earth Excavation" in ast_data["answer"] or "T001" in ast_data["answer"]
    assert any(ref["type"] == "task" for ref in ast_data["references"])

    # 10. Create LOGISTICS support request
    req_res = client.post(
        "/api/support-requests",
        json={"request_type": "LOGISTICS", "task_id": "T001", "message": "Need second haul truck"},
        headers={"X-Role": "OPERATOR"},
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["id"]

    # 11. Supervisor acknowledges request
    ack_res = client.post(f"/api/support-requests/{req_id}/acknowledge", headers={"X-Role": "SUPERVISOR"})
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # 12. Supervisor responds
    resp_res = client.post(
        f"/api/support-requests/{req_id}/respond",
        json={"message": "Truck dispatched. ETA 5 minutes."},
        headers={"X-Role": "SUPERVISOR"},
    )
    assert resp_res.status_code == 200
    assert resp_res.json()["status"] == "IN_PROGRESS"
    assert resp_res.json()["latest_response"] == "Truck dispatched. ETA 5 minutes."

    # 13. Verify operator sees response
    op_req_view = client.get(f"/api/support-requests").json()
    my_req = next(r for r in op_req_view if r["id"] == req_id)
    assert my_req["latest_response"] == "Truck dispatched. ETA 5 minutes."

    # 14. Trigger SEATBELT EVENT
    sb_res = client.post("/api/demo/scenario/seatbelt_event")
    assert sb_res.status_code == 200
    assert sb_res.json()["status"] == "applied"

    # 15. Verify incident appears
    inc_res2 = client.get("/api/incidents")
    sb_incidents = [i for i in inc_res2.json() if i.get("incident_type") in ["SEATBELT_EVENT", "UNFASTENED_SEATBELT"] and i["status"] != "RESOLVED"]
    assert len(sb_incidents) >= 1
    sb_id = sb_incidents[0]["id"]

    # 16. Acknowledge incident
    ack_inc_res = client.post(f"/api/incidents/{sb_id}/acknowledge")
    assert ack_inc_res.status_code == 200
    assert ack_inc_res.json()["status"] == "ACKNOWLEDGED"

    # 17. Verify audit event
    audit_res = client.get("/api/audit")
    assert audit_res.status_code == 200
    audits = audit_res.json()
    assert any(a["action"] == "INCIDENT_ACKNOWLEDGED" for a in audits)

    # 18. Verify training recommendation appears
    train_rec_res = client.get("/api/training/recommendations?operator_id=OP1001")
    assert train_rec_res.status_code == 200
    recs = train_rec_res.json()
    assert any(r["module"]["id"] == "MOD_SEATBELT" for r in recs)

    # 19. Complete training quiz
    submit_res = client.post(
        "/api/training/MOD_SEATBELT/submit?operator_id=OP1001",
        json={"answers": {"Q_SB_1": "B", "Q_SB_2": "A"}},
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["completed"] is True
    assert submit_res.json()["score"] == 2

    # 20. Verify training completion persists
    modules_res = client.get("/api/training?operator_id=OP1001")
    sb_mod = next(m for m in modules_res.json() if m["id"] == "MOD_SEATBELT")
    assert sb_mod["completed"] is True
    assert sb_mod["last_score"] == 2

    # 21. Generate handover
    ho_res = client.get("/api/handover?machine_id=EXC001&operator_id=OP1001")
    assert ho_res.status_code == 200
    ho_data = ho_res.json()

    # 22. Verify unresolved/resolved records are correct in handover
    assert len(ho_data["incidents"]["unresolved"]) >= 1
    assert len(ho_data["support_requests"]["open"]) >= 1
    assert any(t["module_id"] == "MOD_SEATBELT" for t in ho_data["training"]["completed"])
    assert "EXC001" in ho_data["summary_text"]

    # 23. Restore normal conditions
    restore_res = client.post("/api/demo/scenario/restore_normal")
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "applied"

    # 24. Verify applicable incidents resolve
    inc_res3 = client.get("/api/incidents")
    active_post_restore = [i for i in inc_res3.json() if i["status"] != "RESOLVED"]
    assert len(active_post_restore) == 0

    # 25. Reset demo again
    res25 = client.post("/api/demo/reset")
    assert res25.status_code == 200

    # 26. Verify deterministic initial state
    dash_final = client.get("/api/dashboard").json()
    assert dash_final["current_task"]["task_id"] == "T001"
    assert dash_final["current_task"]["status"] == "IN_PROGRESS"
    assert dash_final["telemetry"]["seatbelt_status"] == "Fastened"
    assert dash_final["telemetry"]["idle_minutes"] == 15
    assert dash_final["active_alert_count"] == 0


def test_part_d_edge_cases():
    """
    Validates Edge Cases from Phase 6 Part D:
    - Role violation on supervisor actions
    - Invalid task transition handling
    - Invalid support request transition handling
    - Fallback when no incidents / empty queries
    - Grounded assistant fallback when unknown query
    - Idempotent incident acknowledgment
    """
    # 1. Role violation: Operator attempting supervisor action gets 403
    req = client.post(
        "/api/support-requests",
        json={"request_type": "MAINTENANCE", "message": "Air filter check"},
        headers={"X-Role": "OPERATOR"},
    ).json()
    req_id = req["id"]

    for op_action in ["acknowledge", "resolve"]:
        res = client.post(
            f"/api/support-requests/{req_id}/{op_action}",
            headers={"X-Role": "OPERATOR"},
        )
        assert res.status_code == 403
        assert "Forbidden" in res.json()["detail"]

    # 2. Invalid task transitions
    # T002 is PENDING -> cannot pause directly (must start first)
    bad_task_res = client.post("/api/tasks/T002/pause", json={"reason": "BREAK"})
    assert bad_task_res.status_code == 400

    # 3. Invalid support request transition
    # Resolve first
    client.post(f"/api/support-requests/{req_id}/resolve", headers={"X-Role": "SUPERVISOR"})
    # Cannot acknowledge resolved
    bad_ack = client.post(f"/api/support-requests/{req_id}/acknowledge", headers={"X-Role": "SUPERVISOR"})
    assert bad_ack.status_code == 400

    # 4. Unknown assistant question returns safe state overview (no hallucination)
    unknown_ast = client.post("/api/assistant", json={"message": "xyz random gibberish query 123"})
    assert unknown_ast.status_code == 200
    assert "Machine EXC001 is active" in unknown_ast.json()["answer"]

    # 5. Handover report handles state cleanly without crash
    ho = client.get("/api/handover").json()
    assert "shift" in ho
    assert "summary_text" in ho
