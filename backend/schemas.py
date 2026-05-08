from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from backend.models import AuditAction, FilePermission, Role


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    role: Role
    created_at: datetime

    model_config = {"from_attributes": True}


class FileVersionOut(BaseModel):
    id: UUID
    version_number: int
    sha256: str
    size_bytes: int
    key_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FileOut(BaseModel):
    id: UUID
    original_filename: str
    content_type: str
    created_at: datetime
    updated_at: datetime
    current_version: FileVersionOut | None = None
    permissions: list[FilePermission] = Field(default_factory=list)


class ShareUserRequest(BaseModel):
    username: str
    permissions: list[FilePermission] = Field(default_factory=lambda: [FilePermission.read])


class ShareLinkRequest(BaseModel):
    permission: FilePermission = FilePermission.read
    expires_in_hours: int | None = Field(default=24, ge=1, le=24 * 30)


class ShareLinkOut(BaseModel):
    token: str
    expires_at: datetime | None


class AuditLogOut(BaseModel):
    id: UUID
    user_id: UUID | None
    action: AuditAction
    resource_type: str
    resource_id: UUID | None
    ip_address: str | None
    metadata_json: dict
    risk_score: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FlaggedEventOut(BaseModel):
    id: UUID
    audit_log_id: UUID
    user_id: UUID | None
    risk_score: int
    reason: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Page(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
