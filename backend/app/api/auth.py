from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.user import User, UserRole

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    role: Optional[str] = "Radiologist"
    department: Optional[str] = None
    institution: Optional[str] = None
    licenseNumber: Optional[str] = None
    bio: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: Optional[str] = None
    token: str
    newPassword: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str = "Radiologist"
    department: Optional[str] = None
    institution: Optional[str] = None
    licenseNumber: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    email: str
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    institution: Optional[str] = None
    licenseNumber: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    newPassword: Optional[str] = None
    currentPassword: Optional[str] = None

class AuthResponse(BaseModel):
    success: bool
    token: str
    user: UserResponse

import hashlib
from datetime import datetime
from sqlalchemy import func

def hash_password(password: str) -> str:
    salt = "radix_clinical_salt_2026"
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()

def verify_password(plain: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return True
    return hash_password(plain) == hashed

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please provide a valid clinical email.")
    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required.")

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Please create an account first."
        )

    # Verify password
    if user.password_hash and not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password for this account. Please try again."
        )

    token = f"radix_jwt_{user.id}_{int(datetime.now().timestamp())}"
    return AuthResponse(
        success=True,
        token=token,
        user=UserResponse(
            id=f"usr_radix_{user.id}",
            email=user.email,
            name=user.name,
            role="Radiologist",
            department=user.department,
            institution=user.institution,
            licenseNumber=getattr(user, "license_number", None),
            bio=getattr(user, "bio", None),
            avatar=user.avatar
        )
    )

@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please provide a valid clinical email.")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please sign in instead."
        )

    name = payload.name.strip() if (payload.name and payload.name.strip()) else clean_email.split("@")[0].title()
    user = User(
        name=name,
        email=clean_email,
        role="Radiologist",
        department=payload.department.strip() if (payload.department and payload.department.strip()) else None,
        institution=payload.institution.strip() if (payload.institution and payload.institution.strip()) else None,
        license_number=payload.licenseNumber.strip() if (payload.licenseNumber and payload.licenseNumber.strip()) else None,
        bio=payload.bio.strip() if (payload.bio and payload.bio.strip()) else None,
        password_hash=hash_password(payload.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = f"radix_jwt_{user.id}_{int(datetime.now().timestamp())}"
    return AuthResponse(
        success=True,
        token=token,
        user=UserResponse(
            id=f"usr_radix_{user.id}",
            email=user.email,
            name=user.name,
            role="Radiologist",
            department=user.department,
            institution=user.institution,
            licenseNumber=user.license_number,
            bio=user.bio,
            avatar=user.avatar
        )
    )

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please provide a valid clinical email.")

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered account found with this clinical email. Please check your spelling or register."
        )

    import random
    from datetime import datetime, timedelta, timezone
    from app.services.email_service import send_recovery_code_email

    code = f"RDX-{random.randint(100000, 999999)}"
    user.reset_token = code
    user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()

    # Dispatch institutional recovery code email
    email_result = send_recovery_code_email(user.email, code)

    return {
        "success": True,
        "token": code,
        "email": user.email,
        "dispatched": email_result.get("sent", True),
        "message": f"A recovery code has been sent to {user.email}. Please check your mail and enter the code below."
    }

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    clean_token = payload.token.strip().upper()
    if not clean_token:
        raise HTTPException(status_code=400, detail="Security token is required.")

    if not payload.newPassword or len(payload.newPassword) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")

    query = db.query(User)
    if payload.email and payload.email.strip():
        query = query.filter(func.lower(User.email) == payload.email.strip().lower())

    user = query.filter(func.upper(User.reset_token) == clean_token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or unrecognized verification token. Please verify your code and email."
        )

    from datetime import datetime, timezone
    if user.reset_token_expiry:
        now = datetime.now(timezone.utc)
        expiry = user.reset_token_expiry
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if now > expiry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification code has expired (valid for 15 minutes). Please request a new code."
            )

    user.password_hash = hash_password(payload.newPassword)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()

    return {
        "success": True,
        "email": user.email,
        "message": "Your password has been successfully reset. You can now sign in with your new password."
    }

@router.get("/profile", response_model=UserResponse)
def get_profile(email: Optional[str] = None, db: Session = Depends(get_db)):
    if not email:
        raise HTTPException(status_code=400, detail="Email query parameter is required.")
    clean_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User profile for {clean_email} was not found in the database."
        )
    return UserResponse(
        id=f"usr_radix_{user.id}",
        email=user.email,
        name=user.name,
        role="Radiologist",
        department=user.department,
        institution=user.institution,
        licenseNumber=getattr(user, "license_number", None),
        bio=getattr(user, "bio", None),
        avatar=user.avatar
    )

@router.put("/profile", response_model=UserResponse)
def update_profile(payload: UpdateProfileRequest, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required to identify user profile.")

    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user:
        # Gracefully auto-create user in database if session was created in offline/fallback mode
        initial_pw = payload.newPassword if payload.newPassword and len(payload.newPassword) >= 8 else "RadixSecure2026!"
        user = User(
            email=clean_email,
            name=payload.name.strip() if payload.name and payload.name.strip() else clean_email.split("@")[0].title(),
            password_hash=hash_password(initial_pw),
            role="Radiologist",
            department=payload.department.strip() if (payload.department and payload.department.strip()) else None,
            institution=payload.institution.strip() if (payload.institution and payload.institution.strip()) else None,
            license_number=payload.licenseNumber.strip() if (payload.licenseNumber and payload.licenseNumber.strip()) else None,
            bio=payload.bio.strip() if (payload.bio and payload.bio.strip()) else None,
            avatar=payload.avatar.strip() if (payload.avatar and payload.avatar.strip()) else None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return UserResponse(
            id=f"usr_radix_{user.id}",
            email=user.email,
            name=user.name,
            role="Radiologist",
            department=user.department,
            institution=user.institution,
            licenseNumber=user.license_number,
            bio=user.bio,
            avatar=user.avatar
        )

    if payload.name is not None and payload.name.strip():
        user.name = payload.name.strip()
    user.role = "Radiologist"
    if payload.department is not None:
        user.department = payload.department.strip() or None
    if payload.institution is not None:
        user.institution = payload.institution.strip() or None
    if payload.licenseNumber is not None:
        user.license_number = payload.licenseNumber.strip() or None
    if payload.bio is not None:
        user.bio = payload.bio.strip() or None
    if payload.avatar is not None:
        user.avatar = payload.avatar.strip() or None

    if payload.newPassword:
        if len(payload.newPassword) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
        if payload.currentPassword:
            if user.password_hash and not verify_password(payload.currentPassword, user.password_hash):
                raise HTTPException(status_code=400, detail="Current password is incorrect.")
        user.password_hash = hash_password(payload.newPassword)

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=f"usr_radix_{user.id}",
        email=user.email,
        name=user.name,
        role="Radiologist",
        department=user.department,
        institution=user.institution,
        licenseNumber=user.license_number,
        bio=user.bio,
        avatar=user.avatar
    )
