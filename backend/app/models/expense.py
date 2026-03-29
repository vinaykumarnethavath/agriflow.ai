from typing import Optional
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime


class ShopExpense(SQLModel, table=True):
    __tablename__ = "shop_expenses"
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="shop_orders.id")
    transportation: float = Field(default=0.0)
    labour: float = Field(default=0.0)
    other: float = Field(default=0.0)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def total(self) -> float:
        return self.transportation + self.labour + self.other


class ShopExpenseCreate(SQLModel):
    transportation: float = 0.0
    labour: float = 0.0
    other: float = 0.0
    notes: Optional[str] = None


class ShopExpenseRead(SQLModel):
    id: int
    order_id: int
    transportation: float
    labour: float
    other: float
    notes: Optional[str]
    created_at: datetime
