from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, SQLModel
from pydantic import BaseModel
from typing import Optional
import random
import string
from datetime import datetime, timedelta
import sqlalchemy.exc

from ..database import get_session
from ..models import User, UserCreate, UserRead, UserLogin, UserOTP, PhoneOTP, ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest, SendPhoneOTPRequest, VerifyPhoneOTPRequest, EmailVerificationOTP
from ..utils import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from ..mail_utils import send_otp_email, send_registration_otp_email
from ..sms_utils import send_otp_sms

router = APIRouter(prefix="/auth", tags=["auth"])

def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

def safe_display_name(user: User) -> str:
    full_name = user.full_name or ""
    if user.email is None and "@" in full_name:
        return ""
    return full_name

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, session: AsyncSession = Depends(get_session)):
    role_val = request.role.value if hasattr(request.role, "value") else str(request.role)

    if request.email:
        email = request.email.lower().strip()
        statement = select(User).where(User.email == email, User.role == role_val)
        result = await session.exec(statement)
        user = result.first()

        if not user:
            raise HTTPException(status_code=404, detail="No account found for this email and role")

        old_otps_statement = select(UserOTP).where(UserOTP.email == email)
        old_otps_result = await session.exec(old_otps_statement)
        for old_otp in old_otps_result.all():
            await session.delete(old_otp)

        otp_code = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        otp_entry = UserOTP(email=email, otp_code=otp_code, expires_at=expires_at)
        session.add(otp_entry)
        await session.commit()

        print(f"\n[DEMO] Password reset OTP for {email} ({role_val}): {otp_code}\n")

        email_sent = send_otp_email(email, otp_code)
        if not email_sent:
            raise HTTPException(status_code=500, detail="Failed to send OTP email. Please check backend logs.")

        return {"message": "OTP sent to your email address"}

    if request.phone_number:
        phone_number = request.phone_number.strip()
        statement = select(User).where(User.phone_number == phone_number, User.role == role_val)
        result = await session.exec(statement)
        user = result.first()

        if not user:
            raise HTTPException(status_code=404, detail="No account found for this phone number and role")

        old_stmt = select(PhoneOTP).where(PhoneOTP.phone_number == phone_number)
        old_result = await session.exec(old_stmt)
        for old in old_result.all():
            await session.delete(old)

        otp_code = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        otp_entry = PhoneOTP(phone_number=phone_number, otp_code=otp_code, expires_at=expires_at)
        session.add(otp_entry)
        await session.commit()

        print(f"\n[DEMO] Password reset phone OTP for {phone_number} ({role_val}): {otp_code}\n")

        sms_sent = await send_otp_sms(phone_number, otp_code)
        if not sms_sent:
            raise HTTPException(status_code=500, detail="Failed to send OTP SMS. Please check backend logs.")

        return {"message": "OTP sent to your phone number"}

    raise HTTPException(status_code=400, detail="Either email or phone number is required")

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest, session: AsyncSession = Depends(get_session)):
    role_val = request.role.value if hasattr(request.role, "value") else str(request.role)
    now = datetime.utcnow()

    if request.email:
        email = request.email.lower().strip()
        user_stmt = select(User).where(User.email == email, User.role == role_val)
        user_result = await session.exec(user_stmt)
        if not user_result.first():
            raise HTTPException(status_code=404, detail="No account found for this email and role")

        statement = select(UserOTP).where(
            UserOTP.email == email,
            UserOTP.otp_code == request.otp_code,
            UserOTP.expires_at > now,
            UserOTP.is_verified == False
        )
        result = await session.exec(statement)
        otp_entry = result.first()

        if not otp_entry:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

        otp_entry.is_verified = True
        session.add(otp_entry)
        await session.commit()
        return {"message": "OTP verified successfully"}

    if request.phone_number:
        phone_number = request.phone_number.strip()
        user_stmt = select(User).where(User.phone_number == phone_number, User.role == role_val)
        user_result = await session.exec(user_stmt)
        if not user_result.first():
            raise HTTPException(status_code=404, detail="No account found for this phone number and role")

        statement = select(PhoneOTP).where(
            PhoneOTP.phone_number == phone_number,
            PhoneOTP.otp_code == request.otp_code,
            PhoneOTP.expires_at > now,
            PhoneOTP.is_verified == False
        )
        result = await session.exec(statement)
        otp_entry = result.first()

        if not otp_entry:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

        otp_entry.is_verified = True
        session.add(otp_entry)
        await session.commit()
        return {"message": "OTP verified successfully"}

    raise HTTPException(status_code=400, detail="Either email or phone number is required")

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, session: AsyncSession = Depends(get_session)):
    role_val = request.role.value if hasattr(request.role, "value") else str(request.role)

    if request.email:
        email = request.email.lower().strip()
        statement = select(UserOTP).where(
            UserOTP.email == email,
            UserOTP.otp_code == request.otp_code,
            UserOTP.is_verified == True
        )
        result = await session.exec(statement)
        otp_entry = result.first()

        if not otp_entry:
            raise HTTPException(status_code=400, detail="OTP not verified or invalid")

        user_statement = select(User).where(User.email == email, User.role == role_val)
        user_result = await session.exec(user_statement)
        user = user_result.first()

        if not user:
            raise HTTPException(status_code=404, detail="No account found for this email and role")

        user.hashed_password = get_password_hash(request.new_password)
        session.add(user)
        await session.delete(otp_entry)
        await session.commit()
        return {"message": "Password reset successful"}

    if request.phone_number:
        phone_number = request.phone_number.strip()
        statement = select(PhoneOTP).where(
            PhoneOTP.phone_number == phone_number,
            PhoneOTP.otp_code == request.otp_code,
            PhoneOTP.is_verified == True
        )
        result = await session.exec(statement)
        otp_entry = result.first()

        if not otp_entry:
            raise HTTPException(status_code=400, detail="OTP not verified or invalid")

        user_statement = select(User).where(User.phone_number == phone_number, User.role == role_val)
        user_result = await session.exec(user_statement)
        user = user_result.first()

        if not user:
            raise HTTPException(status_code=404, detail="No account found for this phone number and role")

        user.hashed_password = get_password_hash(request.new_password)
        session.add(user)
        await session.delete(otp_entry)
        await session.commit()
        return {"message": "Password reset successful"}

    raise HTTPException(status_code=400, detail="Either email or phone number is required")

