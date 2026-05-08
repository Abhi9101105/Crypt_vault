from datetime import datetime, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import AuditAction, RefreshToken, Role, User
from backend.schemas import LoginRequest, RegisterRequest, TokenPair
from backend.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    request_ip,
    token_digest,
    validate_password_strength,
    validate_username,
    verify_password,
)
from backend.services.audit_service import record_audit


def register_user(db: Session, payload: RegisterRequest) -> User:
    username = validate_username(payload.username)
    validate_password_strength(payload.password)
    existing = db.scalar(select(User).where((User.username == username) | (User.email == payload.email)))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")
    user_count = db.scalar(select(func.count(User.id))) or 0
    user = User(
        username=username,
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        role=Role.admin if user_count == 0 else Role.user,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def issue_tokens(db: Session, user: User) -> TokenPair:
    refresh_token, digest, expires_at = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=digest, expires_at=expires_at))
    db.commit()
    return TokenPair(access_token=create_access_token(user), refresh_token=refresh_token)


def login(db: Session, payload: LoginRequest, request: Request) -> TokenPair:
    username = payload.username.strip()
    user = db.scalar(select(User).where(User.username == username, User.is_active.is_(True)))
    if user is None or not verify_password(payload.password, user.password_hash):
        # Log failed login attempt for security auditing
        failed_user = db.scalar(select(User).where(User.username == username)) if user is None else user
        record_audit(
            db,
            user_id=failed_user.id if failed_user else None,
            action=AuditAction.failed_login,
            resource_type="session",
            ip_address=request_ip(request),
            user_agent=request.headers.get("user-agent"),
            metadata={"username": username, "reason": "invalid_credentials"},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    user.last_login_at = datetime.now(timezone.utc)
    record_audit(
        db,
        user_id=user.id,
        action=AuditAction.login,
        resource_type="session",
        ip_address=request_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    return issue_tokens(db, user)


def refresh(db: Session, refresh_token: str) -> TokenPair:
    digest = token_digest(refresh_token)
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == digest))
    now = datetime.now(timezone.utc)
    # SQLite stores naive datetimes — make comparison safe
    expires_at = token.expires_at.replace(tzinfo=timezone.utc) if token and token.expires_at and token.expires_at.tzinfo is None else (token.expires_at if token else None)
    if token is None or token.revoked_at is not None or (expires_at and expires_at <= now):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.get(User, token.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")
    token.revoked_at = now
    record_audit(db, user_id=user.id, action=AuditAction.refresh, resource_type="session")
    db.commit()
    return issue_tokens(db, user)


def logout(db: Session, refresh_token: str) -> None:
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_digest(refresh_token)))
    if token and token.revoked_at is None:
        token.revoked_at = datetime.now(timezone.utc)
        record_audit(db, user_id=token.user_id, action=AuditAction.logout, resource_type="session")
        db.commit()
