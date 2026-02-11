from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, col
from datetime import datetime
import uuid

from ..database import get_session
from ..models import (
    User, Product, 
    ManufacturerPurchase, ManufacturerPurchaseCreate,
    ProductionBatch, ProductionBatchCreate,
    ManufacturerSale, ManufacturerSaleCreate
)
from ..deps import get_current_user

router = APIRouter(prefix="/manufacturer", tags=["manufacturer"])

def check_manufacturer_role(user: User):
    if user.role != "manufacturer":
        raise HTTPException(status_code=403, detail="Not authorized as Manufacturer")

@router.get("/stats")
async def get_manufacturer_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    check_manufacturer_role(current_user)
    
    # Raw Material Stock
    raw_query = select(func.sum(Product.quantity)).where(Product.user_id == current_user.id).where(Product.category == "raw_material")
    raw_stock = (await session.exec(raw_query)).first() or 0
    
    # Finished Goods Stock
    finished_query = select(func.sum(Product.quantity)).where(Product.user_id == current_user.id).where(Product.category == "processed")
    finished_stock = (await session.exec(finished_query)).first() or 0
    
    # Purchases (Today)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    purchases_query = select(func.sum(ManufacturerPurchase.total_cost)).where(ManufacturerPurchase.manufacturer_id == current_user.id).where(ManufacturerPurchase.date >= today_start)
    today_purchases = (await session.exec(purchases_query)).first() or 0.0
    
    # Sales (Today)
    sales_query = select(func.sum(ManufacturerSale.total_amount)).where(ManufacturerSale.manufacturer_id == current_user.id).where(ManufacturerSale.date >= today_start)
    today_sales = (await session.exec(sales_query)).first() or 0.0
    
    # Net Profit (All Time or Month? Let's do month for now for better utility)
    # Revenue - Purchases - Processing Cost
    # Simple Net Profit Calculation for Dashboard
    
    return {
        "raw_stock": raw_stock,
        "finished_stock": finished_stock,
        "today_purchases": today_purchases,
        "today_sales": today_sales
    }

