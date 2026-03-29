from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime
# from .user import User  # Removed circular import

class ShopProfileBase(SQLModel):
    shop_name: str
    license_number: str
    shop_id: Optional[str] = None
    father_name: str
    relation_type: Optional[str] = "S/O"  # "S/O", "W/O", "D/O"
    owner_name: Optional[str] = None  # Full name of the shop owner
    contact_number: Optional[str] = None
    
    # Personal ID Details
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    hide_personal_details: bool = Field(default=False)
    
    # Shop Address
    shop_address: Optional[str] = None  # Full shop address line
    landmark: Optional[str] = None
    
    # Permanent Address
    permanent_address: Optional[str] = None
    
    # Detailed Permanent Address
    perm_house_no: Optional[str] = None
    perm_street: Optional[str] = None
    perm_village: Optional[str] = None
    perm_mandal: Optional[str] = None
    perm_district: Optional[str] = None
    perm_state: Optional[str] = None
    perm_pincode: Optional[str] = None
    
    # Detailed Address
    house_no: Optional[str] = None
    street: Optional[str] = None
    village: Optional[str] = None
    mandal: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: str = Field(default="India")
    pincode: Optional[str] = None
    
    location_text: Optional[str] = None
    
    bank_name: str
    account_number: str
    ifsc_code: str
    profile_picture_url: Optional[str] = None

class ShopProfile(ShopProfileBase, table=True):
    __tablename__ = "shop_profiles"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(unique=True, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="shop_profile")

class ShopProfileCreate(ShopProfileBase):
    full_name: Optional[str] = None

class ShopProfileRead(ShopProfileBase):
    id: int
    user_id: int
    full_name: Optional[str] = None
