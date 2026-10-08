from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.core.security import hash_password, create_access_token
from app.core.config import settings
from app.core.deps import get_current_user
from app.schemas import (
    RegisterRequest, VerifyOTPRequest, LoginRequest, AuthResponse, UserResponse
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )
    user = User(
        username=req.username,
        display_name=req.display_name,
        phone=req.phone,
        password_hash=hash_password(settings.MOCK_OTP),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/verify-otp", response_model=AuthResponse)
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if req.otp != settings.MOCK_OTP:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP. Use 123456",
        )
    token = create_access_token(data={"sub": str(user.id)})
    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=dict)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first.",
        )
    # In a real app, send OTP via SMS. Here we just acknowledge.
    return {"message": "OTP sent (use 123456)", "username": user.username}


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user
