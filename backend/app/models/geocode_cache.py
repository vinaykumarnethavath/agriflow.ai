from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class GeocodeCache(SQLModel, table=True):
    __tablename__ = "geocode_cache"

    id: Optional[int] = Field(default=None, primary_key=True)
    address_key: str = Field(index=True, unique=True)
    query_text: str

    lat: float
    lng: float
    confidence: int = 0

    formatted_address: str = ""
    components_json: str = "{}"
    provider: str = "opencage"

    updated_at: datetime = Field(default_factory=datetime.utcnow)
