from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import json
from datetime import date
from ..models.shop_accounting import ShopAccountingExpense

from ..database import get_session
from ..models import Product, ProductCreate, ProductRead, User, BulkProductReceive
from ..deps import get_current_user

router = APIRouter(prefix="/products", tags=["products"])

# Extended read model with seller info
class ProductWithSeller(ProductRead):
    seller_name: Optional[str] = None
    
    class Config:
        from_attributes = True

def _strip_tz(dt):
    """Strip timezone from datetime to avoid asyncpg offset-aware error."""
    if dt and hasattr(dt, "tzinfo") and dt.tzinfo:
        return dt.replace(tzinfo=None)
    return dt

@router.post("/", response_model=ProductRead)
async def create_product(
    product: ProductCreate, 
    current_user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    if current_user.role not in ["shop", "manufacturer", "farmer"]:
        raise HTTPException(status_code=403, detail="Not authorized to sell products")
        
    product_data = product.model_dump() if hasattr(product, "model_dump") else product.dict()
    
    # Strip timezone from all datetime fields
    for field in ["expiry_date", "manufacture_date"]:
        if field in product_data and product_data[field]:
            product_data[field] = _strip_tz(product_data[field])
    
    # Default status to draft if not specified
    product_data.setdefault("status", "draft")
    
    db_product = Product(**product_data, user_id=current_user.id)
    session.add(db_product)
    await session.commit()
    await session.refresh(db_product)

    # --- Auto-create a "batch_purchase" accounting entry ---
    if db_product.cost_price and db_product.cost_price > 0:
        purchase_cost = db_product.cost_price * db_product.quantity
        accounting_entry = ShopAccountingExpense(
            shop_id=current_user.id,
            category="batch_purchase",
            amount=purchase_cost,
            description=f"Purchase: {db_product.name} (Batch: {db_product.batch_number}, Qty: {db_product.quantity} {db_product.unit})",
            linked_product_ids=json.dumps([db_product.id])
        )
        session.add(accounting_entry)
        await session.commit()

    return db_product


@router.patch("/{product_id}/status", response_model=ProductRead)
async def update_product_status(
    product_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Set product status: 'draft' or 'active'."""
    db_product = await session.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    if db_product.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_status = payload.get("status")
    if new_status not in ["draft", "active"]:
        raise HTTPException(status_code=400, detail="status must be 'draft' or 'active'")
    
    old_status = db_product.status
    db_product.status = new_status
    session.add(db_product)

    await session.commit()
    await session.refresh(db_product)
    return db_product


@router.post("/bulk-receive", response_model=dict)
async def bulk_receive_products(
    receipt: BulkProductReceive,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role not in ["shop", "manufacturer", "farmer"]:
        raise HTTPException(status_code=403, detail="Not authorized to receive products")
        
    # Calculate total value weight to proportionally distribute expenses
    total_value = sum(item.cost_price * item.quantity for item in receipt.items)
    
    products_created = []
    
    for item in receipt.items:
        item_value = item.cost_price * item.quantity
        weight_ratio = (item_value / total_value) if total_value > 0 else (1.0 / len(receipt.items))
        
        apportioned_trans = receipt.total_transport_cost * weight_ratio
        apportioned_lab = receipt.total_labour_cost * weight_ratio
        apportioned_oth = receipt.total_other_cost * weight_ratio
        
        product_data = item.model_dump() if hasattr(item, "model_dump") else item.dict()
        
        for field in ["expiry_date", "manufacture_date"]:
            if field in product_data and product_data[field]:
                product_data[field] = _strip_tz(product_data[field])
        
        # Bulk receive products are saved as drafts until owner marks them active
        db_product = Product(
            **product_data,
            user_id=current_user.id,
            status="draft",
            apportioned_transport=apportioned_trans,
            apportioned_labour=apportioned_lab,
            apportioned_other=apportioned_oth
        )
        session.add(db_product)
        products_created.append(db_product)
        
    await session.flush()  # flush to get IDs

    # Record the purchase cost entry for each product
    for prod in products_created:
        if prod.cost_price and prod.cost_price > 0:
            purchase_cost = prod.cost_price * prod.quantity
            accounting_entry = ShopAccountingExpense(
                shop_id=current_user.id,
                category="batch_purchase",
                amount=purchase_cost,
                description=f"Purchase: {prod.name} (Batch: {prod.batch_number})",
                linked_product_ids=json.dumps([prod.id])
            )
            session.add(accounting_entry)

    # Record shared overhead expense entries
    total_expense = receipt.total_transport_cost + receipt.total_labour_cost + receipt.total_other_cost
    if total_expense > 0:
        all_ids = json.dumps([p.id for p in products_created])
        notes_base = f"Bulk delivery overhead ({len(receipt.items)} items). " + (receipt.expense_notes or "")

        if receipt.total_transport_cost > 0:
            session.add(ShopAccountingExpense(
                shop_id=current_user.id, category="batch_transport",
                amount=receipt.total_transport_cost,
                description=notes_base, linked_product_ids=all_ids
            ))
        if receipt.total_labour_cost > 0:
            session.add(ShopAccountingExpense(
                shop_id=current_user.id, category="batch_labour",
                amount=receipt.total_labour_cost,
                description=notes_base, linked_product_ids=all_ids
            ))
        if receipt.total_other_cost > 0:
            session.add(ShopAccountingExpense(
                shop_id=current_user.id, category="batch_other",
                amount=receipt.total_other_cost,
                description=notes_base, linked_product_ids=all_ids
            ))
            
    await session.commit()
    return {"message": "Success", "products_received": len(products_created), "total_apportioned_overhead": total_expense}


@router.get("/", response_model=List[ProductWithSeller])
async def read_products(
    category: str = None,
    shop_id: int = None,
    session: AsyncSession = Depends(get_session)
):
    """Get all ACTIVE products visible to customers."""
    statement = select(Product, User.full_name).join(User, Product.user_id == User.id)
    statement = statement.where(Product.status == "active")  # Only show active products to public
    if category:
        statement = statement.where(Product.category == category)
    if shop_id:
        statement = statement.where(Product.user_id == shop_id)
    result = await session.exec(statement)
    
    products = []
    for product, seller_name in result:
        p = ProductWithSeller.from_orm(product)
        p.seller_name = seller_name
        products.append(p)
    return products
    
@router.get("/shops", response_model=list)
async def get_shops(session: AsyncSession = Depends(get_session)):
    """Get all shops that have products listed."""
    statement = select(User.id, User.full_name).where(User.role == "shop")
    result = await session.exec(statement)
    shops = [{"id": id, "name": name} for id, name in result]
    return shops

@router.get("/{product_id}", response_model=ProductWithSeller)
async def read_product(
    product_id: int,
    session: AsyncSession = Depends(get_session)
):
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    seller = await session.get(User, product.user_id)
    p = ProductWithSeller.from_orm(product)
    p.seller_name = seller.full_name if seller else "Unknown"
    return p

@router.get("/my/all", response_model=List[ProductRead])
async def read_my_products(
    status: Optional[str] = None,  # "draft" | "active" | None (all)
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get owner's own products. Optionally filter by status."""
    statement = select(Product).where(Product.user_id == current_user.id)
    if status in ["draft", "active"]:
        statement = statement.where(Product.status == status)
    result = await session.exec(statement)
    return result.all()

@router.put("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: int,
    product_update: ProductCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    db_product = await session.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    if db_product.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this product")
    
    product_data = product_update.dict(exclude_unset=True)
    
    for field in ["expiry_date", "manufacture_date"]:
        if field in product_data and product_data[field]:
            product_data[field] = _strip_tz(product_data[field])
        
    old_status = db_product.status

    for key, value in product_data.items():
        setattr(db_product, key, value)
        
    new_status = db_product.status

    if new_status == "active" and old_status == "draft":
        purchase_cost = (db_product.cost_price or 0) * db_product.quantity
        total_overhead = (db_product.apportioned_transport or 0) + (db_product.apportioned_labour or 0) + (db_product.apportioned_other or 0)
        total_landed = purchase_cost + total_overhead
        overhead_breakdown = []
        if db_product.apportioned_transport:
            overhead_breakdown.append(f"Transport: ₹{db_product.apportioned_transport:.2f}")
        if db_product.apportioned_labour:
            overhead_breakdown.append(f"Labour: ₹{db_product.apportioned_labour:.2f}")
        if db_product.apportioned_other:
            overhead_breakdown.append(f"Other: ₹{db_product.apportioned_other:.2f}")
        overhead_str = " | ".join(overhead_breakdown) if overhead_breakdown else "No overhead"
        desc = (
            f"Batch Activated — {db_product.name} (Batch: {db_product.batch_number}) | "
            f"Qty: {db_product.quantity} {db_product.unit} | "
            f"Cost/unit: ₹{db_product.cost_price or 0} | "
            f"Purchase: ₹{purchase_cost:.2f} | "
            f"{overhead_str} | "
            f"Total Landed: ₹{total_landed:.2f}"
        )
        activation_entry = ShopAccountingExpense(
            shop_id=current_user.id,
            category="batch_activation",
            amount=purchase_cost,
            description=desc,
            linked_product_ids=json.dumps([db_product.id]),
        )
        session.add(activation_entry)

    session.add(db_product)
    await session.commit()
    await session.refresh(db_product)
    return db_product

@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    db_product = await session.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    if db_product.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this product")
        
    await session.delete(db_product)
    await session.commit()
    return {"ok": True}
