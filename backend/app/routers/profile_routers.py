from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload
from typing import List

from ..database import get_session
from ..deps import get_current_user
from ..models import (
    User, UserRole, 
    MillProfile, MillProfileCreate, MillProfileRead,
    ShopProfile, ShopProfileCreate, ShopProfileRead,
    CustomerProfile, CustomerProfileCreate, CustomerProfileRead
)

router = APIRouter(tags=["profiles"])


def safe_display_name(user: User) -> str:
    full_name = user.full_name or ""
    if user.email is None and "@" in full_name:
        return ""
    return full_name

# --- Mill Profile Endpoints ---

@router.get("/manufacturer/profile", response_model=MillProfileRead)
async def get_mill_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != UserRole.MANUFACTURER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    statement = select(MillProfile).where(MillProfile.user_id == current_user.id)
    result = await session.exec(statement)
    profile = result.first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Mill profile not found")
        
    profile_read = MillProfileRead.from_orm(profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read

@router.post("/manufacturer/profile", response_model=MillProfileRead)
async def create_or_update_mill_profile(
    profile_data: MillProfileCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != UserRole.MANUFACTURER:
        raise HTTPException(status_code=403, detail="Not authorized")

    if profile_data.full_name:
        current_user.full_name = profile_data.full_name
        session.add(current_user)

    statement = select(MillProfile).where(MillProfile.user_id == current_user.id)
    result = await session.exec(statement)
    db_profile = result.first()
    
    exclude_fields = {"full_name"}
    update_data = profile_data.dict(exclude=exclude_fields)
    
    if db_profile:
        for key, value in update_data.items():
            setattr(db_profile, key, value)
        session.add(db_profile)
    else:
        db_profile = MillProfile(**update_data, user_id=current_user.id)
        session.add(db_profile)
    
    await session.commit()
    await session.refresh(db_profile)
    
    profile_read = MillProfileRead.from_orm(db_profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read

# --- Shop Profile Endpoints ---

@router.get("/shop/profile", response_model=ShopProfileRead)
async def get_shop_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != UserRole.SHOP:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    statement = select(ShopProfile).where(ShopProfile.user_id == current_user.id)
    result = await session.exec(statement)
    profile = result.first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Shop profile not found")
        
    profile_read = ShopProfileRead.from_orm(profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read

@router.post("/shop/profile", response_model=ShopProfileRead)
async def create_or_update_shop_profile(
    profile_data: ShopProfileCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != UserRole.SHOP:
        raise HTTPException(status_code=403, detail="Not authorized")

    if profile_data.full_name:
        current_user.full_name = profile_data.full_name
        session.add(current_user)

    statement = select(ShopProfile).where(ShopProfile.user_id == current_user.id)
    result = await session.exec(statement)
    db_profile = result.first()
    
    exclude_fields = {"full_name"}
    update_data = profile_data.dict(exclude=exclude_fields)
    
    if db_profile:
        for key, value in update_data.items():
            setattr(db_profile, key, value)
        session.add(db_profile)
    else:
        db_profile = ShopProfile(**update_data, user_id=current_user.id)
        session.add(db_profile)
    
    await session.commit()
    await session.refresh(db_profile)
    
    profile_read = ShopProfileRead.from_orm(db_profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read

# --- Customer Profile Endpoints ---

@router.get("/customer/profile", response_model=CustomerProfileRead)
async def get_customer_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    statement = select(CustomerProfile).where(CustomerProfile.user_id == current_user.id)
    result = await session.exec(statement)
    profile = result.first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Customer profile not found")
        
    profile_read = CustomerProfileRead.from_orm(profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read

@router.post("/customer/profile", response_model=CustomerProfileRead)
async def create_or_update_customer_profile(
    profile_data: CustomerProfileCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Not authorized")

    if profile_data.full_name:
        current_user.full_name = profile_data.full_name
        session.add(current_user)

    statement = select(CustomerProfile).where(CustomerProfile.user_id == current_user.id)
    result = await session.exec(statement)
    db_profile = result.first()
    
    exclude_fields = {"full_name"}
    update_data = profile_data.dict(exclude=exclude_fields)
    
    if db_profile:
        for key, value in update_data.items():
            setattr(db_profile, key, value)
        session.add(db_profile)
    else:
        db_profile = CustomerProfile(**update_data, user_id=current_user.id)
        session.add(db_profile)
    
    await session.commit()
    await session.refresh(db_profile)
    
    profile_read = CustomerProfileRead.from_orm(db_profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read
