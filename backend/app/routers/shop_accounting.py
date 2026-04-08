from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func
from sqlalchemy import text
import json

from ..database import get_session
from ..models import ShopOrder, ShopOrderItem, Product, User
from ..models.shop_accounting import ShopAccountingExpense, ShopAccountingExpenseCreate
from ..deps import get_current_user

router = APIRouter(prefix="/shop-accounting", tags=["shop-accounting"])


def _get_date_range(period: str):
    """Return (start_date, end_date) for a period string."""
    now = datetime.utcnow()
    today = now.date()
    if period == "today":
        return today, today
    elif period == "7d":
        return today - timedelta(days=7), today
    elif period == "30d":
        return today - timedelta(days=30), today
    elif period == "90d":
        return today - timedelta(days=90), today
    elif period == "1y":
        return today - timedelta(days=365), today
    else:  # "all"
        return date(2000, 1, 1), today


@router.get("/summary")
async def get_accounting_summary(
    period: str = Query("30d", description="today|7d|30d|90d|1y|all"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Aggregated financial summary for the shop over a period."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    start_date, end_date = _get_date_range(period)
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Orders in period
    order_stmt = (
        select(ShopOrder)
        .where(
            ShopOrder.shop_id == current_user.id,
            ShopOrder.created_at >= start_dt,
            ShopOrder.created_at <= end_dt,
        )
    )
    order_result = await session.exec(order_stmt)
    orders = order_result.all()

    completed = [o for o in orders if o.status == "completed"]
    total_revenue = sum(o.final_amount for o in completed)
    total_order_expenses = sum(o.total_expenses for o in completed)

    # Product cost calculation
    product_ids = set()
    for o in completed:
        # Need to load items
        item_stmt = select(ShopOrderItem).where(ShopOrderItem.order_id == o.id)
        item_res = await session.exec(item_stmt)
        items = item_res.all()
        for item in items:
            product_ids.add(item.product_id)

    prod_dict = {}
    if product_ids:
        prod_stmt = select(Product).where(Product.id.in_(list(product_ids)))
        prod_res = await session.exec(prod_stmt)
        prod_dict = {p.id: p for p in prod_res.all()}

    total_cost = 0.0
    for o in completed:
        item_stmt = select(ShopOrderItem).where(ShopOrderItem.order_id == o.id)
        item_res = await session.exec(item_stmt)
        items = item_res.all()
        for item in items:
            prod = prod_dict.get(item.product_id)
            if prod and prod.cost_price:
                total_cost += prod.cost_price * item.quantity

    # Business expenses in period
    exp_stmt = select(ShopAccountingExpense).where(
        ShopAccountingExpense.shop_id == current_user.id,
        ShopAccountingExpense.expense_date >= start_date,
        ShopAccountingExpense.expense_date <= end_date,
    )
    exp_result = await session.exec(exp_stmt)
    expenses = exp_result.all()
    total_business_expenses = sum(e.amount for e in expenses)
    # Operational expenses exclude batch_purchase and batch_activation
    # (those are already reflected in total_cost / product cost)
    operational_expenses = sum(
        e.amount for e in expenses
        if e.category not in ("batch_purchase", "batch_activation")
    )

    # Expense breakdown by category
    expense_by_category = {}
    for e in expenses:
        expense_by_category[e.category] = expense_by_category.get(e.category, 0) + e.amount

    net_profit = total_revenue - total_cost - total_order_expenses - operational_expenses

    return {
        "period": period,
        "total_revenue": total_revenue,
        "total_cost": total_cost,
        "total_order_expenses": total_order_expenses,
        "total_business_expenses": total_business_expenses,
        "net_profit": net_profit,
        "total_orders": len(orders),
        "completed_orders": len(completed),
        "pending_orders": len([o for o in orders if o.status == "pending"]),
        "cancelled_orders": len([o for o in orders if o.status == "cancelled"]),
        "avg_order_value": total_revenue / len(completed) if completed else 0,
        "expense_by_category": expense_by_category,
    }


@router.get("/batch-analysis")
async def get_batch_analysis(
    period: str = Query("30d"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Per-product profitability breakdown."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    start_date, end_date = _get_date_range(period)
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Get completed orders in period
    order_stmt = select(ShopOrder).where(
        ShopOrder.shop_id == current_user.id,
        ShopOrder.status == "completed",
        ShopOrder.created_at >= start_dt,
        ShopOrder.created_at <= end_dt,
    )
    order_result = await session.exec(order_stmt)
    orders = order_result.all()

    # Aggregate by product
    product_stats = {}  # product_id -> {name, qty, revenue, cost}
    for o in orders:
        item_stmt = select(ShopOrderItem).where(ShopOrderItem.order_id == o.id)
        item_res = await session.exec(item_stmt)
        items = item_res.all()
        for item in items:
            if item.product_id not in product_stats:
                product_stats[item.product_id] = {
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "qty_sold": 0,
                    "revenue": 0.0,
                    "cost": 0.0,
                }
            product_stats[item.product_id]["qty_sold"] += item.quantity
            product_stats[item.product_id]["revenue"] += item.subtotal

    # Get cost prices
    if product_stats:
        prod_stmt = select(Product).where(Product.id.in_(list(product_stats.keys())))
        prod_res = await session.exec(prod_stmt)
        for p in prod_res.all():
            if p.id in product_stats:
                product_stats[p.id]["cost"] = (p.cost_price or 0) * product_stats[p.id]["qty_sold"]

    result = []
    for ps in product_stats.values():
        profit = ps["revenue"] - ps["cost"]
        margin = (profit / ps["revenue"] * 100) if ps["revenue"] > 0 else 0
        result.append({
            **ps,
            "profit": profit,
            "margin": round(margin, 1),
        })

    # Sort by revenue descending
    result.sort(key=lambda x: x["revenue"], reverse=True)
    return result


@router.get("/expenses")
async def list_expenses(
    period: str = Query("30d"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all business expenses for the shop."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    start_date, end_date = _get_date_range(period)

    stmt = (
        select(ShopAccountingExpense)
        .where(
            ShopAccountingExpense.shop_id == current_user.id,
            ShopAccountingExpense.expense_date >= start_date,
            ShopAccountingExpense.expense_date <= end_date,
        )
        .order_by(ShopAccountingExpense.expense_date.desc())
    )
    result = await session.exec(stmt)
    expenses = result.all()

    return [
        {
            "id": e.id,
            "category": e.category,
            "amount": e.amount,
            "description": e.description,
            "expense_date": e.expense_date.isoformat(),
            "created_at": e.created_at.isoformat(),
        }
        for e in expenses
    ]


@router.get("/draft-batches")
async def get_draft_batches(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Returns all draft product batches owned by this shop (for expense linking)."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(Product).where(
        Product.user_id == current_user.id,
        Product.status == "draft"
    )
    result = await session.exec(stmt)
    products = result.all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "batch_number": p.batch_number,
            "cost_price": p.cost_price or 0,
            "quantity": p.quantity,
            "unit": p.unit,
            "total_value": (p.cost_price or 0) * p.quantity,
            "category": p.category,
            "created_at": p.created_at.isoformat(),
            "apportioned_transport": p.apportioned_transport,
            "apportioned_labour": p.apportioned_labour,
            "apportioned_other": p.apportioned_other,
        }
        for p in products
    ]


@router.post("/expenses")
async def create_expense(
    data: ShopAccountingExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a new business expense. If product_ids provided for batch categories, distribute proportionally."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    expense_date = date.today()
    if data.expense_date:
        try:
            expense_date = date.fromisoformat(data.expense_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Batch categories that can be linked to specific product batches
    BATCH_CATEGORIES = {"batch_transport", "batch_labour", "batch_other"}
    linked_ids_json = None
    distributed_to = 0

    if data.product_ids and data.category in BATCH_CATEGORIES:
        # Fetch the selected draft products
        product_ids = [int(pid) for pid in data.product_ids]
        stmt = select(Product).where(
            Product.id.in_(product_ids),
            Product.user_id == current_user.id
        )
        result = await session.exec(stmt)
        selected_products = result.all()

        if selected_products:
            # Calculate total cost×qty weight
            total_weight = sum((p.cost_price or 0) * p.quantity for p in selected_products)
            linked_ids_json = json.dumps([p.id for p in selected_products])
            distributed_to = len(selected_products)

            for p in selected_products:
                weight = ((p.cost_price or 0) * p.quantity)
                ratio = (weight / total_weight) if total_weight > 0 else (1.0 / len(selected_products))
                share = data.amount * ratio

                if data.category == "batch_transport":
                    p.apportioned_transport = (p.apportioned_transport or 0) + share
                elif data.category == "batch_labour":
                    p.apportioned_labour = (p.apportioned_labour or 0) + share
                elif data.category == "batch_other":
                    p.apportioned_other = (p.apportioned_other or 0) + share

                session.add(p)

    expense = ShopAccountingExpense(
        shop_id=current_user.id,
        category=data.category,
        amount=data.amount,
        description=data.description,
        expense_date=expense_date,
        linked_product_ids=linked_ids_json,
    )
    session.add(expense)
    await session.commit()
    await session.refresh(expense)

    return {
        "id": expense.id,
        "category": expense.category,
        "amount": expense.amount,
        "description": expense.description,
        "expense_date": expense.expense_date.isoformat(),
        "created_at": expense.created_at.isoformat(),
        "linked_product_ids": expense.linked_product_ids,
        "distributed_to": distributed_to,
    }


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a business expense entry."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    expense = await session.get(ShopAccountingExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.shop_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await session.delete(expense)
    await session.commit()
    return {"ok": True}
