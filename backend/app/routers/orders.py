from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..models import ShopOrder, ShopOrderCreate, ShopOrderRead, ShopOrderItem, Product, User
from ..deps import get_current_user

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("/", response_model=ShopOrderRead)
async def create_shop_order(
    order_in: ShopOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Create a new multi-item order.
    """
    # 1. Validate User Role (Shop owner creating order for walk-in/farmer, or Farmer buying?)
    # For now, let's assume Shop Owner creates the order (POS style) OR Farmer creates it.
    # If Farmer creates, shop_id must be inferred from products? 
    # Complexity: Multi-shop orders? 
    # Plan: Restrict order to single shop for now or separate orders per shop. 
    # Given the requirements "Shop Dashboard -> Sales/Orders", it implies Shop Owner records it or Farmer buys.
    
    # If User is Farmer, they are buying. If User is Shop, they are selling (POS).
    buyer_id = None
    if current_user.role == "farmer":
        buyer_id = current_user.id
    elif order_in.farmer_id: # Shop owner specifying farmer
        buyer_id = order_in.farmer_id
        
    # 2. Process Items
    total_amount = 0.0
    db_items = []
    
    # We need to find the seller (Shop). Assuming all products in one order belong to one shop for simplicity.
    # If mixed, we should probably reject or split. For MVP: Check first product's owner.
    shop_id = None
    
    for item_in in order_in.items:
        product = await session.get(Product, item_in.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_in.product_id} not found")
        
        if product.quantity < item_in.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")
            
        if shop_id is None:
            shop_id = product.user_id
        elif shop_id != product.user_id:
             raise HTTPException(status_code=400, detail="Cannot mix products from different shops in one order")

        # Update Stock
        product.quantity -= item_in.quantity
        session.add(product)
        
        # Calculate Item Total
        item_total = product.price * item_in.quantity
        total_amount += item_total
        
        # Create Order Item
        db_item = ShopOrderItem(
            product_id=product.id,
            product_name=product.name,
            quantity=item_in.quantity,
            unit_price=product.price,
            subtotal=item_total
        )
        db_items.append(db_item)
    
    if not shop_id:
         raise HTTPException(status_code=400, detail="No valid products in order")

    # 3. Create Order Header
    final_amount = total_amount - order_in.discount
    if final_amount < 0: final_amount = 0
    
    db_order = ShopOrder(
        shop_id=shop_id,
        farmer_id=buyer_id,
        farmer_name=None, # Todo: fetch name if buyer_id exists
        total_amount=total_amount,
        discount=order_in.discount,
        final_amount=final_amount,
        payment_mode=order_in.payment_mode,
        status="completed"
    )
    session.add(db_order)
    await session.commit()
    await session.refresh(db_order)
    
    # 4. Link Items to Order
    for item in db_items:
        item.order_id = db_order.id
        session.add(item)
        
    await session.commit()
    
    # Refresh to get items
    # Query with items
    statement = select(ShopOrder).where(ShopOrder.id == db_order.id).options(selectinload(ShopOrder.items))
    result = await session.exec(statement)
    return result.one()

@router.get("/shop-orders", response_model=List[ShopOrderRead])
async def read_shop_orders(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != "shop": 
         raise HTTPException(status_code=403, detail="Not authorized")

    statement = select(ShopOrder).where(ShopOrder.shop_id == current_user.id).options(selectinload(ShopOrder.items)).order_by(ShopOrder.created_at.desc())
    result = await session.exec(statement)
    return result.all()

@router.get("/my-orders", response_model=List[ShopOrderRead])
async def read_my_orders(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    statement = select(ShopOrder).where(ShopOrder.farmer_id == current_user.id).options(selectinload(ShopOrder.items)).order_by(ShopOrder.created_at.desc())
    result = await session.exec(statement)
    return result.all()
