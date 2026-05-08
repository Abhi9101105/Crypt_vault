import hashlib
import hmac
import json
from uuid import UUID

from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.models import AuditAction, AuditLog, FlaggedEvent
from backend.services.anomaly_service import score_event


def _signature(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hmac.new(get_settings().audit_hmac_secret.encode("utf-8"), encoded, hashlib.sha256).hexdigest()


def record_audit(
    db: Session,
    *,
    user_id: UUID | None,
    action: AuditAction,
    resource_type: str,
    resource_id: UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> tuple[AuditLog, FlaggedEvent | None]:
    metadata = metadata or {}
    risk_score, reasons = score_event(
        db,
        user_id=user_id,
        action=action,
        ip_address=ip_address,
        metadata=metadata,
    )
    unsigned = {
        "user_id": user_id,
        "action": action.value,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "metadata_json": metadata,
        "risk_score": risk_score,
    }
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=metadata,
        risk_score=risk_score,
        hmac_signature=_signature(unsigned),
    )
    db.add(entry)
    db.flush()

    flagged = None
    if risk_score >= 60:
        flagged = FlaggedEvent(
            audit_log_id=entry.id,
            user_id=user_id,
            risk_score=risk_score,
            reason=", ".join(reasons) or "high-risk event",
        )
        db.add(flagged)
        db.flush()

    return entry, flagged


def verify_audit_log(entry: AuditLog) -> bool:
    unsigned = {
        "user_id": entry.user_id,
        "action": entry.action.value,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "ip_address": str(entry.ip_address) if entry.ip_address else None,
        "user_agent": entry.user_agent,
        "metadata_json": entry.metadata_json,
        "risk_score": entry.risk_score,
    }
    return hmac.compare_digest(entry.hmac_signature, _signature(unsigned))
