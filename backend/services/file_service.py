import re
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from backend.config import get_settings
from backend.crypto import EncryptedPayload, decrypt_payload, encrypt_bytes, sha256_hex, verify_blob_integrity
from backend.models import FileACL, FilePermission, FileVersion, ShareLink, User, VaultFile
from backend.security import token_digest

ALLOWED_EXTENSIONS = {
    ".pdf", ".txt", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    ".csv", ".xlsx", ".xls", ".json", ".xml", ".md", ".py", ".js", ".ts", ".html",
    ".css", ".zip", ".tar", ".gz", ".mp3", ".mp4", ".mov", ".wav", ".svg",
}

MAX_FILENAME_LENGTH = 200

_UNSAFE_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _sanitize_filename(filename: str) -> str:
    """Sanitize a filename: strip path components, normalize unicode, remove unsafe chars."""
    # Extract just the filename, stripping any directory components
    name = PurePosixPath(filename).name
    name = Path(name).name  # Also handles Windows-style paths
    # Normalize unicode
    name = unicodedata.normalize("NFC", name)
    # Remove unsafe characters
    name = _UNSAFE_CHARS.sub("_", name)
    # Collapse multiple underscores/dots
    name = re.sub(r"_{2,}", "_", name)
    name = name.strip(". _")
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Filename is required")
    if len(name) > MAX_FILENAME_LENGTH:
        stem = Path(name).stem[:MAX_FILENAME_LENGTH - 10]
        name = stem + Path(name).suffix
    return name


def _storage_path(storage_key: str) -> Path:
    root = get_settings().storage_dir.resolve()
    path = (root / storage_key).resolve()
    if root not in path.parents and path != root:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage path")
    return path


def _safe_extension(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=f"File type '{suffix}' is not allowed")
    return suffix


def require_permission(db: Session, file_id: UUID, user: User, permission: FilePermission) -> VaultFile:
    vault_file = db.scalar(
        select(VaultFile)
        .options(selectinload(VaultFile.versions), selectinload(VaultFile.acls))
        .where(VaultFile.id == file_id, VaultFile.deleted_at.is_(None))
    )
    if vault_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if user.role.value == "admin" or vault_file.owner_id == user.id:
        return vault_file
    allowed = {acl.permission for acl in vault_file.acls if acl.user_id == user.id}
    if FilePermission.owner in allowed or permission in allowed:
        return vault_file
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient file permission")


def file_permissions(vault_file: VaultFile, user: User) -> list[FilePermission]:
    if user.role.value == "admin" or vault_file.owner_id == user.id:
        return [FilePermission.owner, FilePermission.read, FilePermission.write, FilePermission.delete]
    return sorted({acl.permission for acl in vault_file.acls if acl.user_id == user.id}, key=lambda p: p.value)


async def create_or_update_file(db: Session, *, owner: User, upload: UploadFile, file_id: UUID | None = None) -> VaultFile:
    """Create a new file or add a version to an existing file.

    Versioning logic:
    - If file_id is provided, add a new version to that file.
    - If file_id is None but a file with the same name exists for this owner, auto-version it.
    - If file_id is None and no matching file exists, create a new file.
    """
    filename = _sanitize_filename(upload.filename or "")
    _safe_extension(filename)
    content = await upload.read()
    if len(content) > get_settings().max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="File is empty")

    if file_id:
        # Explicit version upload to a specific file
        vault_file = require_permission(db, file_id, owner, FilePermission.write)
    else:
        # Check if same-name file already exists for this owner → auto-version
        vault_file = db.scalar(
            select(VaultFile)
            .options(selectinload(VaultFile.versions), selectinload(VaultFile.acls))
            .where(
                VaultFile.owner_id == owner.id,
                VaultFile.original_filename == filename,
                VaultFile.deleted_at.is_(None),
            )
        )

    if vault_file:
        # Add new version to existing file
        version_number = (db.scalar(select(func.max(FileVersion.version_number)).where(FileVersion.file_id == vault_file.id)) or 0) + 1
        vault_file.content_type = upload.content_type or vault_file.content_type
    else:
        # Create new file entry
        vault_file = VaultFile(owner_id=owner.id, original_filename=filename, content_type=upload.content_type or "application/octet-stream")
        db.add(vault_file)
        db.flush()
        version_number = 1

    aad = f"{vault_file.id}:{version_number}:{filename}".encode("utf-8")
    encrypted = encrypt_bytes(content, aad=aad)
    storage_key = f"{vault_file.id}/{version_number}-{secrets.token_hex(16)}.svlt"
    path = _storage_path(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encrypted.to_bytes())

    version = FileVersion(
        file_id=vault_file.id,
        version_number=version_number,
        storage_key=storage_key,
        key_id=encrypted.key_id,
        nonce=encrypted.nonce,
        tag=encrypted.tag,
        sha256=sha256_hex(content),
        size_bytes=len(content),
        created_by_id=owner.id,
    )
    db.add(version)
    db.flush()
    vault_file.current_version_id = version.id
    vault_file.updated_at = datetime.now(timezone.utc)
    # Do NOT commit here — let the API layer own the transaction boundary
    return vault_file


