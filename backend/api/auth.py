from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserOut
from backend.security import get_current_user
from backend.services.auth_service import login, logout, refresh, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(db, payload)


@router.post("/login", response_model=TokenPair)
def login_route(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return login(db, payload, request)


@router.post("/refresh", response_model=TokenPair)
def refresh_route(payload: RefreshRequest, db: Session = Depends(get_db)):
    return refresh(db, payload.refresh_token)


@router.post("/logout", status_code=204)
def logout_route(payload: RefreshRequest, db: Session = Depends(get_db)):
    logout(db, payload.refresh_token)


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return current_user
