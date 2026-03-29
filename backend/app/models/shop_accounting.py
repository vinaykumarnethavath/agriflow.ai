from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime, date


class ShopAccountingExpense(SQLModel, table=True):
    """Business-level operating expenses (rent, regular labour, utilities, etc.)
    These are NOT per-order expenses — they are periodic shop running costs."""
    __tablename__ = "shop_accounting_expenses"
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_id: int = Field(foreign_key="user.id")
    category: str  # rent, labour, transportation, utilities, batch_cost, other
    amount: float
    description: Optional[str] = None
    expense_date: date = Field(default_factory=date.today)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ShopAccountingExpenseCreate(SQLModel):
    category: str
    amount: float
    description: Optional[str] = None
    expense_date: Optional[str] = None  # ISO date string


class ShopAccountingExpenseRead(SQLModel):
    id: int
    shop_id: int
    category: str
    amount: float
    description: Optional[str]
    expense_date: str
    created_at: str
