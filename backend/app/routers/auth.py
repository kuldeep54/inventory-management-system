import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User
from app.schemas import (
    UserCreate, UserLogin, UserUpdate, UserResponse, UserAdminResponse,
    UserRoleUpdate, TokenResponse, ForgotPasswordRequest,
    ForgotPasswordResponse, ResetPasswordRequest,
)
from app.dependencies import (
    hash_password,
    verify_password,
    validate_password_strength,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    require_role,
    check_token_version,
)
from app.audit import log_audit
from app.ratelimit import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return ForgotPasswordResponse(
            message="If that email is registered, an OTP has been sent.",
        )

    otp = f"{random.randint(0, 999999):06d}"
    user.otp_code = otp
    user.otp_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)
    db.commit()

    # In production, send OTP via email/SMS instead of printing to console
    print(f"\n=== PASSWORD RESET OTP for {user.email} ===\n  OTP: {otp}\n  Expires: {user.otp_expires_at}\n============================\n")

    return ForgotPasswordResponse(
        message="If that email is registered, an OTP has been sent.",
    )


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid or expired OTP")

    if not user.otp_code or user.otp_code != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if not user.otp_expires_at or datetime.now(timezone.utc).replace(tzinfo=None) > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    validate_password_strength(payload.new_password)
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    return {"message": "Password reset successful. You can now sign in with your new password."}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    validate_password_strength(payload.password)

    is_first = db.query(User).count() == 0
    role = "admin" if is_first else "staff"

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=role,
    )
    db.add(user)
    db.flush()
    log_audit(
        db, user.id, user.full_name,
        "create", "user", user.id,
        f"Registered user '{user.full_name}' ({user.email}) with role '{user.role}'",
    )
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
        expires_in=60 * 24,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact an administrator.",
        )

    return TokenResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
        expires_in=60 * 24,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    payload: dict,
    db: Session = Depends(get_db),
):
    token = payload.get("refresh_token", "")
    token_data = decode_token(token)
    if token_data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = check_token_version(token_data, db)
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
        expires_in=60 * 24,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=TokenResponse)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.email and payload.email != current_user.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        current_user.email = payload.email

    if payload.full_name:
        current_user.full_name = payload.full_name

    password_changed = False
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="Current password is required to set a new password")
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        validate_password_strength(payload.new_password)
        current_user.password_hash = hash_password(payload.new_password)
        current_user.token_version += 1
        password_changed = True

    log_audit(
        db, current_user.id, current_user.full_name,
        "update", "user", current_user.id,
        "Updated own profile" + (" (password changed)" if password_changed else ""),
    )
    db.commit()
    db.refresh(current_user)

    return TokenResponse(
        access_token=create_access_token(current_user),
        refresh_token=create_refresh_token(current_user),
        expires_in=60 * 24,
        user=UserResponse.model_validate(current_user),
    )


@router.get("/users", response_model=List[UserAdminResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/role", response_model=UserAdminResponse)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    old_role = user.role
    user.role = payload.role
    user.token_version += 1
    log_audit(
        db, current_user.id, current_user.full_name,
        "update", "user", user.id,
        f"Changed user '{user.full_name}' role: {old_role} -> {payload.role}",
    )
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/toggle-active", response_model=UserAdminResponse)
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = not user.is_active
    user.token_version += 1
    status_label = "activated" if user.is_active else "deactivated"
    log_audit(
        db, current_user.id, current_user.full_name,
        "update", "user", user.id,
        f"{status_label.title()} user '{user.full_name}'",
    )
    db.commit()
    db.refresh(user)
    return user
