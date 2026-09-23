import os
import re
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from models import Task, Incident, SupportRequest, TelemetryRecord, Machine, User, TaskPauseEvent
from schemas import (
    AssistantMessageResponse,
    ReferenceItem,
    ProposedAction,
    UsageInsight,
)
from services.training_service import training_service
from services.usage_insights import usage_insights_service
from services.prediction_service import prediction_service


class AssistantService:
    # -----------------------------------------------------------------------
    # Controlled Fact-Retrieval Functions
    # -----------------------------------------------------------------------

    def get_current_shift(self, db: Session) -> Dict[str, Any]:
        return {
            "shift_id": "SHIFT-DAY-01",
            "name": "Day Shift Operations",
            "hours": "07:00 - 15:30",
            "status": "ACTIVE",
        }

    def get_current_task(self, db: Session) -> Optional[Task]:
        # Priority: IN_PROGRESS or PAUSED
        task = (
            db.query(Task)
            .filter(Task.status.in_(["IN_PROGRESS", "PAUSED"]))
            .first()
        )
        if not task:
            task = db.query(Task).filter(Task.status == "PENDING").first()
        return task

    def get_remaining_tasks(self, db: Session) -> List[Task]:
        return (
            db.query(Task)
            .filter(Task.status.in_(["IN_PROGRESS", "PAUSED", "PENDING"]))
            .all()
        )

    def get_open_incidents(self, db: Session, machine_id: str = "EXC001") -> List[Incident]:
        return (
            db.query(Incident)
            .filter(
                Incident.machine_id == machine_id,
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
            )
            .all()
        )

    def get_usage_insights(self, db: Session, machine_id: str = "EXC001") -> List[UsageInsight]:
        insights_resp = usage_insights_service.analyze_machine_usage(db, machine_id=machine_id)
        raw_insights = insights_resp.get("insights", [])
        return [
            UsageInsight(
                type=i.get("type", "USAGE"),
                category=i.get("category", "PRODUCTIVITY"),
                severity=i.get("severity", "MEDIUM"),
                message=i.get("message", ""),
                evidence=i.get("evidence", {}),
            )
            if isinstance(i, dict)
            else i
            for i in raw_insights
        ]

    def get_task_prediction(self, db: Session, task: Optional[Task]) -> Dict[str, Any]:
        if not task:
            return {"predicted_minutes": None, "variance": None, "status": "UNAVAILABLE"}
        variance = None
        if task.predicted_minutes is not None and task.planned_minutes is not None:
            variance = round(task.predicted_minutes - task.planned_minutes, 1)
        return {
            "task_id": task.task_id,
            "task_type": task.task_type,
            "planned_minutes": task.planned_minutes,
            "predicted_minutes": task.predicted_minutes,
            "variance": variance,
            "status": task.prediction_status or "ON_TRACK",
        }

    def get_support_requests(self, db: Session, machine_id: str = "EXC001") -> List[SupportRequest]:
        return (
            db.query(SupportRequest)
            .filter(
                SupportRequest.machine_id == machine_id,
                SupportRequest.status.in_(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]),
            )
            .all()
        )

    def get_training_recommendations(self, db: Session, operator_id: str = "OP1001"):
        return training_service.get_recommendations(db, operator_id=operator_id)

    def get_handover_facts(self, db: Session, machine_id: str = "EXC001", operator_id: str = "OP1001") -> Dict[str, Any]:
        from services.handover_service import handover_service
        report = handover_service.get_handover_report(db, machine_id, operator_id)
        return report.model_dump()

    # -----------------------------------------------------------------------
    # Proposed Action Detection
    # -----------------------------------------------------------------------

    def detect_proposed_action(self, message: str, current_task_id: Optional[str]) -> Optional[ProposedAction]:
        msg = message.lower()
        if any(term in msg for term in ["truck", "logistics", "haul", "transport"]):
            return ProposedAction(
                type="CREATE_SUPPORT_REQUEST",
                requires_confirmation=True,
                payload={
                    "request_type": "LOGISTICS",
                    "task_id": current_task_id or "T001",
                    "message": "Additional haul truck required to support excavation operations.",
                },
            )
        if any(term in msg for term in ["maintenance", "mechanic", "repair", "service", "leak", "oil"]):
            return ProposedAction(
                type="CREATE_SUPPORT_REQUEST",
                requires_confirmation=True,
                payload={
                    "request_type": "MAINTENANCE",
                    "task_id": current_task_id or "T001",
                    "message": "Maintenance assistance requested for machine inspection.",
                },
            )
        if any(term in msg for term in ["material", "gravel", "fill", "sand", "dirt"]):
            return ProposedAction(
                type="CREATE_SUPPORT_REQUEST",
                requires_confirmation=True,
                payload={
                    "request_type": "MATERIAL",
                    "task_id": current_task_id or "T001",
                    "message": "Material delivery requested for task progression.",
                },
            )
        if any(term in msg for term in ["supervisor", "assistance", "help", "foreman"]):
            return ProposedAction(
                type="CREATE_SUPPORT_REQUEST",
                requires_confirmation=True,
                payload={
                    "request_type": "SUPERVISOR_ASSISTANCE",
                    "task_id": current_task_id or "T001",
                    "message": "Supervisor assistance requested at equipment location.",
                },
            )
        return None

    # -----------------------------------------------------------------------
    # Deterministic Grounded Fallback Answer Generator
    # -----------------------------------------------------------------------

    def generate_grounded_fallback(
        self, db: Session, message: str
    ) -> AssistantMessageResponse:
        msg = message.lower()
        current_task = self.get_current_task(db)
        open_incidents = self.get_open_incidents(db)
        open_requests = self.get_support_requests(db)
        remaining_tasks = self.get_remaining_tasks(db)

        # 1. Action proposal check (e.g. "Request another truck", "I need logistics support")
        if any(trigger in msg for term in ["request", "need", "call", "send", "order"] for trigger in [term]):
            proposed = self.detect_proposed_action(message, current_task.task_id if current_task else None)
            if proposed:
                action_type_desc = proposed.payload.get("request_type", "SUPPORT").replace("_", " ").lower()
                return AssistantMessageResponse(
                    answer=f"I have prepared a {action_type_desc} support request for your review. Please confirm to dispatch this ticket to your supervisor.",
                    references=[
                        ReferenceItem(
                            type="task",
                            id=current_task.task_id if current_task else "T001",
                            label=f"Active Task: {current_task.task_type if current_task else 'Current Task'}",
                        )
                    ],
                    proposed_action=proposed,
                )

        # 1b. Question: "What is my current task?" / "Current task"
        if ("current task" in msg or "my task" in msg or "active task" in msg) and "delay" not in msg and "why" not in msg:
            if not current_task:
                return AssistantMessageResponse(
                    answer="There is no active task currently in progress.",
                    references=[],
                )
            return AssistantMessageResponse(
                answer=f"Your current active task is {current_task.task_id}: {current_task.task_type} (Status: {current_task.status}, Progress: {current_task.progress}%).",
                references=[ReferenceItem(type="task", id=current_task.task_id, label=f"Active Task: {current_task.task_type}")],
            )

        # 2. Question: "Why is my current task delayed?"
        if "delayed" in msg or "why" in msg and ("task" in msg or "delay" in msg):
            if not current_task:
                return AssistantMessageResponse(
                    answer="There is no active task currently in progress.",
                    references=[],
                )

            pred = self.get_task_prediction(db, current_task)
            diff_text = f"{pred['variance']} min" if pred['variance'] is not None else "undetermined"
            planned_min = current_task.planned_minutes
            pred_min = current_task.predicted_minutes or planned_min

            reasons: List[str] = []
            refs: List[ReferenceItem] = [
                ReferenceItem(type="task", id=current_task.task_id, label=f"Task: {current_task.task_type}")
            ]

            reasons.append(
                f"The current task '{current_task.task_type}' ({current_task.task_id}) is estimated to take {pred_min} minutes against a planned duration of {planned_min} minutes (variance: +{diff_text})."
            )

            latest_pause = (
                db.query(TaskPauseEvent)
                .filter(TaskPauseEvent.task_id == current_task.task_id)
                .order_by(TaskPauseEvent.id.desc())
                .first()
            )
            if latest_pause and latest_pause.resumed_at is None:
                pause_name = latest_pause.reason.replace("_", " ").title()
                reasons.append(f"A pause event was logged with reason '{pause_name}'.")

            # Check matching support requests
            matching_reqs = [r for r in open_requests if r.task_id == current_task.task_id]
            if matching_reqs:
                for r in matching_reqs:
                    reasons.append(f"An open {r.request_type.lower()} request ({r.id}) is awaiting fulfillment: '{r.message}'.")
                    refs.append(ReferenceItem(type="support_request", id=r.id, label=f"Support Request: {r.id}"))
            elif open_requests:
                r = open_requests[0]
                reasons.append(f"A site support ticket ({r.id}) is also currently pending: '{r.message}'.")
                refs.append(ReferenceItem(type="support_request", id=r.id, label=f"Support Request: {r.id}"))

            return AssistantMessageResponse(
                answer=" ".join(reasons),
                references=refs,
            )

        # 3. Question: "What tasks remain today?" / "What tasks remain?"
        if "task" in msg and ("remain" in msg or "today" in msg or "left" in msg or "remaining" in msg):
            if not remaining_tasks:
                return AssistantMessageResponse(
                    answer="All scheduled shift tasks have been completed.",
                    references=[],
                )

            task_list_str = ", ".join(
                [f"{t.task_id} ({t.task_type} - {t.status})" for t in remaining_tasks]
            )
            refs = [ReferenceItem(type="task", id=t.task_id, label=t.task_type) for t in remaining_tasks]
            return AssistantMessageResponse(
                answer=f"There are {len(remaining_tasks)} unfinished task(s) on the shift schedule: {task_list_str}.",
                references=refs,
            )

        # 4. Question: "What alerts are active?" / "What incidents are unresolved?"
        if "alert" in msg or "incident" in msg or "unresolved" in msg or "active alert" in msg:
            if not open_incidents:
                return AssistantMessageResponse(
                    answer="There are no active or unresolved alerts at this time. Machine systems are operational.",
                    references=[],
                )

            incident_details = []
            refs = []
            for inc in open_incidents:
                incident_details.append(f"• {inc.title} ({inc.id}) - Status: {inc.status} ({inc.severity} severity).")
                refs.append(ReferenceItem(type="incident", id=str(inc.id), label=inc.title))

            return AssistantMessageResponse(
                answer=f"There are {len(open_incidents)} unresolved alert(s):\n" + "\n".join(incident_details),
                references=refs,
            )

        # 5. Question: "What support requests are still open?"
        if "support" in msg or "request" in msg and ("open" in msg or "ticket" in msg or "status" in msg):
            if not open_requests:
                return AssistantMessageResponse(
                    answer="There are currently no open support requests. All supervisor tickets are resolved.",
                    references=[],
                )

            req_details = []
            refs = []
            for req in open_requests:
                req_details.append(f"• {req.id}: {req.request_type} - '{req.message}' (Status: {req.status})")
                refs.append(ReferenceItem(type="support_request", id=req.id, label=f"Request {req.id}"))

            return AssistantMessageResponse(
                answer=f"There are {len(open_requests)} open support request(s):\n" + "\n".join(req_details),
                references=refs,
            )

        # 6. Question: "What is my predicted completion time?"
        if "predicted" in msg or "completion time" in msg or "how long" in msg:
            if not current_task:
                return AssistantMessageResponse(
                    answer="No active task is assigned to estimate completion time.",
                    references=[],
                )

            pred = self.get_task_prediction(db, current_task)
            answer = (
                f"Task {current_task.task_id} ({current_task.task_type}) has a planned duration of {current_task.planned_minutes} minutes "
                f"and is predicted to finish in {current_task.predicted_minutes or current_task.planned_minutes} minutes "
                f"(Status: {pred['status']})."
            )
            return AssistantMessageResponse(
                answer=answer,
                references=[ReferenceItem(type="task", id=current_task.task_id, label=current_task.task_type)],
            )

        # 7. Question: "What training is recommended?"
        if "training" in msg or "course" in msg or "quiz" in msg or "module" in msg:
            recs = self.get_training_recommendations(db)
            if not recs:
                return AssistantMessageResponse(
                    answer="No urgent training modules are recommended at this time based on current shift events.",
                    references=[],
                )

            rec_texts = []
            refs = []
            for r in recs:
                rec_texts.append(f"• {r.module.title}: {r.reason}")
                refs.append(ReferenceItem(type="training", id=r.module.id, label=r.module.title))

            return AssistantMessageResponse(
                answer=f"Recommended training based on shift activity:\n" + "\n".join(rec_texts),
                references=refs,
            )

        # 8. Question: "What should the next operator know?"
        if "next operator" in msg or "handover" in msg or "pass down" in msg or "know" in msg:
            handover_data = self.get_handover_facts(db)
            summary_text = handover_data.get("summary_text", "Check machine seatbelt and open tickets before operating.")
            refs = []
            if current_task:
                refs.append(ReferenceItem(type="task", id=current_task.task_id, label=current_task.task_type))
            if open_incidents:
                refs.append(ReferenceItem(type="incident", id=str(open_incidents[0].id), label=open_incidents[0].title))
            return AssistantMessageResponse(
                answer=summary_text,
                references=refs,
            )

        # Fallback for unrecognized questions: state overview
        overview = (
            f"Machine EXC001 is active on Day Shift with operator OP1001. "
            f"Active alerts: {len(open_incidents)}. "
            f"Remaining tasks: {len(remaining_tasks)}. "
            f"Open support tickets: {len(open_requests)}."
        )
        refs = []
        if current_task:
            refs.append(ReferenceItem(type="task", id=current_task.task_id, label=current_task.task_type))
        return AssistantMessageResponse(
            answer=overview,
            references=refs,
        )

    # -----------------------------------------------------------------------
    # Main Entrypoint: External LLM with Fallback
    # -----------------------------------------------------------------------

    def ask(self, db: Session, message: str) -> AssistantMessageResponse:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return self.generate_grounded_fallback(db, message)

        try:
            # Check for proposed action first so actions never trigger autonomous execution
            proposed = self.detect_proposed_action(message, None)
            if proposed and any(term in message.lower() for term in ["request", "send", "order", "call", "need"]):
                return self.generate_grounded_fallback(db, message)

            # Retrieve only necessary facts
            current_task = self.get_current_task(db)
            open_incidents = self.get_open_incidents(db)
            open_requests = self.get_support_requests(db)
            remaining_tasks = self.get_remaining_tasks(db)
            pred = self.get_task_prediction(db, current_task)

            context_facts = {
                "current_task": {
                    "task_id": current_task.task_id if current_task else None,
                    "task_type": current_task.task_type if current_task else None,
                    "status": current_task.status if current_task else None,
                    "planned_minutes": current_task.planned_minutes if current_task else None,
                    "predicted_minutes": current_task.predicted_minutes if current_task else None,
                    "pause_reason": (
                        db.query(TaskPauseEvent)
                        .filter(TaskPauseEvent.task_id == current_task.task_id, TaskPauseEvent.resumed_at.is_(None))
                        .order_by(TaskPauseEvent.id.desc())
                        .first()
                        .reason
                        if current_task and db.query(TaskPauseEvent).filter(TaskPauseEvent.task_id == current_task.task_id, TaskPauseEvent.resumed_at.is_(None)).first()
                        else None
                    ),
                    "variance": pred.get("variance"),
                } if current_task else None,
                "unresolved_incidents": [
                    {"id": str(i.id), "title": i.title, "severity": i.severity, "status": i.status}
                    for i in open_incidents
                ],
                "open_support_requests": [
                    {"id": r.id, "type": r.request_type, "message": r.message, "status": r.status}
                    for r in open_requests
                ],
                "remaining_tasks": [
                    {"task_id": t.task_id, "task_type": t.task_type, "status": t.status}
                    for t in remaining_tasks
                ],
            }

            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            system_prompt = (
                "You are ShiftMate AI, a Caterpillar Smart Operator Assistant.\n"
                "You must base your answer ONLY on the supplied application facts.\n"
                "RULES:\n"
                "- Do NOT invent machine values, IDs, or safety thresholds.\n"
                "- Always cite actual IDs in the references list.\n"
                "- Keep responses professional, factual, and concise.\n"
                "- If asked to create a support request or take machine actions, describe what you can prepare.\n"
                "Output must be valid JSON matching this schema:\n"
                "{\n"
                '  "answer": "string",\n'
                '  "references": [{"type": "task"|"incident"|"support_request", "id": "string", "label": "string"}]\n'
                "}"
            )

            prompt = f"APPLICATION FACTS:\n{json.dumps(context_facts, indent=2)}\n\nOPERATOR QUESTION:\n{message}"
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )

            result_json = json.loads(response.text)
            refs = [
                ReferenceItem(
                    type=r.get("type", "task"),
                    id=str(r.get("id", "")),
                    label=r.get("label"),
                )
                for r in result_json.get("references", [])
                if r.get("id")
            ]
            return AssistantMessageResponse(
                answer=result_json.get("answer", "Here is your operational summary."),
                references=refs,
                proposed_action=None,
            )
        except Exception:
            # Resilient fallback on any LLM error or rate limit
            return self.generate_grounded_fallback(db, message)


assistant_service = AssistantService()