def list_accessible_files(db: Session, user: User, page: int, page_size: int) -> tuple[list[VaultFile], int]:
    base = (
        select(VaultFile)
        .options(selectinload(VaultFile.versions), selectinload(VaultFile.acls))
        .where(VaultFile.deleted_at.is_(None))
        .order_by(VaultFile.updated_at.desc())
    )
    if user.role.value != "admin":
        shared_ids = select(FileACL.file_id).where(FileACL.user_id == user.id)
        base = base.where((VaultFile.owner_id == user.id) | (VaultFile.id.in_(shared_ids)))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = db.scalars(base.offset((page - 1) * page_size).limit(page_size)).all()
    return list(items), total


def decrypt_current_file(db: Session, vault_file: VaultFile) -> tuple[bytes, FileVersion]:
    version = db.get(FileVersion, vault_file.current_version_id)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File version not found")
    return _decrypt_version(vault_file, version)


def decrypt_file_version(db: Session, vault_file: VaultFile, version_id: UUID) -> tuple[bytes, FileVersion]:
    """Decrypt a specific version of a file."""
    version = db.scalar(select(FileVersion).where(FileVersion.id == version_id, FileVersion.file_id == vault_file.id))
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return _decrypt_version(vault_file, version)


def _decrypt_version(vault_file: VaultFile, version: FileVersion) -> tuple[bytes, FileVersion]:
    """Internal helper to decrypt a specific version."""
    blob_path = _storage_path(version.storage_key)
    if not blob_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encrypted file blob is missing from storage")
    blob_bytes = blob_path.read_bytes()
    if not verify_blob_integrity(blob_bytes):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Encrypted file blob is corrupt")
    payload = EncryptedPayload.from_bytes(blob_bytes)
    aad = f"{vault_file.id}:{version.version_number}:{vault_file.original_filename}".encode("utf-8")
    try:
        plaintext = decrypt_payload(payload, aad=aad)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Encrypted file failed integrity validation") from exc
    if sha256_hex(plaintext) != version.sha256:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plaintext digest mismatch — possible corruption")
    return plaintext, version


def soft_delete_file(db: Session, vault_file: VaultFile) -> None:
    """Soft-delete a file and clean up its encrypted blobs from disk."""
    vault_file.deleted_at = datetime.now(timezone.utc)
    # Clean up blob files from disk
    for version in vault_file.versions:
        try:
            blob_path = _storage_path(version.storage_key)
            if blob_path.exists():
                blob_path.unlink()
            # Clean up empty parent directories
            parent = blob_path.parent
            if parent.exists() and not any(parent.iterdir()):
                parent.rmdir()
        except OSError:
            pass  # Best-effort cleanup; file is already marked as deleted in DB


