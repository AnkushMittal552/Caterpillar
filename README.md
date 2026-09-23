# ShiftMate – Caterpillar Smart Operator Assistant

[![Tests](https://img.shields.io/badge/tests-90%20passed-brightgreen.svg)]()
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-blue.svg)]()
[![Backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20SQLite-teal.svg)]()
[![Machine](https://img.shields.io/badge/equipment-Cat%20336%20Excavator-yellow.svg)]()
[![Release](https://img.shields.io/badge/release-hackathon--demo--ready-orange.svg)]()

> **ShiftMate** is an in-cab intelligent operator copilot and site collaboration platform designed for Caterpillar heavy construction machinery. It unifies deterministic safety alerting, grounded AI assistance, real-time supervisor coordination, contextual safety micro-training, and automated shift handovers.

---

## System Highlights

- **In-Cab Safety & Telemetry:** Monitors engine hours, load cycles, fuel usage, seatbelt status, and idling with deterministic alert rules and zero-latency incident deduplication.
- **Context-Grounded AI Assistant:** Powered by Google Gemini with an authoritative local fallback heuristic engine that answers questions about tasks, alerts, machine state, and operating procedures without hallucination.
- **Task Management & Duration Estimation:** Real-time task state transitions (`PENDING`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`) with delay tracking and multivariate regression duration forecasting.
- **Supervisor-Operator Collaboration:** Real-time Server-Sent Events (SSE) synchronization for logistics, truck dispatch, and maintenance requests with role-enforced approval workflows.
- **Contextual Micro-Training:** Real-time educational modules and interactive quizzes automatically triggered when safety or productivity anomalies occur during a shift.
- **Digital Shift Handover:** One-click automated shift summaries aggregating equipment telemetry, incident resolution history, and completed training for seamless operator transitions.
- **Deterministic Demo Controller:** Built-in simulation tool capable of injecting 8 operational scenarios (Seatbelt release, High idle, CAN-bus loss, Truck requests, Task delays) and resetting to baseline state instantly.

---

## Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                  IN-CAB ENVIRONMENT                               |
|                                                                                   |
|   +-----------------------+              +------------------------------------+   |
|   |   Cat 336 Telematics  |  CAN-Bus /   |        ShiftMate Edge Backend      |   |
|   |  - Engine Hours: 1524 |  J1939 JSON  |  - FastAPI Engine                  |   |
|   |  - Idle Time: 15m/65m | -----------> |  - Deterministic Alert Engine      |   |
|   |  - Seatbelt: Status   |              |  - Multivariate Prediction Service |   |
|   +-----------------------+              |  - Grounded AI Assistant (Gemini)  |   |
|                                          |  - Local Offline Heuristic Engine  |   |
|                                          |  - SQLite Persistent Store         |   |
|                                          +-----------------+------------------+   |
|                                                            |                      |
|                                                   SSE / REST (Localhost)          |
|                                                            |                      |
|                                          +-----------------v------------------+   |
|                                          |     Operator Touchscreen Tablet    |   |
|                                          |  - Live Cab Telemetry & Gauges     |   |
|                                          |  - Task Execution & Delay Reasons  |   |
|                                          |  - One-Click Support Dispatch      |   |
|                                          |  - Contextual Safety Quizzes       |   |
|                                          +------------------------------------+   |
+-----------------------------------------------------------------------------------+
                                            |
                                  Wireless Mesh / Cellular
                                            |
+-------------------------------------------v---------------------------------------+
|                              SITE SUPERVISOR DESK                                 |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                           Supervisor Web Portal                           |   |
|   |  - Fleet-wide Support Request Queue (Acknowledge / Respond / Resolve)     |   |
|   |  - Real-Time Safety & Productivity Alert Feed                             |   |
|   |  - Role-Enforced Approval Authority (HTTP 403 enforcement)                |   |
|   |  - Shift Handover Audit Archive & Immutable Event Trail                   |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## Quickstart & Local Setup

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**

### 2. Configure Environment (Optional)
Copy the example environment file:
```bash
cp .env.example .env
```
*(Note: ShiftMate works completely out of the box with zero external configuration. If `GEMINI_API_KEY` is omitted, the grounded offline heuristic engine activates automatically).*

### 3. Start Backend (FastAPI)
```bash
cd backend
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
- Backend API: `http://localhost:8000`
- Interactive Swagger Documentation: `http://localhost:8000/docs`

### 4. Start Frontend (React + Vite)
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Frontend Web App: `http://localhost:5173`

---

## Live Demo Scenarios & Walkthrough Guide

The application includes a **Demo Controller** panel accessible directly from the navigation bar labeled `[DEMO MODE]`.

| Scenario Action | What Happens in the System |
| :--- | :--- |
| **Normal Operations** | Restores all telemetry to nominal levels (Seatbelt fastened, Idle 15m). Clears reversible alerts. |
| **Seatbelt Event** | Simulates operator unfastening seatbelt while engine is active. Fires critical safety incident `SEATBELT_EVENT`. Recommends Seatbelt Training. |
| **High Idle Spurt** | Sets idle minutes to 65 (exceeding 45m demo threshold). Triggers productivity alert `HIGH_IDLE` and fuel-reduction insight. |
| **Weather Delay** | Pauses current task due to rainstorm. Updates prediction status to `DELAYED` and logs pause event. |
| **Truck Request** | Dispatches a logistics support request for an off-highway haul truck to the supervisor queue via SSE. |
| **Telemetry Lost** | Sets machine communication link to degraded (`machine_active: false`), proving safety alerts are not falsely cleared. |
| **Restore Normal** | Returns telemetry to safe parameters and auto-resolves reversible alerts. |
| **Reset Demo** | Restores the entire database deterministically to initial baseline state (OP1001, EXC001, T001, 1524.8 hrs). |

---

## 3-Minute Hackathon Demonstration Script

1. **Baseline (30s):** Open `http://localhost:5173`. Show Operator **OP1001** and Machine **EXC001 (Cat 336)**. Note the clean dashboard, nominal gauges (1524.8 engine hours, seatbelt fastened), and active task **T001 Earth Excavation**.
2. **Productivity Incident & AI Copilot (45s):** Click **Demo: High Idle**. Show the Productivity Alert and Idle Insight appear. Open the AI Assistant and ask: *"Why is my current task delayed?"* The assistant quotes exact database records with zero hallucination.
3. **Supervisor Workflow (45s):** Click **Demo: Truck Request**. Switch role to **Supervisor** in the top-right role switcher. The truck request appears in real-time. Click **Acknowledge**, enter a response (*"Truck dispatched, ETA 5m"*), and resolve it.
4. **Safety Incident & In-Cab Training (30s):** Click **Demo: Seatbelt Event**. Safety alert sounds. Operator re-fastens seatbelt and acknowledges. Navigate to **Training** tab, show auto-recommended module **Seatbelt Awareness**, and complete the 2-question quiz (Score: 2/2).
5. **Shift Handover & Reset (30s):** Click **Handover** tab. Click **Generate Shift Handover Report** to inspect the complete operational and audit summary. Click **Reset Demo** to return to pristine baseline.

---

## Verification & Testing

ShiftMate includes a full 90-test automated suite covering all six development phases:
```bash
cd backend
python -m pytest tests/ -v
```

To run the full end-to-end 26-step lifecycle scenario test:
```bash
python -m pytest tests/test_phase6_e2e.py -v
```

To verify the frontend build:
```bash
cd frontend
npm run build
```

---

## Documentation & References

- [Judge Q&A Preparation & Defensibility Guide](docs/judge-qna.md) – Answers to 18 critical technical questions.
- [3-Minute Hackathon Pitch Outline](docs/pitch-outline.md) – Presentation storyboard and architecture breakdown.
- [Phase 6 Finalization Report](docs/phase-6-report.md) – Test verification metrics, build analysis, and frozen scope sign-off.

---

## Data Source Disclosures & Transparency
- **`[SUPPLIED SAMPLE]`**: Baseline machine values (EXC001, 1524.8 hours, 3.8L fuel, initial tasks) derived from the hackathon problem statement.
- **`[SYNTHETIC DEMO]`**: Simulated operational variations, weather events, and injected CAN-bus scenarios.
- **`[USER-REPORTED]`**: Task pause reasons, operator support notes, and quiz submissions.
- **`[DEMO THRESHOLD]`**: 45-minute idle limit used for rapid demonstration of productivity alerting.