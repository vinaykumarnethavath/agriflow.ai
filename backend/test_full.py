"""Full integration test: verifies analytics + orders endpoints work without errors."""
import asyncio
import sys
import os

sys.path.append(os.getcwd())
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models import User, ShopOrder

engine = create_async_engine('postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain')

async def main():
    async with AsyncSession(engine) as session:
        # Find a shop user
        q = select(ShopOrder.shop_id).limit(1)
        shop_id = (await session.exec(q)).first()
        if not shop_id:
            print("No shop orders found, using fallback shop_id=15 for testing.")
            shop_id = 15
        
        print(f"Testing with shop_id: {shop_id}")
        user = User(id=shop_id, role='shop')
        
        # Test 1: Shop overview
        from app.routers.analytics import get_shop_overview
        try:
            overview = await get_shop_overview(current_user=user, session=session)
            print(f"✓ Shop Overview: month_revenue={overview['month_revenue']}, pending={overview['pending_orders']}")
        except Exception as e:
            print(f"✗ Shop Overview FAILED: {e}")
        
        # Test 2: Shop revenue
        from app.routers.analytics import get_shop_revenue
        try:
            rev = await get_shop_revenue(period="all", current_user=user, session=session)
            print(f"✓ Shop Revenue: revenue={rev['total_revenue']}, orders={rev['total_orders']}, completed={rev['completed_orders']}, pending={rev['pending_orders']}")
        except Exception as e:
            print(f"✗ Shop Revenue FAILED: {e}")
            import traceback; traceback.print_exc()
        
        # Test 3: Sales trend
        from app.routers.analytics import get_sales_trend
        try:
            trend = await get_sales_trend(period="7d", current_user=user, session=session)
            total_trend_orders = sum(d['order_count'] for d in trend)
            print(f"✓ Sales Trend (7d): {len(trend)} days, {total_trend_orders} total orders in trend")
        except Exception as e:
            print(f"✗ Sales Trend FAILED: {e}")
        
        # Test 4: Category revenue
        from app.routers.analytics import get_category_revenue
        try:
            cats = await get_category_revenue(period="all", current_user=user, session=session)
            print(f"✓ Category Revenue: {len(cats)} categories")
            for c in cats:
                print(f"  - {c['category']}: revenue={c['revenue']}, qty={c['qty_sold']}, profit={c['profit']}")
        except Exception as e:
            print(f"✗ Category Revenue FAILED: {e}")
        
        # Test 5: Top products
        from app.routers.analytics import get_top_products
        try:
            top = await get_top_products(period="all", current_user=user, session=session)
            print(f"✓ Top Products: {len(top)} products")
        except Exception as e:
            print(f"✗ Top Products FAILED: {e}")
        
        # Test 6: Channel breakdown
        from app.routers.analytics import get_channel_breakdown
        try:
            channels = await get_channel_breakdown(period="all", current_user=user, session=session)
            print(f"✓ Channel Breakdown: {len(channels)} channels")
            for ch in channels:
                print(f"  - {ch['channel']}: {ch['orders']} orders, ₹{ch['revenue']}")
        except Exception as e:
            print(f"✗ Channel Breakdown FAILED: {e}")
        
        # Test 7: Order health
        from app.routers.analytics import get_order_health
        try:
            health = await get_order_health(period="all", current_user=user, session=session)
            print(f"✓ Order Health: {len(health)} statuses")
            for h in health:
                print(f"  - {h['status']}: {h['count']} ({h['percentage']}%)")
        except Exception as e:
            print(f"✗ Order Health FAILED: {e}")
        
        # Test 8: Customers 
        from app.routers.analytics import get_shop_customers
        try:
            customers = await get_shop_customers(current_user=user, session=session)
            print(f"✓ Customers: {len(customers)} customers found")
        except Exception as e:
            print(f"✗ Customers FAILED: {e}")
        
        # Test 9: Detailed orders
        from app.routers.orders import read_shop_orders_detailed
        try:
            detailed = await read_shop_orders_detailed(current_user=user, session=session)
            print(f"✓ Detailed Orders: {len(detailed)} orders")
            if detailed:
                o = detailed[0]
                print(f"  - Order #{o['id']}: revenue=₹{o['final_amount']}, cost=₹{o['total_cost']}, expenses=₹{o['total_expenses']}, profit=₹{o['profit']}")
        except Exception as e:
            print(f"✗ Detailed Orders FAILED: {e}")
            import traceback; traceback.print_exc()
        
        print("\n=== ALL TESTS COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(main())