def share_with_user(db: Session, *, vault_file: VaultFile, target_username: str, permissions: list[FilePermission], granted_by: User) -> None:
    target = db.scalar(select(User).where(User.username == target_username, User.is_active.is_(True)))
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")
    if target.id == vault_file.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot share a file with its owner")
    for permission in permissions:
        exists = db.scalar(
            select(FileACL).where(FileACL.file_id == vault_file.id, FileACL.user_id == target.id, FileACL.permission == permission)
        )
        if exists is None:
            db.add(FileACL(file_id=vault_file.id, user_id=target.id, permission=permission, granted_by_id=granted_by.id))


def revoke_user_access(db: Session, *, vault_file: VaultFile, target_username: str) -> None:
    """Revoke all permissions for a user on a file."""
    target = db.scalar(select(User).where(User.username == target_username, User.is_active.is_(True)))
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")
    acls = db.scalars(select(FileACL).where(FileACL.file_id == vault_file.id, FileACL.user_id == target.id)).all()
    for acl in acls:
        db.delete(acl)


def create_share_link(db: Session, *, vault_file: VaultFile, created_by: User, permission: FilePermission, expires_in_hours: int | None) -> tuple[str, ShareLink]:
    token = secrets.token_urlsafe(32)
    link = ShareLink(
        file_id=vault_file.id,
        created_by_id=created_by.id,
        token_hash=token_digest(token),
        permission=permission,
        expires_at=(datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)) if expires_in_hours else None,
    )
    db.add(link)
    db.flush()
    return token, link


def validate_share_link(db: Session, token: str) -> tuple[VaultFile, ShareLink]:
    """Validate a share link token and return the associated file and link."""
    digest = token_digest(token)
    link = db.scalar(select(ShareLink).where(ShareLink.token_hash == digest))
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found or invalid")
    if link.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link has been revoked")
    exp = link.expires_at
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link has expired")
    vault_file = db.scalar(
        select(VaultFile)
        .options(selectinload(VaultFile.versions))
        .where(VaultFile.id == link.file_id, VaultFile.deleted_at.is_(None))
    )
    if vault_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return vault_file, link


def revoke_share_link(db: Session, *, vault_file: VaultFile, link_id: UUID) -> None:
    """Revoke a share link."""
    link = db.scalar(select(ShareLink).where(ShareLink.id == link_id, ShareLink.file_id == vault_file.id))
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
    link.revoked_at = datetime.now(timezone.utc)


def list_file_shares(db: Session, vault_file: VaultFile) -> dict:
    """List all users and share links for a file."""
    acls = db.scalars(select(FileACL).where(FileACL.file_id == vault_file.id)).all()
    links = db.scalars(
        select(ShareLink).where(ShareLink.file_id == vault_file.id, ShareLink.revoked_at.is_(None))
    ).all()
    # Group ACLs by user
    user_shares: dict[str, list[str]] = {}
    user_ids = {acl.user_id for acl in acls}
    users_map = {}
    if user_ids:
        users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
        users_map = {u.id: u.username for u in users}
    for acl in acls:
        username = users_map.get(acl.user_id, str(acl.user_id))
        user_shares.setdefault(username, []).append(acl.permission.value)
    return {
        "users": [{"username": k, "permissions": v} for k, v in user_shares.items()],
        "links": [
            {
                "id": str(link.id),
                "permission": link.permission.value,
                "expires_at": link.expires_at.isoformat() if link.expires_at else None,
                "created_at": link.created_at.isoformat(),
            }
            for link in links
        ],
    }


def rollback_file(db: Session, *, vault_file: VaultFile, version_id: UUID) -> VaultFile:
    version = db.scalar(select(FileVersion).where(FileVersion.id == version_id, FileVersion.file_id == vault_file.id))
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    # Verify the target version blob is intact before rollback
    blob_path = _storage_path(version.storage_key)
    if not blob_path.exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Version blob is missing — cannot rollback")
    if not verify_blob_integrity(blob_path.read_bytes()):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Version blob is corrupt — cannot rollback")
    vault_file.current_version_id = version.id
    vault_file.updated_at = datetime.now(timezone.utc)
    return vault_file
