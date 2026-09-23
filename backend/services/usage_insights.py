from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from models import TelemetryRecord

DEMO_IDLE_THRESHOLD_MINUTES = 45


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


class UsageInsightsService:
    def __init__(self, idle_threshold_minutes: int = DEMO_IDLE_THRESHOLD_MINUTES):
        self.idle_threshold_minutes = idle_threshold_minutes

    def analyze_machine_usage(
        self,
        db: Session,
        machine_id: str,
        current_telemetry: Optional[TelemetryRecord] = None,
    ) -> Dict[str, Any]:
        """
        Analyze current machine telemetry and generate explainable, evidence-grounded insights.
        Uses observational phrasing without unsubstantiated diagnostic claims.
        """
        if current_telemetry is None:
            current_telemetry = (
                db.query(TelemetryRecord)
                .filter(TelemetryRecord.machine_id == machine_id)
                .order_by(TelemetryRecord.id.desc())
                .first()
            )

        if not current_telemetry:
            return {
                "machine_id": machine_id,
                "generated_at": utc_now_iso(),
                "insights": [],
            }

        insights: List[Dict[str, Any]] = []

        # 1. HIGH_IDLE Insight
        if (
            current_telemetry.idle_minutes is not None
            and current_telemetry.idle_minutes > self.idle_threshold_minutes
        ):
            insights.append({
                "type": "HIGH_IDLE",
                "category": "PRODUCTIVITY",
                "severity": "MEDIUM",
                "message": "High idling observed during the selected measurement period.",
                "evidence": {
                    "idle_minutes": current_telemetry.idle_minutes,
                    "demo_threshold_minutes": self.idle_threshold_minutes,
                    "load_cycles": current_telemetry.load_cycles,
                },
            })

        # 2. UNUSUAL_FUEL_USAGE Insight (Comparison against demonstration profile)
        # Observational only: does NOT claim mechanical defect
        if current_telemetry.fuel_used is not None and current_telemetry.fuel_used > 3.5:
            insights.append({
                "type": "UNUSUAL_FUEL_USAGE",
                "category": "PRODUCTIVITY",
                "severity": "LOW",
                "message": "Fuel usage differs from the selected comparison history.",
                "evidence": {
                    "fuel_used_liters": round(current_telemetry.fuel_used, 1),
                    "baseline_expected_liters": 2.5,
                    "comparison_basis": "demo_equipment_profile",
                },
            })

        return {
            "machine_id": machine_id,
            "generated_at": utc_now_iso(),
            "insights": insights,
        }


usage_insights_service = UsageInsightsService()