@router.post("/send-phone-otp")
async def send_phone_otp(request: SendPhoneOTPRequest, session: AsyncSession = Depends(get_session)):
    # Delete old OTPs for this phone
    old_stmt = select(PhoneOTP).where(PhoneOTP.phone_number == request.phone_number)
    old_result = await session.exec(old_stmt)
    for old in old_result.all():
        await session.delete(old)

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    otp_entry = PhoneOTP(phone_number=request.phone_number, otp_code=otp_code, expires_at=expires_at)
    session.add(otp_entry)
    await session.commit()

    print(f"\n[DEMO] Phone OTP for {request.phone_number}: {otp_code}\n")

    sms_sent = await send_otp_sms(request.phone_number, otp_code)
    if not sms_sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP SMS. Please check backend logs.")

    return {"message": "OTP sent to your phone number"}


@router.post("/verify-phone-otp")
async def verify_phone_otp(request: VerifyPhoneOTPRequest, session: AsyncSession = Depends(get_session)):
    now = datetime.utcnow()
    statement = select(PhoneOTP).where(
        PhoneOTP.phone_number == request.phone_number,
        PhoneOTP.otp_code == request.otp_code,
        PhoneOTP.expires_at > now,
        PhoneOTP.is_verified == False
    )
    result = await session.exec(statement)
    otp_entry = result.first()

    if not otp_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    otp_entry.is_verified = True
    session.add(otp_entry)
    await session.commit()

    return {"message": "Phone OTP verified successfully", "verified": True}


class SendRegisterOTPRequest(BaseModel):
    email: str
    role: str


@router.post("/send-register-otp")
async def send_register_otp(request: SendRegisterOTPRequest, session: AsyncSession = Depends(get_session)):
    """Send a verification OTP to email before account creation."""
    email = request.email.lower().strip()
    role = request.role

    # Check duplicate: same email + same role already registered
    dup_stmt = select(User).where(User.email == email, User.role == role)
    dup_result = await session.exec(dup_stmt)
    if dup_result.first():
        raise HTTPException(status_code=400, detail=f"Email already registered as {role}")

    # Clear old OTPs for this email+role
    old_stmt = select(EmailVerificationOTP).where(
        EmailVerificationOTP.email == email,
        EmailVerificationOTP.role == role
    )
    old_result = await session.exec(old_stmt)
    for old in old_result.all():
        await session.delete(old)

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    otp_entry = EmailVerificationOTP(email=email, role=role, otp_code=otp_code, expires_at=expires_at)
    session.add(otp_entry)
    await session.commit()

    print(f"\n[DEMO] Registration OTP for {email} ({role}): {otp_code}\n")

    email_sent = send_registration_otp_email(email, otp_code, role)
    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please check backend logs.")

    return {"message": "Verification code sent to your email"}


