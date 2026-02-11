from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from ..database import get_session
from ..models import Product, ProductCreate, ProductRead, User
from ..deps import get_current_user

router = APIRouter(prefix="/products", tags=["products"])

@router.post("/", response_model=ProductRead)
async def create_product(
    product: ProductCreate, 
    current_user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    if current_user.role not in ["shop", "manufacturer", "farmer"]:
        raise HTTPException(status_code=403, detail="Not authorized to sell products")
        
    db_product = Product.from_orm(product)
    db_product.user_id = current_user.id
    
    # Auto-set expiry if not provided (optional logic, but keeping it simple for now)
    
    session.add(db_product)
    await session.commit()
    await session.refresh(db_product)
    return db_product

@router.get("/", response_model=List[ProductRead])
async def read_products(
    category: str = None,
    session: AsyncSession = Depends(get_session)
):
    statement = select(Product)
    if category:
        statement = statement.where(Product.category == category)
    result = await session.exec(statement)
    return result.all()
    
@router.get("/{product_id}", response_model=ProductRead)
async def read_product(
    product_id: int,
    session: AsyncSession = Depends(get_session)
):
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.get("/my/all", response_model=List[ProductRead])
async def read_my_products(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    statement = select(Product).where(Product.user_id == current_user.id)
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
    for key, value in product_data.items():
        setattr(db_product, key, value)
        
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
