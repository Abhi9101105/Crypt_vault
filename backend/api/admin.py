from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AuditAction, AuditLog, FlaggedEvent, User, VaultFile
from backend.schemas import AuditLogOut, FlaggedEventOut, Page
from backend.security import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-logs", response_model=Page)
def audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str | None = Query(None, description="Filter by action type"),
    user_id: str | None = Query(None, description="Filter by user ID"),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        try:
            action_enum = AuditAction(action)
            query = query.where(AuditLog.action == action_enum)
        except ValueError:
            pass
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[AuditLogOut.model_validate(row) for row in rows], total=total, page=page, page_size=page_size)


@router.get("/flagged-events", response_model=Page)
def flagged_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status", description="Filter by status: open, dismissed, investigating"),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(FlaggedEvent).order_by(FlaggedEvent.created_at.desc())
    if status_filter:
        query = query.where(FlaggedEvent.status == status_filter)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[FlaggedEventOut.model_validate(row) for row in rows], total=total, page=page, page_size=page_size)


@router.patch("/flagged-events/{event_id}")
def update_flagged_event(
    event_id: UUID,
    status_update: dict,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update flagged event status (open, dismissed, investigating)."""
    event = db.get(FlaggedEvent, event_id)
    if event is None:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Flagged event not found")
    new_status = status_update.get("status", "").strip()
    if new_status not in ("open", "dismissed", "investigating"):
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status value")
    event.status = new_status
    db.commit()
    return FlaggedEventOut.model_validate(event)


@router.get("/stats")
def admin_stats(
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Dashboard statistics for admin panel."""
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_files = db.scalar(select(func.count(VaultFile.id)).where(VaultFile.deleted_at.is_(None))) or 0
    total_users = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    uploads_today = db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.action == AuditAction.upload,
            AuditLog.created_at >= today_start,
        )
    ) or 0
    open_alerts = db.scalar(
        select(func.count(FlaggedEvent.id)).where(FlaggedEvent.status == "open")
    ) or 0
    downloads_today = db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.action == AuditAction.download,
            AuditLog.created_at >= today_start,
        )
    ) or 0
    failed_logins_today = db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.action == AuditAction.failed_login,
            AuditLog.created_at >= today_start,
        )
    ) or 0

    return {
        "total_files": total_files,
        "total_users": total_users,
        "uploads_today": uploads_today,
        "downloads_today": downloads_today,
        "open_alerts": open_alerts,
        "failed_logins_today": failed_logins_today,
    }
