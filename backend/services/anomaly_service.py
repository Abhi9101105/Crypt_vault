from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import AuditAction, AuditLog


def score_event(
    db: Session,
    *,
    user_id: UUID | None,
    action: AuditAction,
    ip_address: str | None,
    metadata: dict,
) -> tuple[int, list[str]]:
    """Rule-based risk scoring with explainable alerts.

    Isolation Forest can be trained from the same features offline/periodically; the
    API keeps a deterministic rule fallback so alerts are explainable in production.
    """
    if user_id is None:
        return 0, []

    since = datetime.now(timezone.utc) - timedelta(minutes=10)
    since_short = datetime.now(timezone.utc) - timedelta(minutes=5)

    recent_count = db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.user_id == user_id, AuditLog.created_at >= since)
    ) or 0
    recent_downloads = db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.user_id == user_id,
            AuditLog.action == AuditAction.download,
            AuditLog.created_at >= since,
        )
    ) or 0
    recent_ips = db.scalars(
        select(AuditLog.ip_address)
        .where(AuditLog.user_id == user_id, AuditLog.created_at >= since, AuditLog.ip_address.is_not(None))
        .distinct()
    ).all()

    score = 0
    reasons: list[str] = []

    # High event velocity
    if recent_count >= 25:
        score += 25
        reasons.append("high event velocity")

    # Download burst
    if action == AuditAction.download and recent_downloads >= 10:
        score += 35
        reasons.append("download burst")

    # New source IP
    if ip_address and recent_ips and ip_address not in {str(ip) for ip in recent_ips}:
        score += 30
        reasons.append("new source IP")

    # File integrity failure
    if metadata.get("integrity") == "failed":
        score += 50
        reasons.append("file integrity failure")

    # Multiple login locations
    if action == AuditAction.login and len(recent_ips) >= 3:
        score += 20
        reasons.append("multiple login locations")

    # Failed login burst (>5 failed logins in 10 min)
    if action == AuditAction.failed_login:
        recent_failed = db.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.user_id == user_id,
                AuditLog.action == AuditAction.failed_login,
                AuditLog.created_at >= since,
            )
        ) or 0
        if recent_failed >= 5:
            score += 40
            reasons.append("failed login burst")

    # Delete burst (>3 deletes in 5 min)
    if action == AuditAction.delete:
        recent_deletes = db.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.user_id == user_id,
                AuditLog.action == AuditAction.delete,
                AuditLog.created_at >= since_short,
            )
        ) or 0
        if recent_deletes >= 3:
            score += 30
            reasons.append("delete burst")

    return min(score, 100), reasons
