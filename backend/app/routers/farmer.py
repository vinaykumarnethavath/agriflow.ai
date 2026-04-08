from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload
from typing import List

from ..database import get_session
from ..deps import get_current_user
from ..models import (
    User, UserRole, FarmerProfile, FarmerProfileCreate, FarmerProfileRead, 
    LandRecord, LandRecordBase,
    Crop, CropExpense, CropExpenseCreate, CropExpenseRead, CropExpenseWithCrop,
    CropHarvest, CropHarvestCreate, CropHarvestRead,
    CropSale, CropSaleCreate, CropSaleRead
)
# New Service Import
from ..services.crop_service import recalculate_crop_financials


def safe_display_name(user: User) -> str:
    full_name = user.full_name or ""
    if user.email is None and "@" in full_name:
        return ""
    return full_name


router = APIRouter(prefix="/farmer", tags=["farmer"])

@router.get("/profile", response_model=FarmerProfileRead)
async def get_farmer_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != UserRole.FARMER:
        raise HTTPException(status_code=403, detail="Only farmers can access this profile")
    
    statement = select(FarmerProfile).where(FarmerProfile.user_id == current_user.id).options(selectinload(FarmerProfile.land_records))
    result = await session.exec(statement)
    profile = result.first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")
        
    # Create the read model with current user's name
    profile_read = FarmerProfileRead.from_orm(profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read

@router.post("/profile", response_model=FarmerProfileRead)
async def create_or_update_profile(
    profile_data: FarmerProfileCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    print(f"DEBUG: create_or_update_profile payload: {profile_data}")
    if current_user.role != UserRole.FARMER:
        raise HTTPException(status_code=403, detail="Only farmers can update this profile")

    # Update user's name if provided
    if profile_data.full_name:
        current_user.full_name = profile_data.full_name
        session.add(current_user)

    statement = select(FarmerProfile).where(FarmerProfile.user_id == current_user.id).options(selectinload(FarmerProfile.land_records))
    result = await session.exec(statement)
    db_profile = result.first()
    
    exclude_fields = {"full_name"}
    update_data = profile_data.dict(exclude=exclude_fields)
    
    if db_profile:
        # Update existing
        for key, value in update_data.items():
            setattr(db_profile, key, value)
        session.add(db_profile)
    else:
        # Create new
        db_profile = FarmerProfile(**update_data, user_id=current_user.id)
        session.add(db_profile)
    
    await session.commit()
    await session.refresh(db_profile)
    
    # Reload with relationships to avoid MissingGreenlet error
    # Because refresh() only reloads simple attributes, not relationships
    statement_refresh = select(FarmerProfile).where(FarmerProfile.id == db_profile.id).options(selectinload(FarmerProfile.land_records))
    result_refresh = await session.exec(statement_refresh)
    db_profile = result_refresh.first()
    
    profile_read = FarmerProfileRead.from_orm(db_profile)
    profile_read.full_name = safe_display_name(current_user)
    return profile_read

@router.post("/land-records", response_model=LandRecord)
async def add_land_record(
    land_data: LandRecordBase,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    statement = select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    result = await session.exec(statement)
    profile = result.first()
    
    if not profile:
        raise HTTPException(status_code=400, detail="Create a farmer profile first before adding land records")
        
    db_land = LandRecord(**land_data.dict(), farmer_profile_id=profile.id)
    session.add(db_land)
    await session.commit()
    await session.refresh(db_land)
    return db_land

@router.put("/land-records", response_model=List[LandRecord])
async def update_land_records(
    land_data_list: List[LandRecordBase],
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # Get farmer profile
    statement = select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    result = await session.exec(statement)
    profile = result.first()
    
    if not profile:
        raise HTTPException(status_code=400, detail="Create a farmer profile first")
        
    # Delete existing land records
    delete_statement = select(LandRecord).where(LandRecord.farmer_profile_id == profile.id)
    existing_records = await session.exec(delete_statement)
    for record in existing_records:
        await session.delete(record)
        
    # Add new ones
    new_records = []
    for land_data in land_data_list:
        db_land = LandRecord(**land_data.dict(), farmer_profile_id=profile.id)
        session.add(db_land)
        new_records.append(db_land)
        
    await session.commit()
    for record in new_records:
        await session.refresh(record)
        
    return new_records

@router.get("/expenses", response_model=List[CropExpenseWithCrop])
async def get_all_farmer_expenses(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get all expenses for the current farmer across all their crops.
    """
    if current_user.role != UserRole.FARMER:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Join CropExpense with Crop to get crop name, filter by user_id
    statement = (
        select(CropExpense, Crop.name)
        .join(Crop, CropExpense.crop_id == Crop.id)
        .where(Crop.user_id == current_user.id)
        .order_by(CropExpense.date.desc())
    )
    
    result = await session.exec(statement)
    expenses_with_crops = []
    
    for expense, crop_name in result.all():
        # Create the response model merging expense data with crop_name
        expense_dict = expense.dict()
        expense_dict["crop_name"] = crop_name
        expenses_with_crops.append(CropExpenseWithCrop(**expense_dict))
        
    return expenses_with_crops

@router.get("/crops/{crop_id}/expenses", response_model=List[CropExpenseRead])
async def get_crop_expenses(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    statement = select(CropExpense).where(CropExpense.crop_id == crop_id).order_by(CropExpense.date.desc())
    result = await session.exec(statement)
    return result.all()

@router.post("/crops/{crop_id}/expenses", response_model=CropExpense)
async def create_crop_expense(
    crop_id: int,
    expense_data: CropExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_expense = CropExpense(**expense_data.dict(), crop_id=crop_id)
    session.add(db_expense)
    await session.commit()
    await session.refresh(db_expense)
    
    # Recalculate using service
    await recalculate_crop_financials(crop_id, session)
    
    return db_expense

@router.put("/crops/expenses/{expense_id}", response_model=CropExpense)
async def update_crop_expense(
    expense_id: int,
    expense_data: CropExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    expense = await session.get(CropExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    crop = await session.get(Crop, expense.crop_id)
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Update fields
    expense_dict = expense_data.dict(exclude_unset=True)
    for key, value in expense_dict.items():
        setattr(expense, key, value)
        
    session.add(expense)
    await session.commit()
    await session.refresh(expense)
    
    # Recalculate
    await recalculate_crop_financials(crop.id, session)
    
    return expense

@router.delete("/crops/expenses/{expense_id}")
async def delete_crop_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    expense = await session.get(CropExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    crop = await session.get(Crop, expense.crop_id)
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    session.delete(expense)
    await session.commit()
    
    # Recalculate
    await recalculate_crop_financials(crop.id, session)
    
    return {"ok": True}

# --- Harvests ---

@router.post("/crops/{crop_id}/harvests", response_model=CropHarvest)
async def create_crop_harvest(
    crop_id: int,
    harvest_data: CropHarvestCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_harvest = CropHarvest(**harvest_data.dict(), crop_id=crop_id)
    session.add(db_harvest)
    await session.commit()
    await session.refresh(db_harvest)
    
    # Recalculate
    await recalculate_crop_financials(crop_id, session)
    
    return db_harvest

@router.get("/crops/{crop_id}/harvests", response_model=List[CropHarvestRead])
async def get_crop_harvests(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    statement = select(CropHarvest).where(CropHarvest.crop_id == crop_id).order_by(CropHarvest.date.desc())
    result = await session.exec(statement)
    return result.all()

@router.put("/crops/harvests/{harvest_id}", response_model=CropHarvest)
async def update_crop_harvest(
    harvest_id: int,
    harvest_data: CropHarvestCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    harvest = await session.get(CropHarvest, harvest_id)
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")
        
    crop = await session.get(Crop, harvest.crop_id)
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update fields
    harvest_dict = harvest_data.dict(exclude_unset=True)
    for key, value in harvest_dict.items():
        setattr(harvest, key, value)
        
    session.add(harvest)
    await session.commit()
    await session.refresh(harvest)
    
    # Recalculate
    await recalculate_crop_financials(crop.id, session)
    
    return harvest

@router.delete("/crops/harvests/{harvest_id}")
async def delete_crop_harvest(
    harvest_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    harvest = await session.get(CropHarvest, harvest_id)
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")
        
    crop = await session.get(Crop, harvest.crop_id)
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    session.delete(harvest)
    await session.commit()
    
    # Recalculate
    await recalculate_crop_financials(crop.id, session)

    return {"ok": True}

@router.post("/crops/{crop_id}/harvest")
async def record_harvest_legacy(
    crop_id: int,
    harvest_data: dict, 
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # Backward compatibility / Quick record
    if current_user.role != UserRole.FARMER:
        raise HTTPException(status_code=403, detail="Only farmers can record harvest")
        
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    actual_yield = float(harvest_data.get("actual_yield", 0))
    selling_price = float(harvest_data.get("selling_price", 0))
    date_str = harvest_data.get("date", None)
    
    from datetime import datetime
    date = datetime.strptime(date_str, "%Y-%m-%d") if date_str else datetime.utcnow()
    
    # Create a wrapper Harvest Record
    harvest_record = CropHarvest(
        crop_id=crop_id,
        date=date,
        stage="Final Harvest", 
        quantity=actual_yield,
        unit="Quintals", # Assumption
        selling_price_per_unit=selling_price,
        total_revenue=actual_yield * selling_price,
        buyer_type="Market"
    )
    session.add(harvest_record)
    await session.commit()
    
    # Recalculate
    updated_crop = await recalculate_crop_financials(crop_id, session)
    return updated_crop

# --- Crop Sales ---

@router.post("/crops/{crop_id}/sales", response_model=CropSaleRead)
async def create_crop_sale(
    crop_id: int,
    sale_data: CropSaleCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_sale = CropSale(**sale_data.dict(exclude={"harvest_ids"}), crop_id=crop_id)
    session.add(db_sale)
    
    # Update linked harvests
    if sale_data.harvest_ids:
        for h_id in sale_data.harvest_ids:
            harvest = await session.get(CropHarvest, h_id)
            if harvest and harvest.crop_id == crop_id:
                harvest.status = "Sold"
                session.add(harvest)
                
    await session.commit()
    await session.refresh(db_sale)
    
    # Recalculate crop financials with the new sale
    await recalculate_crop_financials(crop_id, session)
    
    return db_sale

@router.get("/crops/{crop_id}/sales", response_model=List[CropSaleRead])
async def get_crop_sales(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    if crop.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    statement = select(CropSale).where(CropSale.crop_id == crop_id).order_by(CropSale.date.desc())
    result = await session.exec(statement)
    return result.all()

@router.put("/crops/sales/{sale_id}", response_model=CropSaleRead)
async def update_crop_sale(
    sale_id: int,
    sale_data: CropSaleCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    sale = await session.get(CropSale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale record not found")
        
    crop = await session.get(Crop, sale.crop_id)
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    sale_dict = sale_data.dict(exclude_unset=True)
    for key, value in sale_dict.items():
        setattr(sale, key, value)
        
    session.add(sale)
    await session.commit()
    await session.refresh(sale)
    
    await recalculate_crop_financials(crop.id, session)
    return sale

@router.delete("/crops/sales/{sale_id}")
async def delete_crop_sale(
    sale_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    sale = await session.get(CropSale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale record not found")
        
    crop = await session.get(Crop, sale.crop_id)
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    await session.delete(sale)
    await session.commit()
    
    await recalculate_crop_financials(crop.id, session)
    return {"ok": True}

