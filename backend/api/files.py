from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AuditAction, FilePermission, User, VaultFile
from backend.schemas import FileOut, FileVersionOut, Page, ShareLinkOut, ShareLinkRequest, ShareUserRequest
from backend.security import get_current_user, request_ip
from backend.services.audit_service import record_audit
from backend.services.file_service import (
    create_or_update_file,
    create_share_link,
    decrypt_current_file,
    decrypt_file_version,
    file_permissions,
    list_accessible_files,
    list_file_shares,
    require_permission,
    revoke_share_link,
    revoke_user_access,
    rollback_file,
    share_with_user,
    soft_delete_file,
    validate_share_link,
)
from backend.websockets import manager

router = APIRouter(prefix="/files", tags=["files"])


def _refetch_file(db: Session, file_id):
    """Re-fetch a vault file with eager-loaded relationships after commit."""
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select as sa_select
    # Expire any cached instance so relationships are reloaded fresh
    cached = db.identity_map.get(db.get_bind().dialect.name and (VaultFile, (file_id,))) if hasattr(db, 'identity_map') else None
    db.expire_all()
    return db.scalar(
        sa_select(VaultFile)
        .options(selectinload(VaultFile.versions), selectinload(VaultFile.acls))
        .where(VaultFile.id == file_id)
        .execution_options(populate_existing=True)
    )


def to_file_out(vault_file, user: User) -> FileOut:
    current = next((v for v in vault_file.versions if v.id == vault_file.current_version_id), None)
    return FileOut(
        id=vault_file.id,
        original_filename=vault_file.original_filename,
        content_type=vault_file.content_type,
        created_at=vault_file.created_at,
        updated_at=vault_file.updated_at,
        current_version=FileVersionOut.model_validate(current) if current else None,
        permissions=file_permissions(vault_file, user),
    )


@router.get("", response_model=Page)
def list_files(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = list_accessible_files(db, current_user, page, page_size)
    # Client-side search filter (simple substring match)
    if search.strip():
        q = search.strip().lower()
        items = [item for item in items if q in item.original_filename.lower()]
        total = len(items)
    return Page(items=[to_file_out(item, current_user) for item in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=FileOut, status_code=201)
async def upload_file(
    request: Request,
    upload: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault_file = await create_or_update_file(db, owner=current_user, upload=upload)
    entry, flagged = record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.upload,
        resource_type="file",
        resource_id=vault_file.id,
        ip_address=request_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"filename": vault_file.original_filename},
    )
    db.commit()
    vault_file = _refetch_file(db, vault_file.id)
    await manager.notify_user(current_user.id, {"type": "file_uploaded", "file_id": str(vault_file.id)})
    if flagged:
        await manager.alert_admins({"audit_log_id": str(entry.id), "risk_score": entry.risk_score, "reason": flagged.reason})
    return to_file_out(vault_file, current_user)


@router.post("/upload-multi", response_model=list[FileOut], status_code=201)
async def upload_multiple_files(
    request: Request,
    uploads: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload multiple files at once. Each file is encrypted and stored independently."""
    results = []
    for upload in uploads:
        vault_file = await create_or_update_file(db, owner=current_user, upload=upload)
        record_audit(
            db,
            user_id=current_user.id,
            action=AuditAction.upload,
            resource_type="file",
            resource_id=vault_file.id,
            ip_address=request_ip(request),
            user_agent=request.headers.get("user-agent"),
            metadata={"filename": vault_file.original_filename},
        )
        results.append(vault_file)
    db.commit()
    await manager.notify_user(current_user.id, {"type": "files_uploaded", "count": len(results)})
    results = [_refetch_file(db, vf.id) for vf in results]
    return [to_file_out(vf, current_user) for vf in results]


@router.post("/{file_id}/versions", response_model=FileOut)
async def upload_new_version(
    file_id: UUID,
    request: Request,
    upload: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault_file = await create_or_update_file(db, owner=current_user, upload=upload, file_id=file_id)
    record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.upload,
        resource_type="file_version",
        resource_id=file_id,
        ip_address=request_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"filename": vault_file.original_filename},
    )
    db.commit()
    vault_file = _refetch_file(db, vault_file.id)
    return to_file_out(vault_file, current_user)


@router.get("/{file_id}/download")
async def download_file(
    file_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault_file = require_permission(db, file_id, current_user, FilePermission.read)
    plaintext, version = decrypt_current_file(db, vault_file)
    entry, flagged = record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.download,
        resource_type="file",
        resource_id=file_id,
        ip_address=request_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"filename": vault_file.original_filename, "version": version.version_number},
    )
    db.commit()
    if flagged:
        await manager.alert_admins({"audit_log_id": str(entry.id), "risk_score": entry.risk_score, "reason": flagged.reason})
    headers = {
        "Content-Disposition": f'attachment; filename="{vault_file.original_filename}"',
        "Content-Length": str(len(plaintext)),
    }
    return StreamingResponse(iter([plaintext]), media_type=vault_file.content_type, headers=headers)


@router.get("/{file_id}/versions/{version_id}/download")
async def download_version(
    file_id: UUID,
    version_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a specific version of a file."""
    vault_file = require_permission(db, file_id, current_user, FilePermission.read)
    plaintext, version = decrypt_file_version(db, vault_file, version_id)
    record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.download,
        resource_type="file_version",
        resource_id=version_id,
        ip_address=request_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"filename": vault_file.original_filename, "version": version.version_number},
    )
    db.commit()
    headers = {
        "Content-Disposition": f'attachment; filename="{vault_file.original_filename}"',
        "Content-Length": str(len(plaintext)),
    }
    return StreamingResponse(iter([plaintext]), media_type=vault_file.content_type, headers=headers)


