"""
Unified Notification Center Service for ShiftMate.
Aggregates operational notifications across safety, task workflow, supervisor dispatch, and training.
Broadcasts real-time events to connected clients.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import Notification
from services.event_bus import event_bus


def create_notification(
    db: Session,
    category: str,
    priority: str,
    title: str,
    message: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
) -> Notification:
    """
    Create a unified notification and broadcast it in real time via event_bus.
    """
    count = db.query(Notification).count()
    new_id = f"NOTIF-{count + 1:04d}"
    while db.query(Notification).filter(Notification.id == new_id).first():
        count += 1
        new_id = f"NOTIF-{count + 1:04d}"

    notif = Notification(
        id=new_id,
        category=category.upper(),
        priority=priority.upper(),
        title=title,
        message=message,
        created_at=datetime.now(timezone.utc),
        read=False,
        reference_type=reference_type.lower() if reference_type else None,
        reference_id=str(reference_id) if reference_id else None,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Broadcast notification to clients
    event_bus.broadcast_sync("NOTIFICATION_CREATED", {
        "id": notif.id,
        "category": notif.category,
        "priority": notif.priority,
        "title": notif.title,
        "message": notif.message,
        "reference_type": notif.reference_type,
        "reference_id": notif.reference_id,
        "created_at": notif.created_at.isoformat() if hasattr(notif.created_at, "isoformat") else str(notif.created_at),
    })

    return notif


def list_notifications(
    db: Session,
    unread_only: bool = False,
    category: Optional[str] = None,
    limit: int = 50,
) -> List[Notification]:
    """List recent notifications with optional unread and category filters."""
    query = db.query(Notification)
    if unread_only:
        query = query.filter(Notification.read == False)
    if category:
        query = query.filter(Notification.category == category.upper())

    return query.order_by(Notification.created_at.desc()).limit(limit).all()


def mark_as_read(db: Session, notif_id: str) -> Optional[Notification]:
    """Mark a specific notification as read."""
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if notif:
        notif.read = True
        db.commit()
        db.refresh(notif)
    return notif


def mark_all_read(db: Session) -> int:
    """Mark all unread notifications as read. Returns count of marked items."""
    unreads = db.query(Notification).filter(Notification.read == False).all()
    count = len(unreads)
    for n in unreads:
        n.read = True
    db.commit()
    return count