@router.post("/purchases", response_model=ManufacturerPurchase)
async def create_purchase(
    purchase_in: ManufacturerPurchaseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    check_manufacturer_role(current_user)
    
    # 1. Create Purchase Record
    total_cost = (purchase_in.quantity * purchase_in.price_per_unit) + purchase_in.transport_cost
    
    batch_id = f"M-PUR-{uuid.uuid4().hex[:6].upper()}"
    
    db_purchase = ManufacturerPurchase(
        manufacturer_id=current_user.id,
        farmer_id=purchase_in.farmer_id,
        farmer_name=purchase_in.farmer_name,
        crop_name=purchase_in.crop_name,
        quantity=purchase_in.quantity,
        unit=purchase_in.unit,
        price_per_unit=purchase_in.price_per_unit,
        total_cost=total_cost,
        transport_cost=purchase_in.transport_cost,
        quality_grade=purchase_in.quality_grade,
        batch_id=batch_id
    )
    session.add(db_purchase)
    
    # 2. Add to Inventory (Product)
    # Check if raw material exists or create new 'lot'
    # For traceability, ideally we create a new Product entry for this batch
    
    new_product = Product(
        user_id=current_user.id,
        name=f"Raw {purchase_in.crop_name}",
        category="raw_material",
        brand=purchase_in.farmer_name, # Source
        price=0, # Not for sale usually
        cost_price=purchase_in.price_per_unit,
        quantity=purchase_in.quantity,
        unit=purchase_in.unit,
        batch_number=batch_id,
        description=f"Purchased from {purchase_in.farmer_name}",
        traceability_json="{}" # Can add details here
    )
    session.add(new_product)
    
    await session.commit()
    await session.refresh(db_purchase)
    return db_purchase

@router.get("/purchases", response_model=List[ManufacturerPurchase])
async def get_purchases(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    check_manufacturer_role(current_user)
    statement = select(ManufacturerPurchase).where(ManufacturerPurchase.manufacturer_id == current_user.id).order_by(ManufacturerPurchase.date.desc())
    result = await session.exec(statement)
    return result.all()

@router.post("/production", response_model=ProductionBatch)
async def create_production_batch(
    batch_in: ProductionBatchCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    check_manufacturer_role(current_user)
    
    # 1. Validate Input Stock
    input_product = await session.get(Product, batch_in.input_product_id)
    if not input_product or input_product.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Input product not found")
        
    if input_product.quantity < batch_in.input_qty:
        raise HTTPException(status_code=400, detail="Insufficient raw material stock")
        
    # 2. Consume Input
    input_product.quantity -= batch_in.input_qty
    session.add(input_product)
    
    # 3. Create Production Batch
    batch_num = f"M-PROD-{uuid.uuid4().hex[:6].upper()}"
    efficiency = (batch_in.output_qty / batch_in.input_qty) * 100 if batch_in.input_qty > 0 else 0
    waste = batch_in.input_qty - batch_in.output_qty # Simple logic, assumes unit match (kg->kg)
    if waste < 0: waste = 0 # In case output > input (e.g. adding water)
    
    db_batch = ProductionBatch(
        manufacturer_id=current_user.id,
        input_product_id=batch_in.input_product_id,
        input_qty=batch_in.input_qty,
        output_product_name=batch_in.output_product_name,
        output_qty=batch_in.output_qty,
        output_unit=batch_in.output_unit,
        processing_cost=batch_in.processing_cost,
        waste_qty=waste,
        efficiency=efficiency,
        batch_number=batch_num
    )
    session.add(db_batch)
    
    # 4. Add Output to Inventory (Finished Goods)
    # Calculate Cost Price of finished good: (Raw Cost + Processing Cost) / Output Qty
    raw_cost = (input_product.cost_price or 0) * batch_in.input_qty
    total_batch_cost = raw_cost + batch_in.processing_cost
    unit_cost = total_batch_cost / batch_in.output_qty if batch_in.output_qty > 0 else 0
    
    finished_product = Product(
        user_id=current_user.id,
        name=batch_in.output_product_name,
        category="processed",
        brand=current_user.full_name,
        price=unit_cost * 1.2, # Default markup 20%
        cost_price=unit_cost,
        quantity=batch_in.output_qty,
        unit=batch_in.output_unit,
        batch_number=batch_num,
        description=f"Processed from {input_product.name}",
    )
    session.add(finished_product)
    
    await session.commit()
    await session.refresh(db_batch)
    return db_batch

@router.get("/production", response_model=List[ProductionBatch])
async def get_production_history(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    check_manufacturer_role(current_user)
    statement = select(ProductionBatch).where(ProductionBatch.manufacturer_id == current_user.id).order_by(ProductionBatch.date.desc())
    result = await session.exec(statement)
    return result.all()

@router.post("/sales", response_model=ManufacturerSale)
async def create_sale(
    sale_in: ManufacturerSaleCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    check_manufacturer_role(current_user)
    
    # 1. Validate Stock
    product = await session.get(Product, sale_in.product_id)
    if not product or product.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if product.quantity < sale_in.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
        
    # 2. Deduct Stock
    product.quantity -= sale_in.quantity
    session.add(product)
    
    # 3. Create Sale Record
    total = (sale_in.quantity * sale_in.selling_price) - sale_in.discount
    invoice_id = f"INV-{uuid.uuid4().hex[:6].upper()}"
    
    db_sale = ManufacturerSale(
        manufacturer_id=current_user.id,
        buyer_type=sale_in.buyer_type,
        buyer_id=sale_in.buyer_id,
        buyer_name=sale_in.buyer_name,
        product_id=sale_in.product_id,
        quantity=sale_in.quantity,
        selling_price=sale_in.selling_price,
        discount=sale_in.discount,
        total_amount=total,
        payment_mode=sale_in.payment_mode,
        invoice_id=invoice_id
    )
    session.add(db_sale)
    
    await session.commit()
    await session.refresh(db_sale)
    return db_sale

@router.get("/sales", response_model=List[ManufacturerSale])
async def get_sales_history(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    check_manufacturer_role(current_user)
    statement = select(ManufacturerSale).where(ManufacturerSale.manufacturer_id == current_user.id).order_by(ManufacturerSale.date.desc())
    result = await session.exec(statement)
    return result.all()