@router.post("/{file_id}/verify")
def verify_file(file_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vault_file = require_permission(db, file_id, current_user, FilePermission.read)
    try:
        decrypt_current_file(db, vault_file)
        integrity = "passed"
    except Exception:
        record_audit(db, user_id=current_user.id, action=AuditAction.verify, resource_type="file", resource_id=file_id, metadata={"integrity": "failed"})
        db.commit()
        raise
    record_audit(db, user_id=current_user.id, action=AuditAction.verify, resource_type="file", resource_id=file_id, metadata={"integrity": integrity})
    db.commit()
    return {"status": "intact"}


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vault_file = require_permission(db, file_id, current_user, FilePermission.delete)
    soft_delete_file(db, vault_file)
    record_audit(db, user_id=current_user.id, action=AuditAction.delete, resource_type="file", resource_id=file_id,
                 metadata={"filename": vault_file.original_filename})
    db.commit()


@router.get("/{file_id}/versions", response_model=list[FileVersionOut])
def versions(file_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vault_file = require_permission(db, file_id, current_user, FilePermission.read)
    return [FileVersionOut.model_validate(version) for version in vault_file.versions]


@router.post("/{file_id}/versions/{version_id}/rollback", response_model=FileOut)
def rollback(
    file_id: UUID,
    version_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault_file = require_permission(db, file_id, current_user, FilePermission.write)
    old_version_id = vault_file.current_version_id
    vault_file = rollback_file(db, vault_file=vault_file, version_id=version_id)
    record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.rollback,
        resource_type="file_version",
        resource_id=version_id,
        metadata={"from_version": str(old_version_id), "to_version": str(version_id)},
    )
    db.commit()
    vault_file = _refetch_file(db, vault_file.id)
    return to_file_out(vault_file, current_user)


@router.post("/{file_id}/share/user", status_code=204)
def share_user(file_id: UUID, payload: ShareUserRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vault_file = require_permission(db, file_id, current_user, FilePermission.owner)
    share_with_user(db, vault_file=vault_file, target_username=payload.username, permissions=payload.permissions, granted_by=current_user)
    record_audit(db, user_id=current_user.id, action=AuditAction.share, resource_type="file", resource_id=file_id, metadata={"target": payload.username, "permissions": [p.value for p in payload.permissions]})
    db.commit()


@router.delete("/{file_id}/share/user/{username}", status_code=204)
def revoke_user(file_id: UUID, username: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Revoke all access for a specific user on a file."""
    vault_file = require_permission(db, file_id, current_user, FilePermission.owner)
    revoke_user_access(db, vault_file=vault_file, target_username=username)
    record_audit(db, user_id=current_user.id, action=AuditAction.revoke, resource_type="file", resource_id=file_id, metadata={"revoked_user": username})
    db.commit()


@router.get("/{file_id}/shares")
def get_file_shares(file_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all shares (users and links) for a file."""
    vault_file = require_permission(db, file_id, current_user, FilePermission.owner)
    return list_file_shares(db, vault_file)


@router.post("/{file_id}/share/link", response_model=ShareLinkOut)
def share_link(file_id: UUID, payload: ShareLinkRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vault_file = require_permission(db, file_id, current_user, FilePermission.owner)
    token, link = create_share_link(
        db,
        vault_file=vault_file,
        created_by=current_user,
        permission=payload.permission,
        expires_in_hours=payload.expires_in_hours,
    )
    record_audit(db, user_id=current_user.id, action=AuditAction.share, resource_type="share_link", resource_id=link.id)
    db.commit()
    return ShareLinkOut(token=token, expires_at=link.expires_at)


@router.delete("/{file_id}/share/link/{link_id}", status_code=204)
def revoke_link(file_id: UUID, link_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Revoke a share link."""
    vault_file = require_permission(db, file_id, current_user, FilePermission.owner)
    revoke_share_link(db, vault_file=vault_file, link_id=link_id)
    record_audit(db, user_id=current_user.id, action=AuditAction.revoke, resource_type="share_link", resource_id=link_id)
    db.commit()


# --- Public share link download (no auth required) ---

from fastapi import APIRouter as _AR

share_router = APIRouter(prefix="/share", tags=["share"])


@share_router.get("/{token}/download")
async def download_shared_file(token: str, db: Session = Depends(get_db)):
    """Download a file via a public share link. Validates expiry and revocation."""
    vault_file, link = validate_share_link(db, token)
    plaintext, version = decrypt_current_file(db, vault_file)
    record_audit(
        db,
        user_id=link.created_by_id,
        action=AuditAction.download,
        resource_type="share_link",
        resource_id=link.id,
        metadata={"filename": vault_file.original_filename, "version": version.version_number},
    )
    db.commit()
    headers = {
        "Content-Disposition": f'attachment; filename="{vault_file.original_filename}"',
        "Content-Length": str(len(plaintext)),
    }
    return StreamingResponse(iter([plaintext]), media_type=vault_file.content_type, headers=headers)
