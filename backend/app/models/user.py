from typing import Optional
from enum import Enum
from sqlmodel import Field, SQLModel, UniqueConstraint
from pydantic import EmailStr

class UserRole(str, Enum):
    FARMER = "farmer"
    SHOP = "shop"
    MANUFACTURER = "manufacturer"
    CUSTOMER = "customer"

class UserBase(SQLModel):
    email: EmailStr = Field(index=True)
    full_name: str
    role: UserRole
    is_active: bool = True

    __table_args__ = (UniqueConstraint("email", "role"),)

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int

class UserLogin(SQLModel):
    email: EmailStr
    password: str
    role: Optional[UserRole] = None

class ForgotPasswordRequest(SQLModel):
    email: EmailStr

class VerifyOTPRequest(SQLModel):
    email: EmailStr
    otp_code: str

class ResetPasswordRequest(SQLModel):
    email: EmailStr
    otp_code: str
    new_password: str
