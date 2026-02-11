from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.models import Crop, CropExpense, CropHarvest

async def recalculate_crop_financials(crop_id: int, session: AsyncSession) -> Crop:
    """
    Recalculates total cost, revenue, and net profit for a crop 
    based on all its recorded expenses and harvests.
    """
    crop = await session.get(Crop, crop_id)
    if not crop:
        return None

    # 1. Calculate Total Cost from Expenses
    #    (Assumes total_cost in Expense is correctly calculated/stored)
    statement_expenses = select(CropExpense).where(CropExpense.crop_id == crop_id)
    results_expenses = await session.exec(statement_expenses)
    expenses = results_expenses.all()
    
    total_cost = sum(e.total_cost for e in expenses)
    crop.total_cost = total_cost

    # 2. Calculate Total Revenue & Yield from Harvests
    statement_harvests = select(CropHarvest).where(CropHarvest.crop_id == crop_id)
    results_harvests = await session.exec(statement_harvests)
    harvests = results_harvests.all()
    
    total_revenue = sum(h.total_revenue for h in harvests)
    total_yield = sum(h.quantity for h in harvests)
    
    crop.total_revenue = total_revenue
    crop.actual_yield = total_yield
    
    # 3. Calculate Net Profit
    #    Profit = Revenue - Cost
    crop.net_profit = crop.total_revenue - crop.total_cost
    
    # 4. Update Status (Optional logic)
    #    If there's a "Final Harvest", ensure status is Harvested.
    #    This part defines business rules - let's keep it simple for now.
    is_harvested = any(h.stage == "Final Harvest" or h.stage == "Whole Crop" for h in harvests)
    if is_harvested and crop.status != "Sold": 
         crop.status = "Harvested"

    session.add(crop)
    await session.commit()
    await session.refresh(crop)
    
    return crop