@router.post("/register", response_model=UserRead)
async def register(user: UserCreate, session: AsyncSession = Depends(get_session)):
    if not user.email and not user.phone_number:
        raise HTTPException(status_code=400, detail="Either email or phone number is required")

    # Normalise role to plain lowercase string value so SQLAlchemy never sends the enum NAME
    role_val: str = user.role.value if hasattr(user.role, "value") else str(user.role)

    if user.phone_number:
        # Phone registration — no email OTP needed
        phone_stmt = select(User).where(User.phone_number == user.phone_number, User.role == role_val)
        phone_result = await session.exec(phone_stmt)
        if phone_result.first():
            raise HTTPException(status_code=400, detail=f"Phone number already registered as {role_val}")
    else:
        # Email registration — require verified OTP
        if not user.email_otp_code:
            raise HTTPException(status_code=400, detail="Email verification code is required")

        email = (user.email or "").lower().strip()
        now = datetime.utcnow()
        otp_stmt = select(EmailVerificationOTP).where(
            EmailVerificationOTP.email == email,
            EmailVerificationOTP.role == role_val,
            EmailVerificationOTP.otp_code == user.email_otp_code,
            EmailVerificationOTP.expires_at > now,
            EmailVerificationOTP.is_verified == False
        )
        otp_result = await session.exec(otp_stmt)
        otp_entry = otp_result.first()

        if not otp_entry:
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

        # Check if email+role already exists (race-condition guard)
        dup_stmt = select(User).where(User.email == email, User.role == role_val)
        dup_result = await session.exec(dup_stmt)
        if dup_result.first():
            raise HTTPException(status_code=400, detail=f"Email already registered as {role_val}")

        # Mark OTP used
        otp_entry.is_verified = True
        session.add(otp_entry)

    hashed_pwd = get_password_hash(user.password)
    # Build user dict with role as its plain string VALUE (not enum name)
    db_user = User(
        email=user.email,
        phone_number=user.phone_number,
        full_name=user.full_name,
        role=role_val,
        is_active=user.is_active,
        hashed_password=hashed_pwd,
    )
    session.add(db_user)
    try:
        await session.commit()
    except sqlalchemy.exc.IntegrityError as exc:
        await session.rollback()
        message = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
        if "phone_number" in message and ("duplicate" in message.lower() or "unique" in message.lower()):
            raise HTTPException(status_code=400, detail="Account with this phone number and role already exists")
        if "email" in message and ("duplicate" in message.lower() or "unique" in message.lower()):
            raise HTTPException(status_code=400, detail="Account with this email and role already exists")
        raise HTTPException(status_code=400, detail=message)
    await session.refresh(db_user)
    return db_user

@router.post("/login")
async def login(user_data: UserLogin, session: AsyncSession = Depends(get_session)):
    # Phone number + password login
    if user_data.phone_number and not user_data.email:
        if not user_data.password:
            raise HTTPException(status_code=400, detail="Password is required")

        query = select(User).where(User.phone_number == user_data.phone_number)
        if user_data.role:
            role_filter = user_data.role.value if hasattr(user_data.role, "value") else str(user_data.role)
            query = query.where(User.role == role_filter)
        result = await session.exec(query)
        users = result.all()

        if not users:
            raise HTTPException(status_code=401, detail="No account found for this phone number")

        if len(users) > 1 and not user_data.role:
            raise HTTPException(status_code=400, detail="Multiple accounts found. Please select a role.")

        user = users[0]

        if not verify_password(user_data.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect phone number or password")

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.phone_number, "role": user.role.value if hasattr(user.role, "value") else user.role, "id": user.id},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer", "role": user.role, "id": user.id, "full_name": safe_display_name(user)}

    # Email + password login
    if not user_data.email or not user_data.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    query = select(User).where(User.email == user_data.email)
    if user_data.role:
        role_filter = user_data.role.value if hasattr(user_data.role, "value") else str(user_data.role)
        query = query.where(User.role == role_filter)

    result = await session.exec(query)
    users = result.all()

    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # If role not provided but multiple users exist (ambiguous)
    if len(users) > 1 and not user_data.role:
        raise HTTPException(
            status_code=400,
            detail="Multiple accounts found. Please select a role.",
        )

    user = users[0]

    if not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else user.role, "id": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "id": user.id, "full_name": safe_display_name(user)}
