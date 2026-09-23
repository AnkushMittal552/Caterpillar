"""
Audit Trail Service for ShiftMate.
Records immutable trace events for compliance, security, and supervisor auditing.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import AuditEvent
import json


def record_audit_event(
    db: Session,
    actor_id: str,
    actor_role: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: Optional[Any] = None,
) -> AuditEvent:
    """
    Persist an audit log entry. Details can be a dictionary (serialized to JSON) or string.
    """
    details_str = None
    if details is not None:
        if isinstance(details, (dict, list)):
            details_str = json.dumps(details)
        else:
            details_str = str(details)

    event = AuditEvent(
        actor_id=actor_id,
        actor_role=actor_role.upper(),
        action=action.upper(),
        entity_type=entity_type.upper(),
        entity_id=str(entity_id),
        timestamp=datetime.now(timezone.utc),
        details=details_str,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_audit_events(
    db: Session,
    actor_role: str = "SUPERVISOR",
    current_actor_id: str = "OP1001",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = 100,
) -> List[AuditEvent]:
    """
    Query audit trail.
    - SUPERVISOR: sees system-wide events.
    - OPERATOR: scoped to own actions or assigned entities.
    """
    query = db.query(AuditEvent)

    # Role-based scoping
    if actor_role.upper() == "OPERATOR":
        query = query.filter(
            (AuditEvent.actor_id == current_actor_id) |
            (AuditEvent.entity_type == "TASK") |
            (AuditEvent.entity_type == "INCIDENT")
        )

    if entity_type:
        query = query.filter(AuditEvent.entity_type == entity_type.upper())
    if entity_id:
        query = query.filter(AuditEvent.entity_id == str(entity_id))
    if actor_id:
        query = query.filter(AuditEvent.actor_id == actor_id)

    return query.order_by(AuditEvent.timestamp.desc()).limit(limit).all()
