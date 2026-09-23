from typing import Dict, Any, List
from sqlalchemy.orm import Session

from models import Task, Incident, SupportRequest, TrainingAttempt, TrainingModule, Machine, User, TelemetryRecord, TaskPauseEvent
from schemas import (
    ShiftHandoverResponse,
    ShiftHandoverTaskBreakdown,
    ShiftHandoverIncidentBreakdown,
    ShiftHandoverRequestBreakdown,
    ShiftHandoverTrainingBreakdown,
    TaskSchema,
    IncidentSchema,
    SupportRequestSchema,
    UsageInsight,
)
from services.training_service import training_service
from services.usage_insights import usage_insights_service
from services.alert_engine import parse_incident


class HandoverService:
    def get_handover_report(
        self, db: Session, machine_id: str = "EXC001", operator_id: str = "OP1001"
    ) -> ShiftHandoverResponse:
        # Operator and Machine facts
        operator = db.query(User).filter(User.id == operator_id).first()
        machine = db.query(Machine).filter(Machine.id == machine_id).first()
        telemetry = db.query(TelemetryRecord).filter(TelemetryRecord.machine_id == machine_id).order_by(TelemetryRecord.timestamp.desc()).first()

        shift_info: Dict[str, Any] = {
            "shift_id": "SHIFT-DAY-01",
            "name": "Day Shift Operations",
            "operator_id": operator_id,
            "operator_name": operator.name if operator else operator_id,
            "machine_id": machine_id,
            "machine_status": machine.status if machine else "OPERATIONAL",
            "engine_hours": telemetry.engine_hours if telemetry else (machine.engine_hours if machine else 0.0),
        }

        # Tasks breakdown
        all_tasks = db.query(Task).all()
        completed_tasks: List[TaskSchema] = []
        unfinished_tasks: List[TaskSchema] = []
        delays: List[Dict[str, Any]] = []

        for t in all_tasks:
            schema = TaskSchema.model_validate(t)
            if t.status.upper() == "COMPLETED":
                completed_tasks.append(schema)
            else:
                unfinished_tasks.append(schema)

            # Check for pause events in TaskPauseEvent table
            latest_pause = (
                db.query(TaskPauseEvent)
                .filter(TaskPauseEvent.task_id == t.task_id)
                .order_by(TaskPauseEvent.id.desc())
                .first()
            )
            pause_reason = latest_pause.reason if (latest_pause and latest_pause.resumed_at is None) else None
            pause_note = latest_pause.note if (latest_pause and latest_pause.resumed_at is None) else None
            has_pause = bool(pause_reason)

            is_at_risk = t.prediction_status in ["AT_RISK", "DELAYED"]
            variance = None
            if t.predicted_minutes is not None and t.planned_minutes is not None:
                variance = round(t.predicted_minutes - t.planned_minutes, 1)

            if has_pause or is_at_risk or (variance is not None and variance > 0):
                delays.append(
                    {
                        "task_id": t.task_id,
                        "task_type": t.task_type,
                        "status": t.status,
                        "pause_reason": pause_reason,
                        "pause_note": pause_note,
                        "planned_minutes": t.planned_minutes,
                        "predicted_minutes": t.predicted_minutes,
                        "variance_minutes": variance,
                        "prediction_status": t.prediction_status,
                    }
                )

        tasks_breakdown = ShiftHandoverTaskBreakdown(
            completed=completed_tasks,
            unfinished=unfinished_tasks,
        )

        # Incidents breakdown
        incidents = db.query(Incident).filter(Incident.machine_id == machine_id).all()
        unresolved_incidents: List[IncidentSchema] = []
        resolved_incidents: List[IncidentSchema] = []

        for inc in incidents:
            schema = IncidentSchema(**parse_incident(inc))
            if inc.status.upper() in ["ACTIVE", "ACKNOWLEDGED"]:
                unresolved_incidents.append(schema)
            else:
                resolved_incidents.append(schema)

        incidents_breakdown = ShiftHandoverIncidentBreakdown(
            unresolved=unresolved_incidents,
            resolved=resolved_incidents,
        )

        # Support Requests breakdown
        requests = db.query(SupportRequest).filter(SupportRequest.machine_id == machine_id).all()
        open_requests: List[SupportRequestSchema] = []
        resolved_requests: List[SupportRequestSchema] = []

        for req in requests:
            events_schemas = []
            schema = SupportRequestSchema(
                id=req.id,
                operator_id=req.operator_id,
                machine_id=req.machine_id,
                task_id=req.task_id,
                request_type=req.request_type,
                message=req.message,
                status=req.status,
                created_at=req.created_at,
                updated_at=req.updated_at,
                acknowledged_at=req.acknowledged_at,
                resolved_at=req.resolved_at,
                latest_response=None,
                events=events_schemas,
            )
            if req.status.upper() == "RESOLVED":
                resolved_requests.append(schema)
            else:
                open_requests.append(schema)

        requests_breakdown = ShiftHandoverRequestBreakdown(
            open=open_requests,
            resolved=resolved_requests,
        )

        # Training breakdown
        attempts = (
            db.query(TrainingAttempt)
            .filter(TrainingAttempt.operator_id == operator_id, TrainingAttempt.completed == True)
            .all()
        )
        completed_training: List[Dict[str, Any]] = []
        for att in attempts:
            mod = db.query(TrainingModule).filter(TrainingModule.id == att.module_id).first()
            completed_training.append(
                {
                    "module_id": att.module_id,
                    "title": mod.title if mod else att.module_id,
                    "score": att.score,
                    "total": att.total_questions,
                    "completed_at": att.completed_at.isoformat(),
                }
            )

        recommendations = training_service.get_recommendations(db, operator_id=operator_id)
        training_breakdown = ShiftHandoverTrainingBreakdown(
            completed=completed_training,
            recommended=recommendations,
        )

        # Usage insights
        insights_resp = usage_insights_service.analyze_machine_usage(db, machine_id=machine_id)
        raw_insights = insights_resp.get("insights", [])
        usage_insights = [
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

        # Generate deterministic factual summary text
        summary_lines = [
            f"SHIFT HANDOVER SUMMARY — Machine {machine_id} (Cat 336), Operator {operator_id}.",
            f"• Tasks: {len(completed_tasks)} completed, {len(unfinished_tasks)} unfinished.",
        ]

        if unfinished_tasks:
            current_names = ", ".join([f"{t.task_id} ({t.task_type} - {t.status})" for t in unfinished_tasks[:3]])
            summary_lines.append(f"  Active/Remaining tasks: {current_names}.")

        if delays:
            delay_details = "; ".join([f"{d['task_id']} ({d['task_type']}: {d['pause_reason'] or d['prediction_status']})" for d in delays[:2]])
            summary_lines.append(f"• Operational Delays: {len(delays)} recorded ({delay_details}).")
        else:
            summary_lines.append("• Operational Delays: None on schedule.")

        if unresolved_incidents:
            inc_titles = ", ".join([i.title for i in unresolved_incidents])
            summary_lines.append(f"• Alerts: {len(unresolved_incidents)} unresolved incident(s) requiring attention: {inc_titles}.")
        else:
            summary_lines.append("• Alerts: Zero active or unresolved incidents.")

        if open_requests:
            req_details = ", ".join([f"{r.id} ({r.request_type}: {r.status})" for r in open_requests])
            summary_lines.append(f"• Support Requests: {len(open_requests)} open request(s) ({req_details}).")
        else:
            summary_lines.append("• Support Requests: All supervisor tickets resolved.")

        if completed_training:
            summary_lines.append(f"• Operator Training: {len(completed_training)} module(s) completed during shift.")

        if usage_insights:
            insight_summaries = "; ".join([u.message for u in usage_insights])
            summary_lines.append(f"• Equipment Observations: {insight_summaries}.")

        summary_lines.append("RECOMMENDATION FOR INCOMING OPERATOR: Confirm seatbelt sensor status and check open logistics coordination before resuming excavation.")
        summary_text = "\n".join(summary_lines)

        return ShiftHandoverResponse(
            shift=shift_info,
            tasks=tasks_breakdown,
            delays=delays,
            incidents=incidents_breakdown,
            support_requests=requests_breakdown,
            training=training_breakdown,
            usage_insights=usage_insights,
            summary_text=summary_text,
        )


handover_service = HandoverService()
