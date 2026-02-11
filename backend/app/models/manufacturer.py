from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime
from .trade import Product

# 1. Raw Material Purchase from Farmer
class ManufacturerPurchase(SQLModel, table=True):
    __tablename__ = "manufacturer_purchases"
    id: Optional[int] = Field(default=None, primary_key=True)
    manufacturer_id: int = Field(foreign_key="user.id")
    farmer_id: Optional[int] = Field(foreign_key="user.id", default=None) # Optional if buying from unknown source
    farmer_name: str 
    crop_name: str # e.g. Wheat, Sugarcane
    quantity: float # in kg/tons
    unit: str = "kg"
    price_per_unit: float
    total_cost: float
    transport_cost: float = 0.0
    quality_grade: Optional[str] = None # A, B, C
    batch_id: str # Created automatically -> M-PUR-{id}
    date: datetime = Field(default_factory=datetime.utcnow)

# 2. Production / Processing Batch
class ProductionBatch(SQLModel, table=True):
    __tablename__ = "production_batches"
    id: Optional[int] = Field(default=None, primary_key=True)
    manufacturer_id: int = Field(foreign_key="user.id")
    
    # Input
    input_product_id: int = Field(foreign_key="product.id") # Raw Material from Inventory
    input_qty: float
    
    # Output
    output_product_name: str # e.g. Wheat Flour
    output_qty: float 
    output_unit: str = "kg"
    
    processing_cost: float
    waste_qty: float = 0.0
    
    # Metrics
    efficiency: float # output / input * 100
    
    batch_number: str # Created automatically -> M-PROD-{id}
    date: datetime = Field(default_factory=datetime.utcnow)

# 3. Sales to Market/Shops
class ManufacturerSale(SQLModel, table=True):
    __tablename__ = "manufacturer_sales"
    id: Optional[int] = Field(default=None, primary_key=True)
    manufacturer_id: int = Field(foreign_key="user.id")
    
    buyer_type: str # "shop", "customer", "distributor"
    buyer_id: Optional[int] = Field(foreign_key="user.id", default=None)
    buyer_name: str
    
    product_id: int = Field(foreign_key="product.id") # Finished Good from Inventory
    quantity: float
    selling_price: float # Per unit
    discount: float = 0.0
    total_amount: float
    
    payment_mode: str = "cash"
    invoice_id: str # M-INV-{id}
    date: datetime = Field(default_factory=datetime.utcnow)

# Pydantic Models for API
class ManufacturerPurchaseCreate(SQLModel):
    farmer_id: Optional[int] = None
    farmer_name: str
    crop_name: str
    quantity: float
    unit: str = "kg"
    price_per_unit: float
    transport_cost: float = 0.0
    quality_grade: Optional[str] = None

class ProductionBatchCreate(SQLModel):
    input_product_id: int
    input_qty: float
    output_product_name: str
    output_qty: float
    output_unit: str = "kg"
    processing_cost: float

class ManufacturerSaleCreate(SQLModel):
    buyer_type: str
    buyer_id: Optional[int] = None
    buyer_name: str
    product_id: int
    quantity: float
    selling_price: float
    discount: float = 0.0
    payment_mode: str = "cash"
