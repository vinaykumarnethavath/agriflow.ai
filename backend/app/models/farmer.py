from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship

class LandRecordBase(SQLModel):
    serial_number: str
    area: float

class LandRecord(LandRecordBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    farmer_profile_id: int = Field(foreign_key="farmerprofile.id")
    farmer_profile: "FarmerProfile" = Relationship(back_populates="land_records")

class FarmerProfileBase(SQLModel):
    farmer_id: str = Field(unique=True, index=True)
    father_husband_name: str
    
    # Detailed Address
    house_no: Optional[str] = None
    street: Optional[str] = None
    village: Optional[str] = None
    mandal: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: str = Field(default="India")
    pincode: Optional[str] = None
    
    total_area: float
    aadhaar_last_4: str
    bank_name: str
    account_number: str
    ifsc_code: str
    profile_picture_url: Optional[str] = None

class FarmerProfile(FarmerProfileBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(unique=True, foreign_key="user.id")
    land_records: List[LandRecord] = Relationship(back_populates="farmer_profile")

class FarmerProfileCreate(FarmerProfileBase):
    full_name: Optional[str] = None

class FarmerProfileRead(FarmerProfileBase):
    id: int
    user_id: int
    full_name: Optional[str] = None
    land_records: List[LandRecordBase] = []
