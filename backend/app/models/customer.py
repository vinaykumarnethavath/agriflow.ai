from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime
from .trade import Product
# from .user import User  # Removed circular import

# 1. Shopping Cart
class Cart(SQLModel, table=True):
    __tablename__ = "cart"
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="user.id")
    product_id: int = Field(foreign_key="product.id")
    quantity: float
    
    # We might fetch product details via join, or store snapshot if price fluctuates
    # For a cart, live price is better.

class CartItemCreate(SQLModel):
    product_id: int
    quantity: float

class CartItemRead(SQLModel):
    id: int
    product_id: int
    product_name: str
    price: float
    quantity: float
    image_url: Optional[str] = None
    seller_name: str

# 2. Customer Order (B2C)
class CustomerOrder(SQLModel, table=True):
    __tablename__ = "customer_orders"
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="user.id")
    total_amount: float
    status: str = "pending" # pending, confirmed, shipped, delivered, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    items: List["CustomerOrderItem"] = Relationship(back_populates="order")

class CustomerOrderItem(SQLModel, table=True):
    __tablename__ = "customer_order_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="customer_orders.id")
    product_id: int = Field(foreign_key="product.id")
    seller_id: int = Field(foreign_key="user.id") # To know who sold it (Farmer/Manufacturer)
    
    product_name: str # Snapshot
    quantity: float
    price: float # Snapshot
    
    order: Optional[CustomerOrder] = Relationship(back_populates="items")

# Pydantic Models for API
class CustomerOrderCreate(SQLModel):
    pass # No fields needed, creates from Cart

class CustomerOrderRead(SQLModel):
    id: int
    total_amount: float
    status: str
    created_at: datetime
    items: List["CustomerOrderItemRead"]

class CustomerOrderItemRead(SQLModel):
    product_name: str
    quantity: float
    price: float
    seller_id: int

# --- Customer Profile ---
class CustomerProfileBase(SQLModel):
    father_name: str
    relation_type: Optional[str] = "S/O"  # "S/O", "W/O", "D/O"
    id_number: str # Aadhaar/PAN
    
    # Detailed Address
    house_no: Optional[str] = None
    street: Optional[str] = None
    village: Optional[str] = None
    mandal: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: str = Field(default="India")
    pincode: Optional[str] = None
    
    bank_name: str
    account_number: str
    ifsc_code: str
    profile_picture_url: Optional[str] = None

class CustomerProfile(CustomerProfileBase, table=True):
    __tablename__ = "customer_profiles"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(unique=True, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="customer_profile")

class CustomerProfileCreate(CustomerProfileBase):
    full_name: Optional[str] = None

class CustomerProfileRead(CustomerProfileBase):
    id: int
    user_id: int
    full_name: Optional[str] = None
