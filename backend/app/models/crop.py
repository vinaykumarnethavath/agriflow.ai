from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime


class CropBase(SQLModel):
    name: str # e.g. Wheat, Rice
    area: float # in acres
    sowing_date: datetime
    expected_harvest_date: Optional[datetime] = None
    status: str = "Growing" # Growing, Harvested, Sold
    notes: Optional[str] = None
    
    # Financials (Optional - updated incrementally)
    actual_harvest_date: Optional[datetime] = None
    actual_yield: Optional[float] = 0.0 # in quintals
    selling_price_per_unit: Optional[float] = 0.0
    total_revenue: Optional[float] = 0.0
    total_cost: Optional[float] = 0.0
    net_profit: Optional[float] = 0.0

class Crop(CropBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CropHarvestBase(SQLModel):
    date: datetime
    stage: str # First Picking, Second Picking, Final Harvest
    quantity: float
    unit: str # Quintals, Kg, Tons
    quality: str = "Grade A"
    selling_price_per_unit: float
    total_revenue: float
    buyer_type: str # Market, Private, Government
    sold_to: Optional[str] = None
    notes: Optional[str] = None

class CropHarvest(CropHarvestBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    crop_id: int = Field(foreign_key="crop.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CropHarvestCreate(CropHarvestBase):
    pass

class CropHarvestRead(CropHarvestBase):
    id: int
    crop_id: int

class CropCreate(CropBase):
    pass

class CropUpdate(SQLModel):
    name: Optional[str] = None
    area: Optional[float] = None
    sowing_date: Optional[datetime] = None
    expected_harvest_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class CropRead(CropBase):
    id: int
    user_id: int

class CropExpenseBase(SQLModel):
    category: str # Input, Labor, Machinery, Irrigation, Logistics, Miscellaneous
    type: str # Seed, Fertilizer, etc.
    quantity: float
    unit: str # kg, hours, days
    unit_cost: float
    total_cost: float
    date: datetime
    payment_mode: str # cash, digital
    unit_size: float = 1.0 # e.g. 50kg bag, 1 liter bottle
    duration: float = 1.0 # e.g. 5 days of labor
    stage: str = "General" # Sowing, Watering, Flowering, Harvesting, etc.
    bill_url: Optional[str] = None
    notes: Optional[str] = None

class CropExpense(CropExpenseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    crop_id: int = Field(foreign_key="crop.id")

class CropExpenseCreate(CropExpenseBase):
    pass

class CropExpenseRead(CropExpenseBase):
    id: int
    crop_id: int

class CropExpenseWithCrop(CropExpenseRead):
    crop_name: str
