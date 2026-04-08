from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, col
from datetime import datetime, timedelta

from ..database import get_session
from ..models import ShopOrder, ShopOrderItem, Product, User, CropExpense, Crop, ShopAccountingExpense
from ..deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/expenses")
async def get_expense_analytics(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Aggregate expenses by category
    query = select(CropExpense.category, func.sum(CropExpense.total_cost))\
        .join(Crop, Crop.id == CropExpense.crop_id)\
        .where(Crop.user_id == current_user.id)\
        .group_by(CropExpense.category)
        
    results = await session.exec(query)
    # Handle case where results might be empty or valid
    data = [{"category": row[0], "amount": row[1]} for row in results.all()]
    return data

@router.get("/market-trends")
async def get_market_trends():
    """Returns mock market trend data"""
    # In a real app, this would come from an external API or database
    trends = [
        {"crop": "Wheat", "price": 2250, "unit": "q", "change": 2.5, "trend": "up"},
        {"crop": "Rice", "price": 1980, "unit": "q", "change": -1.2, "trend": "down"},
        {"crop": "Cotton", "price": 6100, "unit": "q", "change": 0.5, "trend": "stable"},
        {"crop": "Sugarcane", "price": 310, "unit": "ton", "change": 0.0, "trend": "stable"},
        {"crop": "Chilli", "price": 18500, "unit": "q", "change": 5.0, "trend": "up"},
        {"crop": "Maize", "price": 2100, "unit": "q", "change": -0.8, "trend": "down"}
    ]
    return trends

@router.get("/recommendations")
async def get_recommendations():
    """Returns mock crop recommendations"""
    # Logic could be based on season, location, soil type etc.
    recommendations = [
        {"name": "Mustard", "reason": "High demand expected next season. Suitable for current weather."},
        {"name": "Chickpea", "reason": "Low water requirement, good for soil nitrogen fixation."},
        {"name": "Sunflower", "reason": "Short duration cash crop with good market price."}
    ]
    return recommendations

@router.get("/shop/overview")
async def get_shop_overview(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    # 1. Total Products
    products_query = select(func.count(Product.id)).where(Product.user_id == current_user.id)
    products_count = (await session.exec(products_query)).first() or 0

    # 2. Total Stock (Sum of quantity)
    stock_query = select(func.sum(Product.quantity)).where(Product.user_id == current_user.id)
    total_stock = (await session.exec(stock_query)).first() or 0

    # 3. Today's Sales
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    sales_query = select(func.sum(ShopOrder.total_amount))\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.created_at >= today_start)
    today_sales = (await session.exec(sales_query)).first() or 0.0

    # 4. Monthly Revenue
    month_start = today_start.replace(day=1)
    revenue_query = select(func.sum(ShopOrder.total_amount))\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.created_at >= month_start)
    month_revenue = (await session.exec(revenue_query)).first() or 0.0

    # 5. Low Stock
    low_stock_query = select(func.count(Product.id))\
        .where(Product.user_id == current_user.id)\
        .where(Product.quantity < Product.low_stock_threshold)
    low_stock_count = (await session.exec(low_stock_query)).first() or 0

    # 6. Pending Orders
    pending_query = select(func.count(ShopOrder.id))\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.status == "pending")
    pending_orders = (await session.exec(pending_query)).first() or 0

    return {
        "total_products": products_count,
        "total_stock": total_stock,
        "today_sales": today_sales,
        "month_revenue": month_revenue,
        "low_stock_count": low_stock_count,
        "pending_orders": pending_orders
    }

