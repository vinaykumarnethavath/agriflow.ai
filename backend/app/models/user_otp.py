from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel

class UserOTP(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    otp_code: str
    expires_at: datetime
    is_verified: bool = Field(default=False)
