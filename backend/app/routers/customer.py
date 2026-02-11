from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, desc
from datetime import datetime

from ..database import get_session
from ..models import (
    User, Product, 
    Cart, CartItemCreate, CartItemRead,
    CustomerOrder, CustomerOrderCreate, CustomerOrderRead, CustomerOrderItem, CustomerOrderItemRead
)
from ..deps import get_current_user

router = APIRouter(prefix="/customer", tags=["customer"])

# --- Marketplace ---

@router.get("/marketplace", response_model=List[Product])
async def get_marketplace_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    # Base query: Active products with stock
    query = select(Product).where(Product.quantity > 0)
    
    if category:
        query = query.where(Product.category == category)
    
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
        
    result = await session.exec(query)
    return result.all()

@router.get("/products/{product_id}", response_model=Product)
async def get_product_details(
    product_id: int,
    session: AsyncSession = Depends(get_session)
):
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# --- Cart ---

@router.get("/cart", response_model=List[CartItemRead])
async def get_cart(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # Join Cart with Product and User (Seller) to get details
    query = select(Cart, Product, User).where(Cart.customer_id == current_user.id).join(Product, Cart.product_id == Product.id).join(User, Product.user_id == User.id)
    results = await session.exec(query)
    
    cart_items = []
    for cart, product, seller in results:
        # Calculate snapshot price (should logically be product.price, assuming marketplace price)
        # Note: In a real app we might store price in cart if it changes, but dynamic is fine for simple MVP
        cart_items.append(CartItemRead(
            id=cart.id,
            product_id=product.id,
            product_name=product.name,
            price=product.price,
            quantity=cart.quantity,
            seller_name=seller.full_name
        ))
    return cart_items

@router.post("/cart", response_model=Cart)
async def add_to_cart(
    item_in: CartItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # Check if exists
    query = select(Cart).where(Cart.customer_id == current_user.id).where(Cart.product_id == item_in.product_id)
    existing_item = (await session.exec(query)).first()
    
    if existing_item:
        existing_item.quantity += item_in.quantity
        session.add(existing_item)
        await session.commit()
        await session.refresh(existing_item)
        return existing_item
    else:
        new_item = Cart(
            customer_id=current_user.id,
            product_id=item_in.product_id,
            quantity=item_in.quantity
        )
        session.add(new_item)
        await session.commit()
        await session.refresh(new_item)
        return new_item

@router.delete("/cart/{item_id}")
async def remove_from_cart(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    item = await session.get(Cart, item_id)
    if not item or item.customer_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await session.delete(item)
    await session.commit()
    return {"message": "Item removed"}

# --- Checkout ---

@router.post("/checkout", response_model=CustomerOrder)
async def checkout(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # 1. Get Cart Items
    cart_query = select(Cart).where(Cart.customer_id == current_user.id)
    cart_items = (await session.exec(cart_query)).all()
    
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")
        
    # 2. Validate Stock & Calculate Total
    total_amount = 0
    order_items = []
    
    for cart_item in cart_items:
        product = await session.get(Product, cart_item.product_id)
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {cart_item.product_id} no longer exists")
        
        if product.quantity < cart_item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
            
        # Deduct Stock
        product.quantity -= cart_item.quantity
        session.add(product)
        
        item_total = product.price * cart_item.quantity
        total_amount += item_total
        
        # Prepare Order Item
        order_items.append(CustomerOrderItem(
            product_id=product.id,
            seller_id=product.user_id,
            product_name=product.name,
            quantity=cart_item.quantity,
            price=product.price
        ))
    
    # 3. Create Order
    order = CustomerOrder(
        customer_id=current_user.id,
        total_amount=total_amount,
        status="confirmed"
    )
    session.add(order)
    await session.commit()
    await session.refresh(order)
    
    # 4. Save Order Items & Clear Cart
    for item in order_items:
        item.order_id = order.id
        session.add(item)
    
    for cart_item in cart_items:
        await session.delete(cart_item)
        
    await session.commit()
    await session.refresh(order)
    return order

# --- Orders History ---

@router.get("/orders", response_model=List[CustomerOrderRead])
async def get_my_orders(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    query = select(CustomerOrder).where(CustomerOrder.customer_id == current_user.id).order_by(CustomerOrder.created_at.desc())
    orders = (await session.exec(query)).all()
    
    # Populate items for response
    result_orders = []
    for order in orders:
        items_query = select(CustomerOrderItem).where(CustomerOrderItem.order_id == order.id)
        items = (await session.exec(items_query)).all()
        
        result_orders.append(CustomerOrderRead(
            id=order.id,
            total_amount=order.total_amount,
            status=order.status,
            created_at=order.created_at,
            items=[CustomerOrderItemRead(
                product_name=i.product_name,
                quantity=i.quantity,
                price=i.price,
                seller_id=i.seller_id
            ) for i in items]
        ))
        
    return result_orders
