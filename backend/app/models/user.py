from typing import Optional
from enum import Enum
from sqlmodel import Field, SQLModel, UniqueConstraint, Relationship
from pydantic import EmailStr, field_validator

class UserRole(str, Enum):
    FARMER = "farmer"
    SHOP = "shop"
    MANUFACTURER = "manufacturer"
    CUSTOMER = "customer"

class UserBase(SQLModel):
    email: Optional[EmailStr] = Field(default=None, index=True)
    phone_number: Optional[str] = Field(default=None, index=True)
    full_name: str
    role: UserRole
    is_active: bool = True

    __table_args__ = (UniqueConstraint("email", "role"),)

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str

    # Relationships
    farmer_profile: Optional["FarmerProfile"] = Relationship(back_populates="user")
    mill_profile: Optional["MillProfile"] = Relationship(back_populates="user")
    shop_profile: Optional["ShopProfile"] = Relationship(back_populates="user")
    customer_profile: Optional["CustomerProfile"] = Relationship(back_populates="user")

class UserCreate(UserBase):
    password: str
    phone_otp_verified: Optional[bool] = False

class UserRead(UserBase):
    id: int

class UserLogin(SQLModel):
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None

class SendPhoneOTPRequest(SQLModel):
    phone_number: str

class VerifyPhoneOTPRequest(SQLModel):
    phone_number: str
    otp_code: str

class ForgotPasswordRequest(SQLModel):
    email: EmailStr

class VerifyOTPRequest(SQLModel):
    email: EmailStr
    otp_code: str

class ResetPasswordRequest(SQLModel):
    email: EmailStr
    otp_code: str
    new_password: str
