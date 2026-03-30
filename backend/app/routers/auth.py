from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import random
import string
from datetime import datetime, timedelta

from ..database import get_session
from ..models import User, UserCreate, UserRead, UserLogin, UserOTP, PhoneOTP, ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest, SendPhoneOTPRequest, VerifyPhoneOTPRequest
from ..utils import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from ..mail_utils import send_otp_email
from ..sms_utils import send_otp_sms

router = APIRouter(prefix="/auth", tags=["auth"])

def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, session: AsyncSession = Depends(get_session)):
    statement = select(User).where(User.email == request.email)
    result = await session.exec(statement)
    user = result.first()
    
    if not user:
        # We don't want to leak if a user exists, but for demo let's be descriptive
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete old OTPs for this email to avoid confusion
    old_otps_statement = select(UserOTP).where(UserOTP.email == request.email)
    old_otps_result = await session.exec(old_otps_statement)
    for old_otp in old_otps_result.all():
        await session.delete(old_otp)
    
    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    otp_entry = UserOTP(email=request.email, otp_code=otp_code, expires_at=expires_at)
    session.add(otp_entry)
    await session.commit()
    
    print(f"\n[DEMO] OTP for {request.email}: {otp_code}\n")
    
    # Send real email
    email_sent = send_otp_email(request.email, otp_code)
    
    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Please check backend logs.")
        
    return {"message": "OTP sent to your email address"}

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest, session: AsyncSession = Depends(get_session)):
    now = datetime.utcnow()
    statement = select(UserOTP).where(
        UserOTP.email == request.email,
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

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, session: AsyncSession = Depends(get_session)):
    # Verify OTP was actually verified in previous step
    statement = select(UserOTP).where(
        UserOTP.email == request.email,
        UserOTP.otp_code == request.otp_code,
        UserOTP.is_verified == True
    )
    result = await session.exec(statement)
    otp_entry = result.first()
    
    if not otp_entry:
        raise HTTPException(status_code=400, detail="OTP not verified or invalid")
    
    # Update user password
    user_statement = select(User).where(User.email == request.email)
    user_result = await session.exec(user_statement)
    user = user_result.first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.hashed_password = get_password_hash(request.new_password)
    session.add(user)
    
    # Delete the used OTP
    await session.delete(otp_entry)
    
    await session.commit()
    
    return {"message": "Password reset successful"}

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


@router.post("/register", response_model=UserRead)
async def register(user: UserCreate, session: AsyncSession = Depends(get_session)):
    if not user.email and not user.phone_number:
        raise HTTPException(status_code=400, detail="Either email or phone number is required")

    if user.phone_number:
        # Check if phone number already registered with this role
        phone_stmt = select(User).where(User.phone_number == user.phone_number, User.role == user.role)
        phone_result = await session.exec(phone_stmt)
        if phone_result.first():
            raise HTTPException(status_code=400, detail=f"Phone number already registered as {user.role.value}")
    else:
        # Check if email exists with this role
        statement = select(User).where(User.email == user.email, User.role == user.role)
        result = await session.exec(statement)
        if result.first():
            raise HTTPException(status_code=400, detail=f"Email already registered as {user.role.value}")

    hashed_pwd = get_password_hash(user.password)
    user_data = user.model_dump(exclude={"password", "phone_otp_verified"}) if hasattr(user, "model_dump") else user.dict(exclude={"password", "phone_otp_verified"})
    db_user = User(**user_data, hashed_password=hashed_pwd)
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    return db_user

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(get_session)):
    # Note: OAuth2PasswordRequestForm expects username/password. We interpret username as email.
    statement = select(User).where(User.email == form_data.username)
    result = await session.exec(statement)
    user = result.first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else user.role, "id": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.post("/login")
async def login(user_data: UserLogin, session: AsyncSession = Depends(get_session)):
    # Phone number + password login
    if user_data.phone_number and not user_data.email:
        if not user_data.password:
            raise HTTPException(status_code=400, detail="Password is required")

        query = select(User).where(User.phone_number == user_data.phone_number)
        if user_data.role:
            query = query.where(User.role == user_data.role)
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
        return {"access_token": access_token, "token_type": "bearer", "role": user.role, "id": user.id, "full_name": user.full_name}

    # Email + password login
    if not user_data.email or not user_data.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    query = select(User).where(User.email == user_data.email)
    if user_data.role:
        query = query.where(User.role == user_data.role)

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
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "id": user.id, "full_name": user.full_name}