@router.get("/shop/sales-trend")
@router.get("/shop/sales-trend")
async def get_sales_trend(
    period: str = Query("7d", description="7d|30d|90d|1y"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Returns daily sales for a given period: 7d, 30d, 90d, 1y"""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    period_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = period_map.get(period, 7)
        
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = select(ShopOrder.created_at, ShopOrder.total_amount)\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.created_at >= start_date)\
        .order_by(ShopOrder.created_at)
        
    results = await session.exec(query)
    orders = results.all()
    
    # Aggregate by date
    daily_stats = {}
    for i in range(days):
        date_str = (datetime.utcnow() - timedelta(days=days-1-i)).strftime("%Y-%m-%d")
        daily_stats[date_str] = {"sales": 0.0, "order_count": 0}
        
    for created_at, amount in orders:
        date_key = created_at.strftime("%Y-%m-%d")
        if date_key in daily_stats:
            daily_stats[date_key]["sales"] += amount
            daily_stats[date_key]["order_count"] += 1
            
    return [{"date": k, "sales": v["sales"], "order_count": v["order_count"]} for k, v in daily_stats.items()]

@router.get("/shop/category-distribution")
async def get_category_distribution(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    query = select(Product.category, func.sum(Product.quantity))\
        .where(Product.user_id == current_user.id)\
        .group_by(Product.category)
        
    results = await session.exec(query)
    return [{"category": row[0], "stock": row[1]} for row in results.all()]

@router.get("/customers")
async def get_shop_customers(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Returns a list of farmers who have purchased from this shop, 
    ordered by total spend.
    """
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Group orders by farmer_id
    # We need farmer name, location (if available in User model), total spent, order count
    # Since User model is simple, we might just get ID and Name (if we join)
    # For now, let's group by farmer_id and sum total_amount
    
    query = select(
            ShopOrder.farmer_id, 
            func.count(ShopOrder.id).label("order_count"), 
            func.sum(ShopOrder.final_amount).label("total_spent"),
            func.max(ShopOrder.created_at).label("last_order")
        )\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.farmer_id != None)\
        .group_by(ShopOrder.farmer_id)\
        .order_by(col("total_spent").desc())
        
    results = await session.exec(query)
    customers = []
    for row in results.all():
        farmer_id, count, spent, last_date = row
        # Fetch details (could be optimized with join)
        farmer_user = await session.get(User, farmer_id)
        name = farmer_user.full_name if farmer_user else f"Farmer #{farmer_id}"
        
        customers.append({
            "id": farmer_id,
            "name": name,
            "full_name": name, # Alias for frontend
            "total_orders": count,
            "total_spent": spent,
            "last_order_date": last_date
        })
        
    return customers

@router.get("/farmer/overview")
async def get_farmer_overview(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # 1. Total Revenue & Profit
    from ..models import Crop
    financials_query = select(
        func.sum(Crop.total_revenue),
        func.sum(Crop.net_profit),
        func.sum(Crop.actual_yield)
    ).where(Crop.user_id == current_user.id)
    
    financials = (await session.exec(financials_query)).first()
    
    total_revenue = financials[0] or 0.0
    total_profit = financials[1] or 0.0
    total_yield = financials[2] or 0.0
    
    # 2. Active Crops Count
    active_query = select(func.count(Crop.id)).where(Crop.user_id == current_user.id).where(Crop.status == "Growing")
    active_count = (await session.exec(active_query)).first() or 0
    
    return {
        "total_revenue": total_revenue,
        "total_profit": total_profit,
        "total_yield": total_yield,
        "active_crops": active_count
    }

@router.get("/farmer/yield-trend")
async def get_yield_trend(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    from ..models import Crop
    # Aggregate yield by Crop Name
    query = select(Crop.name, func.sum(Crop.actual_yield))\
        .where(Crop.user_id == current_user.id)\
        .where(Crop.status == "Harvested")\
        .group_by(Crop.name)
        
    results = (await session.exec(query)).all()
    
    return [{"name": name, "yield": val} for name, val in results]


@router.get("/shop/revenue")
async def get_shop_revenue(
    period: str = Query("all", description="today|7d|30d|90d|1y|all"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Returns total revenue, cost, expenses, and profit for the shop owner."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    shop_id = current_user.id

    # Date range filter
    now = datetime.utcnow()
    today = now.date()
    date_filter = True  # Default: no filter
    if period == "today":
        start = datetime.combine(today, datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "7d":
        start = datetime.combine(today - timedelta(days=7), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "30d":
        start = datetime.combine(today - timedelta(days=30), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "90d":
        start = datetime.combine(today - timedelta(days=90), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "1y":
        start = datetime.combine(today - timedelta(days=365), datetime.min.time())
        date_filter = ShopOrder.created_at >= start

    # 1. Total Revenue (all completed orders)
    rev_query = select(func.coalesce(func.sum(ShopOrder.final_amount), 0.0)).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.status == "completed",
        date_filter
    )
    total_revenue = (await session.exec(rev_query)).first() or 0.0

    # 2. Total Business Expenses (from shop_accounting_expenses table, EXCLUDING batch overheads to avoid double-counting)
    exp_query = select(func.coalesce(func.sum(ShopAccountingExpense.amount), 0.0)).where(
        ShopAccountingExpense.shop_id == shop_id,
        ShopAccountingExpense.category.notin_(["batch_transport", "batch_labour", "batch_other"]),
        date_filter
    )
    total_expenses = (await session.exec(exp_query)).first() or 0.0

    # 3. Total cost (Landed cost = cost_price + apportioned overheads) for completed orders
    cost_query = select(
        func.coalesce(func.sum(ShopOrderItem.quantity * (
            func.coalesce(Product.cost_price, 0.0) + 
            func.coalesce(Product.apportioned_transport, 0.0) +
            func.coalesce(Product.apportioned_labour, 0.0) +
            func.coalesce(Product.apportioned_other, 0.0)
        )), 0.0)
    ).join(ShopOrder, ShopOrder.id == ShopOrderItem.order_id).join(
        Product, Product.id == ShopOrderItem.product_id
    ).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.status == "completed",
        Product.cost_price != None,
        date_filter
    )
    total_cost = (await session.exec(cost_query)).first() or 0.0

    profit = total_revenue - total_cost - total_expenses

    # 4. Stats for quick cards
    total_orders_q = select(func.count(ShopOrder.id)).where(ShopOrder.shop_id == shop_id)
    total_orders = (await session.exec(total_orders_q)).first() or 0

    completed_orders_q = select(func.count(ShopOrder.id)).where(
        ShopOrder.shop_id == shop_id, ShopOrder.status == "completed"
    )
    completed_orders = (await session.exec(completed_orders_q)).first() or 0

    avg_ticket = (total_revenue / completed_orders) if completed_orders > 0 else 0.0

    pending_q = select(func.count(ShopOrder.id)).where(
        ShopOrder.shop_id == shop_id, ShopOrder.status == "pending"
    )
    pending_orders = (await session.exec(pending_q)).first() or 0

    return {
        "total_revenue": float(f"{total_revenue:.2f}"),
        "total_cost": float(f"{total_cost:.2f}"),
        "total_expenses": float(f"{total_expenses:.2f}"),
        "profit": float(f"{profit:.2f}"),
        "total_orders": int(total_orders),
        "completed_orders": int(completed_orders),
        "pending_orders": int(pending_orders),
        "avg_ticket": float(f"{avg_ticket:.2f}"),
    }


@router.get("/shop/category-revenue")
async def get_category_revenue(
    period: str = Query("all", description="today|7d|30d|90d|1y|all"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Returns revenue breakdown by product category for the shop."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Date range filter
    now = datetime.utcnow()
    today = now.date()
    date_filter = True
    if period == "today":
        start = datetime.combine(today, datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "7d":
        start = datetime.combine(today - timedelta(days=7), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "30d":
        start = datetime.combine(today - timedelta(days=30), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "90d":
        start = datetime.combine(today - timedelta(days=90), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "1y":
        start = datetime.combine(today - timedelta(days=365), datetime.min.time())
        date_filter = ShopOrder.created_at >= start

    query = select(
        Product.category,
        func.coalesce(func.sum(ShopOrderItem.subtotal), 0.0).label("revenue"),
        func.coalesce(func.sum(ShopOrderItem.quantity), 0).label("qty_sold")
    ).join(ShopOrderItem, ShopOrderItem.product_id == Product.id).join(
        ShopOrder, ShopOrder.id == ShopOrderItem.order_id
    ).where(
        ShopOrder.shop_id == current_user.id,
        date_filter
    ).group_by(Product.category).order_by(col("revenue").desc())

    results = (await session.exec(query)).all()
    return [{"category": r[0], "revenue": float(r[1]), "qty_sold": int(r[2])} for r in results]


@router.get("/shop/top-products")
async def get_top_products(
    period: str = Query("all", description="today|7d|30d|90d|1y|all"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Returns per-product (batch-wise) sales breakdown with profit, batch number, and remaining inventory."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Date range filter
    now = datetime.utcnow()
    today = now.date()
    date_filter = True
    if period == "today":
        start = datetime.combine(today, datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "7d":
        start = datetime.combine(today - timedelta(days=7), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "30d":
        start = datetime.combine(today - timedelta(days=30), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "90d":
        start = datetime.combine(today - timedelta(days=90), datetime.min.time())
        date_filter = ShopOrder.created_at >= start
    elif period == "1y":
        start = datetime.combine(today - timedelta(days=365), datetime.min.time())
        date_filter = ShopOrder.created_at >= start

    query = select(
        ShopOrderItem.product_id,
        ShopOrderItem.product_name,
        func.coalesce(func.sum(ShopOrderItem.quantity), 0).label("units_sold"),
        func.coalesce(func.sum(ShopOrderItem.subtotal), 0.0).label("revenue"),
    ).join(ShopOrder, ShopOrder.id == ShopOrderItem.order_id).where(
        ShopOrder.shop_id == current_user.id,
        ShopOrder.status != "cancelled",
        date_filter,
    ).group_by(ShopOrderItem.product_id, ShopOrderItem.product_name).order_by(col("revenue").desc())

    results = (await session.exec(query)).all()

    # Fetch product details for cost and batch info
    product_ids = [r[0] for r in results]
    prod_dict: dict = {}
    if product_ids:
        prod_stmt = select(Product).where(Product.id.in_(product_ids))
        prod_res = await session.exec(prod_stmt)
        prod_dict = {p.id: p for p in prod_res.all()}

    output = []
    for pid, pname, units_sold, revenue in results:
        prod = prod_dict.get(pid)
        cost_price = (prod.cost_price or 0) if prod else 0
        total_cost = cost_price * units_sold
        overhead = 0
        if prod:
            overhead = ((prod.apportioned_transport or 0) + (prod.apportioned_labour or 0) + (prod.apportioned_other or 0))
        profit = revenue - total_cost - overhead
        output.append({
            "product_id": pid,
            "product_name": pname,
            "category": prod.category if prod else "unknown",
            "batch_number": prod.batch_number if prod else None,
            "batch_id": pid,
            "units_sold": int(units_sold),
            "revenue": float(revenue),
            "cost_price": cost_price,
            "total_cost": total_cost,
            "overhead": overhead,
            "profit": float(profit),
            "remaining_qty": prod.quantity if prod else 0,
        })

    return output
