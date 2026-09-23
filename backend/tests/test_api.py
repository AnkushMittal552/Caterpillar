import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app
from database import Base, engine
from seed import seed_data


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "ok",
        "service": "shiftmate",
    }


def test_dashboard_endpoint(client):
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()

    # Verify expected keys exist
    expected_keys = {
        "operator",
        "machine",
        "current_task",
        "telemetry",
        "active_alert_count",
        "open_request_count",
    }
    assert expected_keys.issubset(data.keys())

    # Verify seeded operator is OP1001
    assert data["operator"]["id"] == "OP1001"

    # Verify seeded machine is EXC001
    assert data["machine"]["id"] == "EXC001"
    assert data["machine"]["status"] == "ACTIVE"
    assert data["machine"]["engine_hours"] == 1524.8

    # Verify current task
    assert data["current_task"]["task_id"] == "T001"
    assert data["current_task"]["task_type"] == "Earth Excavation"
    assert data["current_task"]["status"] == "IN_PROGRESS"
    assert data["current_task"]["planned_minutes"] == 60
    assert data["current_task"]["predicted_minutes"] is None
    assert data["current_task"]["progress"] == 0

    # Verify telemetry snapshot
    telemetry = data["telemetry"]
    assert telemetry["engine_hours"] == 1524.8
    assert telemetry["fuel_used"] == 3.8
    assert telemetry["load_cycles"] == 2
    assert telemetry["idle_minutes"] == 55
    assert telemetry["seatbelt_status"] == "Unfastened"

    # Verify alert count reflects unresolved alerts and open requests remains 0
    assert data["active_alert_count"] >= 0
    assert data["open_request_count"] == 0


def test_tasks_endpoint(client):
    response = client.get("/api/tasks")
    assert response.status_code == 200
    tasks = response.json()

    # Verify tasks list has expected items
    task_ids = [t["task_id"] for t in tasks]
    assert "T001" in task_ids
    assert "T002" in task_ids
    assert "T003" in task_ids

    # Find specific tasks and check structure
    t001 = next(t for t in tasks if t["task_id"] == "T001")
    assert t001["task_type"] == "Earth Excavation"
    assert t001["status"] == "IN_PROGRESS"
    assert t001["planned_minutes"] == 60
    assert t001["predicted_minutes"] is None
    assert t001["progress"] == 0

    t002 = next(t for t in tasks if t["task_id"] == "T002")
    assert t002["task_type"] == "Trenching"
    assert t002["status"] == "PENDING"
    assert t002["planned_minutes"] == 45

    t003 = next(t for t in tasks if t["task_id"] == "T003")
    assert t003["task_type"] == "Material Loading"
    assert t003["status"] == "PENDING"
    assert t003["planned_minutes"] == 30
