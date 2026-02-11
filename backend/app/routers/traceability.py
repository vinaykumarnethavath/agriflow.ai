from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from ..database import get_session
from ..models import TraceabilityEvent, Product, User
from ..deps import get_current_user

router = APIRouter(prefix="/traceability", tags=["traceability"])

@router.post("/", response_model=TraceabilityEvent)
async def add_event(
    product_id: int,
    action: str,
    details: str, # JSON string
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # Verify product exists
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # In a real app, verify ownership or permissions based on supply chain logic
    
    event = TraceabilityEvent(
        product_id=product_id,
        actor_id=current_user.id,
        action=action,
        details=details
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event

@router.get("/{product_id}", response_model=List[TraceabilityEvent])
async def get_product_traceability(
    product_id: int,
    session: AsyncSession = Depends(get_session)
):
    statement = select(TraceabilityEvent).where(TraceabilityEvent.product_id == product_id).order_by(TraceabilityEvent.timestamp)
    result = await session.exec(statement)
    return result.all()


@router.get("/public/{product_id}")
async def get_public_traceability(
    product_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Public endpoint for traceability - returns basic product info + events.
    No auth required.
    """
    # Get product
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Get farmer details
    farmer = await session.get(User, product.user_id)
    
    # Get events
    statement = select(TraceabilityEvent).where(TraceabilityEvent.product_id == product_id).order_by(TraceabilityEvent.timestamp)
    result = await session.exec(statement)
    events = result.all()
    
    return {
        "product": {
            "name": product.name,
            "category": product.category,
            "description": product.description,
            "batch_number": product.batch_number,
            "quantity": product.quantity
        },
        "farmer": {
            "name": farmer.full_name if farmer else "Unknown Farmer",
            "is_verified": farmer.is_verified if farmer else False
        },
        "events": events
    }
