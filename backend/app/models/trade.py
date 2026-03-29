from typing import Optional, List, Dict
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime
from pydantic import validator
import json

class ProductType(str):
    FERTILIZER = "fertilizer"
    CROP = "crop" # When farmer harvests and lists for sale
    PROCESSED = "processed" # Manufacturer good

class ProductBase(SQLModel):
    name: str
    short_name: Optional[str] = None
    category: str # fertilizer, crop, processed, pesticide, seeds
    brand: Optional[str] = None # Brand name
    manufacturer: Optional[str] = None # Manufacturer name (separate from brand)
    price: float # Selling Price
    cost_price: Optional[float] = None # Purchase Price (for profit calc)
    quantity: int
    unit: str = "kg" # kg, liter, packet, bag
    quantity_per_unit: Optional[float] = None # e.g. 50 (kg per bag)

    measure_unit: str = "kg" # kg, g, L, ml
    batch_number: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    product_image_url: Optional[str] = None
    main_composition: Optional[str] = None
    manufacture_date: Optional[datetime] = None
    low_stock_threshold: int = Field(default=10)

class Product(ProductBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Traceability JSON
    traceability_json: str = "{}" 
    
    @property
    def traceability(self) -> Dict:
        return json.loads(self.traceability_json)

    @traceability.setter
    def traceability(self, value: Dict):
        self.traceability_json = json.dumps(value)

# New Order Architecture
class ShopOrderBase(SQLModel):
    total_amount: float
    discount: float = 0.0
    final_amount: float
    payment_mode: str = "cash" # cash, upi, credit, razorpay
    payment_status: str = "pending" # pending, paid
    payment_id: Optional[str] = None
    status: str = "completed" # completed, pending, confirmed, dispatched, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ShopOrder(ShopOrderBase, table=True):
    __tablename__ = "shop_orders"
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_id: int = Field(foreign_key="user.id")
    farmer_id: Optional[int] = Field(foreign_key="user.id", default=None) # Nullable for walk-in customers
    farmer_name: Optional[str] = None # For quick display or walk-ins
    
    total_expenses: float = Field(default=0.0)  # cached sum of shop expenses
    profit: float = Field(default=0.0)  # cached profit
    items: List["ShopOrderItem"] = Relationship(back_populates="order")

class ShopOrderItemBase(SQLModel):
    product_name: str # Snapshot in case product is deleted
    quantity: int
    unit_price: float # Price at time of sale
    subtotal: float

class ShopOrderItem(ShopOrderItemBase, table=True):
    __tablename__ = "shop_order_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="shop_orders.id")
    product_id: int = Field(foreign_key="product.id")
    
    order: Optional[ShopOrder] = Relationship(back_populates="items")

# Traceability Events
class TraceabilityEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id")
    actor_id: int = Field(foreign_key="user.id")
    action: str 
    details: str 
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ProductCreate(ProductBase):
    pass

class ProductRead(ProductBase):
    id: int
    user_id: int
    traceability_json: str

class ShopOrderItemCreate(SQLModel):
    product_id: int
    quantity: int

class ShopOrderCreate(SQLModel):
    items: List[ShopOrderItemCreate]
    farmer_id: Optional[int] = None
    discount: float = 0.0
    payment_mode: str = "cash"
    # Optional expense details captured at point of sale
    expense_transportation: float = 0.0
    expense_labour: float = 0.0
    expense_other: float = 0.0
    expense_notes: Optional[str] = None

class ShopOrderStatusUpdate(SQLModel):
    status: Optional[str] = None
    discount: Optional[float] = None  # Shop can give discount when confirming
    expense_transportation: Optional[float] = None
    expense_labour: Optional[float] = None
    expense_other: Optional[float] = None
    expense_notes: Optional[str] = None

class ShopOrderRead(ShopOrderBase):
    id: int
    shop_id: int
    farmer_id: Optional[int]
    farmer_name: Optional[str]
    items: List[ShopOrderItemBase]
