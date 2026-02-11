from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, col

from ..database import get_session
from ..models import (
    Crop, CropCreate, CropRead, User, CropUpdate,
    CropExpense, CropExpenseCreate, CropExpenseRead
)
from ..deps import get_current_user

router = APIRouter(prefix="/crops", tags=["crops"])

from ..services.crop_service import recalculate_crop_financials

@router.post("/")
async def create_crop(request: Request):
    try:
        body = await request.json()
        return {"message": "DEBUG_OK", "body": body}
    except Exception as e:
        return {"error": str(e)}

@router.get("/", response_model=List[CropRead])
async def read_my_crops(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    statement = select(Crop).where(Crop.user_id == current_user.id)
    result = await session.exec(statement)
    return result.all()

@router.get("/market", response_model=List[CropRead])
async def read_market_crops(
    session: AsyncSession = Depends(get_session)
):
    # Available for manufacturers to see
    statement = select(Crop).where(Crop.status == "Harvested") 
    result = await session.exec(statement)
    return result.all()

@router.get("/{crop_id}", response_model=CropRead)
async def read_crop_detail(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    if crop.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to view this crop")
    return crop

@router.put("/{crop_id}", response_model=CropRead)
async def update_crop(
    crop_id: int,
    crop_update: CropUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    db_crop = await session.get(Crop, crop_id)
    if not db_crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    if db_crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    crop_data = crop_update.dict(exclude_unset=True)
    for key, value in crop_data.items():
        setattr(db_crop, key, value)
        
    session.add(db_crop)
    await session.commit()
    await session.refresh(db_crop)
    return db_crop

# --- Expense Management ---

@router.post("/{crop_id}/expenses", response_model=CropExpenseRead)
async def add_crop_expense(
    crop_id: int,
    expense: CropExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_expense = CropExpense.from_orm(expense)
    db_expense.crop_id = crop_id
    
    # Auto-calculate total cost if not provided (though frontend should ideally send it)
    if db_expense.total_cost == 0 and db_expense.quantity and db_expense.unit_cost:
        db_expense.total_cost = db_expense.quantity * db_expense.unit_cost
        
    session.add(db_expense)
    await session.commit()
    await session.refresh(db_expense)
    
    # Update Crop Financials
    await recalculate_crop_financials(crop_id, session)
    
    return db_expense

@router.get("/{crop_id}/expenses", response_model=List[CropExpenseRead])
async def get_crop_expenses(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
         raise HTTPException(status_code=404, detail="Crop not found")
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    statement = select(CropExpense).where(CropExpense.crop_id == crop_id).order_by(col(CropExpense.date).desc())
    result = await session.exec(statement)
    return result.all()

@router.delete("/{crop_id}/expenses/{expense_id}")
async def delete_crop_expense(
    crop_id: int,
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
         raise HTTPException(status_code=404, detail="Crop not found")
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    expense = await session.get(CropExpense, expense_id)
    if not expense or expense.crop_id != crop_id:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    await session.delete(expense)
    await session.commit()
    
    # Update Crop Financials
    await calculate_crop_financials(crop, session)
    
    return {"ok": True}

# --- Yield & Profit ---

@router.post("/{crop_id}/harvest", response_model=CropRead)
async def record_harvest_sale(
    crop_id: int,
    yield_data: dict, # { "actual_yield": float, "selling_price_per_unit": float }
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    crop = await session.get(Crop, crop_id)
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    if crop.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update harvest data
    if "actual_yield" in yield_data:
        crop.actual_yield = float(yield_data["actual_yield"])
    if "selling_price_per_unit" in yield_data:
        crop.selling_price_per_unit = float(yield_data["selling_price_per_unit"])
        
    crop.status = "Harvested"
        
    # Recalculate everything
    # Recalculate everything
    updated_crop = await recalculate_crop_financials(crop.id, session)
    return updated_crop
