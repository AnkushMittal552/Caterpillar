import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from models import TrainingModule, TrainingQuestion, TrainingAttempt, Incident, TelemetryRecord, utc_now
from schemas import (
    TrainingModuleSchema,
    TrainingModuleDetailSchema,
    TrainingQuestionPublic,
    QuestionChoice,
    TrainingRecommendation,
    TrainingSubmitResponse,
)


class TrainingService:
    def get_modules(self, db: Session, operator_id: str = "OP1001") -> List[TrainingModuleSchema]:
        modules = db.query(TrainingModule).filter(TrainingModule.active == True).all()
        results: List[TrainingModuleSchema] = []

        for mod in modules:
            q_count = db.query(TrainingQuestion).filter(TrainingQuestion.module_id == mod.id).count()
            latest_attempt = (
                db.query(TrainingAttempt)
                .filter(TrainingAttempt.module_id == mod.id, TrainingAttempt.operator_id == operator_id)
                .order_by(TrainingAttempt.completed_at.desc())
                .first()
            )

            results.append(
                TrainingModuleSchema(
                    id=mod.id,
                    title=mod.title,
                    description=mod.description,
                    category=mod.category,
                    estimated_minutes=mod.estimated_minutes,
                    active=mod.active,
                    question_count=q_count,
                    completed=bool(latest_attempt and latest_attempt.completed),
                    last_score=latest_attempt.score if latest_attempt else None,
                    total_questions=latest_attempt.total_questions if latest_attempt else q_count,
                )
            )

        return results

    def get_module_detail(
        self, db: Session, module_id: str, operator_id: str = "OP1001"
    ) -> Optional[TrainingModuleDetailSchema]:
        mod = db.query(TrainingModule).filter(TrainingModule.id == module_id, TrainingModule.active == True).first()
        if not mod:
            return None

        questions_db = db.query(TrainingQuestion).filter(TrainingQuestion.module_id == module_id).all()
        public_questions: List[TrainingQuestionPublic] = []

        for q in questions_db:
            try:
                choices_raw = json.loads(q.choices_json)
                choices = [QuestionChoice(key=c["key"], text=c["text"]) for c in choices_raw]
            except Exception:
                choices = []

            public_questions.append(
                TrainingQuestionPublic(
                    id=q.id,
                    module_id=q.module_id,
                    question=q.question,
                    choices=choices,
                )
            )

        latest_attempt = (
            db.query(TrainingAttempt)
            .filter(TrainingAttempt.module_id == mod.id, TrainingAttempt.operator_id == operator_id)
            .order_by(TrainingAttempt.completed_at.desc())
            .first()
        )

        mod_schema = TrainingModuleSchema(
            id=mod.id,
            title=mod.title,
            description=mod.description,
            category=mod.category,
            estimated_minutes=mod.estimated_minutes,
            active=mod.active,
            question_count=len(questions_db),
            completed=bool(latest_attempt and latest_attempt.completed),
            last_score=latest_attempt.score if latest_attempt else None,
            total_questions=latest_attempt.total_questions if latest_attempt else len(questions_db),
        )

        return TrainingModuleDetailSchema(module=mod_schema, questions=public_questions)

    def get_recommendations(
        self, db: Session, operator_id: str = "OP1001"
    ) -> List[TrainingRecommendation]:
        """Deterministic recommendation rules based on shift incidents and telemetry."""
        recommendations: List[TrainingRecommendation] = []
        modules_map = {m.id: m for m in self.get_modules(db, operator_id=operator_id)}

        # Check for SEATBELT_EVENT incidents (ACTIVE or unresolved)
        seatbelt_inc = (
            db.query(Incident)
            .filter(
                Incident.incident_type == "SEATBELT_EVENT",
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
            )
            .first()
        )
        if seatbelt_inc and "MOD_SEATBELT" in modules_map:
            mod_item = modules_map["MOD_SEATBELT"]
            recommendations.append(
                TrainingRecommendation(
                    module=mod_item,
                    reason="Recommended based on a relevant event recorded during this shift.",
                    trigger_event="SEATBELT_EVENT",
                )
            )

        # Check for PROXIMITY_EVENT incidents
        proximity_inc = (
            db.query(Incident)
            .filter(
                Incident.incident_type == "PROXIMITY_EVENT",
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
            )
            .first()
        )
        if proximity_inc and "MOD_PROXIMITY" in modules_map:
            mod_item = modules_map["MOD_PROXIMITY"]
            recommendations.append(
                TrainingRecommendation(
                    module=mod_item,
                    reason="Recommended based on a relevant event recorded during this shift.",
                    trigger_event="PROXIMITY_EVENT",
                )
            )

        # Check for HIGH_IDLE incidents or high idle telemetry
        idle_inc = (
            db.query(Incident)
            .filter(
                Incident.incident_type == "HIGH_IDLE",
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]),
            )
            .first()
        )
        recent_telemetry = (
            db.query(TelemetryRecord).order_by(TelemetryRecord.timestamp.desc()).first()
        )
        high_idle_observed = recent_telemetry and recent_telemetry.idle_minutes > 45

        if (idle_inc or high_idle_observed) and "MOD_IDLE" in modules_map:
            mod_item = modules_map["MOD_IDLE"]
            # Deduplicate if already added
            if not any(r.module.id == "MOD_IDLE" for r in recommendations):
                recommendations.append(
                    TrainingRecommendation(
                        module=mod_item,
                        reason="Recommended based on a relevant event recorded during this shift.",
                        trigger_event="HIGH_IDLE",
                    )
                )

        return recommendations

    def submit_quiz(
        self, db: Session, module_id: str, operator_id: str, answers: Dict[str, str]
    ) -> TrainingSubmitResponse:
        questions = db.query(TrainingQuestion).filter(TrainingQuestion.module_id == module_id).all()
        if not questions:
            raise ValueError(f"Module {module_id} has no questions or does not exist.")

        score = 0
        total = len(questions)
        feedback: List[Dict[str, Any]] = []

        for q in questions:
            user_answer = (answers.get(q.id) or "").strip().upper()
            is_correct = user_answer == q.correct_answer.strip().upper()
            if is_correct:
                score += 1
            feedback.append(
                {
                    "question_id": q.id,
                    "submitted": user_answer,
                    "correct": is_correct,
                    "explanation": q.explanation,
                }
            )

        # Persist completion
        attempt = TrainingAttempt(
            operator_id=operator_id,
            module_id=module_id,
            score=score,
            total_questions=total,
            completed=True,
            completed_at=utc_now(),
        )
        db.add(attempt)
        db.commit()

        return TrainingSubmitResponse(
            module_id=module_id,
            score=score,
            total=total,
            completed=True,
            feedback=feedback,
        )


training_service = TrainingService()
