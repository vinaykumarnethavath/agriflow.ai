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

    SOLD_STATUSES = ["dispatched", "completed"]

    # 3. Today's Sales
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    sales_query = select(func.sum(ShopOrder.final_amount))\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.status.in_(SOLD_STATUSES))\
        .where(ShopOrder.created_at >= today_start)
    today_sales = (await session.exec(sales_query)).first() or 0.0

    # 4. Monthly Revenue
    month_start = today_start.replace(day=1)
    revenue_query = select(func.sum(ShopOrder.final_amount))\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.status.in_(SOLD_STATUSES))\
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
        
    SOLD_STATUSES = ["dispatched", "completed"]
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = select(ShopOrder.created_at, ShopOrder.final_amount)\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.status.in_(SOLD_STATUSES))\
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

@router.get("/shop/customers")
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
    
    SOLD_STATUSES = ["dispatched", "completed"]

    query = select(
            ShopOrder.farmer_id, 
            func.count(ShopOrder.id).label("order_count"), 
            func.sum(ShopOrder.final_amount).label("total_spent"),
            func.max(ShopOrder.created_at).label("last_order")
        )\
        .where(ShopOrder.shop_id == current_user.id)\
        .where(ShopOrder.farmer_id != None)\
        .where(ShopOrder.status.in_(SOLD_STATUSES))\
        .group_by(ShopOrder.farmer_id)\
        .order_by(func.sum(ShopOrder.final_amount).desc())
        
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
    SOLD_STATUSES = ["dispatched", "completed"]

    # Date range filters — separate for orders (datetime) and expenses (date)
    now = datetime.utcnow()
    today = now.date()
    order_date_filter = True   # for ShopOrder.created_at
    expense_date_filter = True  # for ShopAccountingExpense.expense_date
    period_map = {"today": 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
    if period in period_map:
        days_back = period_map[period]
        start_date = today - timedelta(days=days_back)
        start_dt = datetime.combine(start_date, datetime.min.time())
        order_date_filter = ShopOrder.created_at >= start_dt
        expense_date_filter = ShopAccountingExpense.expense_date >= start_date

    # 1. Total Revenue (completed + dispatched orders)
    rev_query = select(func.coalesce(func.sum(ShopOrder.final_amount), 0.0)).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.status.in_(SOLD_STATUSES),
        order_date_filter
    )
    total_revenue = (await session.exec(rev_query)).first() or 0.0

    # 2. Total Business Expenses (from shop_accounting_expenses, EXCLUDING batch cost categories
    #    which are already captured in cost_price and apportioned overheads)
    BATCH_COST_CATEGORIES = [
        "batch_transport", "batch_labour", "batch_other",
        "batch_purchase", "batch_activation"
    ]
    exp_query = select(func.coalesce(func.sum(ShopAccountingExpense.amount), 0.0)).where(
        ShopAccountingExpense.shop_id == shop_id,
        ShopAccountingExpense.category.notin_(BATCH_COST_CATEGORIES),
        expense_date_filter
    )
    total_expenses = (await session.exec(exp_query)).first() or 0.0

    # 3. Total cost (Landed cost = cost_price + apportioned overheads) for sold orders
    cost_query = select(
        ShopOrderItem.product_id,
        func.coalesce(func.sum(ShopOrderItem.quantity), 0)
    ).join(ShopOrder, ShopOrder.id == ShopOrderItem.order_id).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.status.in_(SOLD_STATUSES),
        order_date_filter
    ).group_by(ShopOrderItem.product_id)

    sold_items = (await session.exec(cost_query)).all()

    total_cost = 0.0
    for pid, qty_sold in sold_items:
        prod = await session.get(Product, pid)
        if prod:
            base_cost = (prod.cost_price or 0.0) * qty_sold
            total_overhead = (prod.apportioned_transport or 0) + (prod.apportioned_labour or 0) + (prod.apportioned_other or 0)
            
            lifetime_q = select(func.coalesce(func.sum(ShopOrderItem.quantity), 0)).where(ShopOrderItem.product_id == pid)
            lifetime_sold = (await session.exec(lifetime_q)).first() or 0
            original_batch_qty = (prod.quantity or 0) + lifetime_sold
            
            overhead = 0.0
            if original_batch_qty > 0:
                overhead = total_overhead * (qty_sold / original_batch_qty)
                
            total_cost += base_cost + overhead

    profit = total_revenue - total_cost - total_expenses

    # 4. Stats for quick cards
    total_orders_q = select(func.count(ShopOrder.id)).where(
        ShopOrder.shop_id == shop_id, order_date_filter
    )
    total_orders = (await session.exec(total_orders_q)).first() or 0

    sold_orders_q = select(func.count(ShopOrder.id)).where(
        ShopOrder.shop_id == shop_id, ShopOrder.status.in_(SOLD_STATUSES), order_date_filter
    )
    sold_orders = (await session.exec(sold_orders_q)).first() or 0

    avg_ticket = (total_revenue / sold_orders) if sold_orders > 0 else 0.0

    completed_q = select(func.count(ShopOrder.id)).where(
        ShopOrder.shop_id == shop_id, ShopOrder.status == "completed", order_date_filter
    )
    completed_orders = (await session.exec(completed_q)).first() or 0

    pending_q = select(func.count(ShopOrder.id)).where(
        ShopOrder.shop_id == shop_id, ShopOrder.status == "pending", order_date_filter
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
    """Returns net revenue and profit breakdown by product category for the shop."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    shop_id = current_user.id
    SOLD_STATUSES = ["dispatched", "completed"]

    # Date range filters
    now = datetime.utcnow()
    today = now.date()
    order_date_filter = True
    period_map = {"today": 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
    if period in period_map:
        days_back = period_map[period]
        start_date = today - timedelta(days=days_back)
        start_dt = datetime.combine(start_date, datetime.min.time())
        order_date_filter = ShopOrder.created_at >= start_dt

    # Fetch all items sold in this period with their orders and products
    query = select(
        ShopOrderItem, 
        ShopOrder.total_amount, 
        ShopOrder.final_amount,
        Product
    ).join(ShopOrder, ShopOrder.id == ShopOrderItem.order_id).join(
        Product, Product.id == ShopOrderItem.product_id
    ).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.status.in_(SOLD_STATUSES),
        order_date_filter
    )
    
    results = await session.exec(query)
    items_data = results.all()

    # Aggregate by category
    category_stats = {}
    
    for item, total_amt, final_amt, prod in items_data:
        cat = prod.category or "unknown"
        if cat not in category_stats:
            category_stats[cat] = {"revenue": 0.0, "qty_sold": 0, "profit": 0.0}
        
        # 1. Net Revenue (pro-rate order discount to this item)
        discount_ratio = (final_amt / total_amt) if total_amt > 0 else 1.0
        net_item_revenue = item.subtotal * discount_ratio
        
        # 2. Total Cost (Base Cost + Proportional Overhead)
        base_cost = (prod.cost_price or 0.0) * item.quantity
        total_overhead = (prod.apportioned_transport or 0) + (prod.apportioned_labour or 0) + (prod.apportioned_other or 0)
        
        # Fetch lifetime sales to determine original batch size for overhead apportionment
        # Note: In a high-traffic system, we'd cache 'original_batch_size' on the Product model instead of re-querying.
        lifetime_q = select(func.coalesce(func.sum(ShopOrderItem.quantity), 0)).where(ShopOrderItem.product_id == prod.id)
        lifetime_sold = (await session.exec(lifetime_q)).first() or 0
        original_batch_qty = (prod.quantity or 0) + lifetime_sold
        
        apportioned_overhead = 0.0
        if original_batch_qty > 0:
            apportioned_overhead = total_overhead * (item.quantity / original_batch_qty)
            
        item_landed_cost = base_cost + apportioned_overhead
        item_profit = net_item_revenue - item_landed_cost
        
        category_stats[cat]["revenue"] += net_item_revenue
        category_stats[cat]["qty_sold"] += item.quantity
        category_stats[cat]["profit"] += item_profit

    # Format output
    output = []
    for cat, stats in category_stats.items():
        output.append({
            "category": cat,
            "revenue": round(stats["revenue"], 2),
            "qty_sold": int(stats["qty_sold"]),
            "profit": round(stats["profit"], 2)
        })
        
    return sorted(output, key=lambda x: x["revenue"], reverse=True)


@router.get("/shop/top-products")
async def get_top_products(
    period: str = Query("all", description="today|7d|30d|90d|1y|all"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Returns per-product (batch-wise) sales breakdown with profit, batch number, and remaining inventory."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    shop_id = current_user.id
    SOLD_STATUSES = ["dispatched", "completed"]

    # Date range filters
    now = datetime.utcnow()
    today = now.date()
    order_date_filter = True
    period_map = {"today": 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
    if period in period_map:
        days_back = period_map[period]
        start_date = today - timedelta(days=days_back)
        start_dt = datetime.combine(start_date, datetime.min.time())
        order_date_filter = ShopOrder.created_at >= start_dt

    # Fetch all items sold in this period with their orders
    query = select(
        ShopOrderItem, 
        ShopOrder.total_amount, 
        ShopOrder.final_amount,
        ShopOrder.created_at
    ).join(ShopOrder, ShopOrder.id == ShopOrderItem.order_id).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.status.in_(SOLD_STATUSES),
        order_date_filter
    )
    
    results = await session.exec(query)
    items_data = results.all()

    # Aggregate by product (batch)
    product_stats = {}
    
    for item, total_amt, final_amt, created_at in items_data:
        pid = item.product_id
        if pid not in product_stats:
            product_stats[pid] = {
                "name": item.product_name,
                "units_sold": 0,
                "revenue": 0.0,
                "last_sale": created_at
            }
        
        # 1. Net Revenue (pro-rate order discount)
        discount_ratio = (final_amt / total_amt) if total_amt > 0 else 1.0
        net_item_revenue = item.subtotal * discount_ratio
        
        product_stats[pid]["units_sold"] += item.quantity
        product_stats[pid]["revenue"] += net_item_revenue
        if created_at > product_stats[pid]["last_sale"]:
            product_stats[pid]["last_sale"] = created_at

    # Fetch product details for cost and batch info
    product_ids = list(product_stats.keys())
    prod_dict: dict = {}
    if product_ids:
        prod_stmt = select(Product).where(Product.id.in_(product_ids))
        prod_res = await session.exec(prod_stmt)
        prod_dict = {p.id: p for p in prod_res.all()}

    output = []
    for pid, stats in product_stats.items():
        prod = prod_dict.get(pid)
        units_sold = stats["units_sold"]
        revenue = stats["revenue"]
        
        cost_price = (prod.cost_price or 0) if prod else 0
        base_cost = cost_price * units_sold
        
        # Calculate overhead proportional to units sold in this period
        overhead = 0.0
        if prod:
            total_overhead = ((prod.apportioned_transport or 0) + (prod.apportioned_labour or 0) + (prod.apportioned_other or 0))
            
            # Fetch lifetime sales
            lifetime_q = select(func.coalesce(func.sum(ShopOrderItem.quantity), 0)).where(ShopOrderItem.product_id == pid)
            lifetime_sold = (await session.exec(lifetime_q)).first() or 0
            original_batch_qty = (prod.quantity or 0) + lifetime_sold
            
            if original_batch_qty > 0:
                overhead = total_overhead * (units_sold / original_batch_qty)

        profit = revenue - base_cost - overhead
        output.append({
            "product_id": pid,
            "product_name": stats["name"],
            "category": prod.category if prod else "unknown",
            "batch_number": prod.batch_number if prod else None,
            "batch_id": pid,
            "units_sold": int(units_sold),
            "revenue": round(float(revenue), 2),
            "cost_price": cost_price,
            "total_cost": round(base_cost, 2),
            "overhead": round(overhead, 2),
            "profit": round(float(profit), 2),
            "remaining_qty": prod.quantity if prod else 0,
            "selling_price": prod.price if prod else 0,
            "last_sale_date": stats["last_sale"].isoformat() if stats["last_sale"] else None,
        })

    return sorted(output, key=lambda x: x["revenue"], reverse=True)

@router.get("/shop/channel-breakdown")
async def get_channel_breakdown(
    period: str = Query("30d", description="today|7d|30d|90d|1y|all"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Returns summarized channel (payment_mode) sales metrics."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    shop_id = current_user.id
    now = datetime.utcnow()
    today = now.date()
    order_date_filter = True
    period_map = {"today": 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
    if period in period_map:
        days_back = period_map[period]
        start_date = today - timedelta(days=days_back)
        start_dt = datetime.combine(start_date, datetime.min.time())
        order_date_filter = ShopOrder.created_at >= start_dt

    query = select(
        col(ShopOrder.payment_mode),
        func.count(ShopOrder.id).label("orders"),
        func.sum(ShopOrder.final_amount).label("revenue")
    ).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.status.in_(["dispatched", "completed"]),
        order_date_filter
    ).group_by(col(ShopOrder.payment_mode))

    results = await session.exec(query)
    
    output = []
    for pm, ops, rev in results.all():
        output.append({
            "channel": pm or "unknown",
            "orders": ops,
            "revenue": float(rev) if rev else 0.0,
            "average_order_value": float(rev / ops) if ops > 0 else 0.0
        })
    
    return sorted(output, key=lambda x: x["revenue"], reverse=True)

@router.get("/shop/order-health")
async def get_order_health(
    period: str = Query("30d", description="today|7d|30d|90d|1y|all"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Returns count and percentage of orders grouped by status."""
    if current_user.role != "shop":
        raise HTTPException(status_code=403, detail="Not authorized")

    shop_id = current_user.id
    now = datetime.utcnow()
    today = now.date()
    order_date_filter = True
    period_map = {"today": 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
    if period in period_map:
        days_back = period_map[period]
        start_date = today - timedelta(days=days_back)
        start_dt = datetime.combine(start_date, datetime.min.time())
        order_date_filter = ShopOrder.created_at >= start_dt

    query = select(
        col(ShopOrder.status),
        func.count(ShopOrder.id).label("count")
    ).where(
        ShopOrder.shop_id == shop_id,
        order_date_filter
    ).group_by(col(ShopOrder.status))

    results = await session.exec(query)
    
    total_orders = 0
    raw_data = []
    for st, ct in results.all():
        raw_data.append({"status": st or "unknown", "count": ct})
        total_orders += ct

    output = []
    for item in raw_data:
        pct = (item["count"] / total_orders * 100) if total_orders > 0 else 0.0
        output.append({
            "status": item["status"],
            "count": item["count"],
            "percentage": round(pct, 1)
        })
        
    return sorted(output, key=lambda x: x["count"], reverse=True)
