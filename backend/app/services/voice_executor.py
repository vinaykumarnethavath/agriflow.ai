"""
Voice Action Executor — Server-Side Execution for Voice Commands
=================================================================
Executes voice assistant actions directly on the database, enabling
the voice assistant to add crops, expenses, harvests, sales, products,
and update records without needing frontend API round-trips.

Includes:
  - Personal data protection (bank, aadhaar, PAN, etc.)
  - Auto-resolution of crop_id from crop name
  - Smart defaults (season from month, today's date, etc.)
  - Detailed result messages for TTS feedback
"""

import traceback
from typing import Optional
from datetime import datetime, date

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.user import User
from ..models.crop import (
    Crop, CropCreate, CropExpense, CropExpenseCreate,
    CropHarvest, CropHarvestCreate, CropSale, CropSaleCreate,
)
from ..models.trade import Product
from ..models.farmer import FarmerProfile
from ..services.crop_service import recalculate_crop_financials


# ===========================================================================
# Protected Fields — NEVER modifiable via voice
# ===========================================================================

PROTECTED_FIELDS = {
    "account_number", "bank_name", "ifsc_code",
    "aadhaar_last_4", "aadhaar_number", "pan_number",
    "email", "phone_number", "password", "hashed_password",
    "license_number", "contact_number",
}


# ===========================================================================
# Helpers — Resolve IDs from names
# ===========================================================================

async def resolve_crop_id(
    user: User, crop_name: str, session: AsyncSession
) -> Optional[int]:
    """Look up a crop ID from its name for the current user."""
    stmt = select(Crop).where(
        Crop.user_id == user.id,
        Crop.name.ilike(f"%{crop_name}%"),
    )
    result = await session.exec(stmt)
    crop = result.first()
    return crop.id if crop else None


async def resolve_crop_by_id(
    user: User, crop_id: int, session: AsyncSession
) -> Optional[Crop]:
    """Fetch a crop by ID, ensuring it belongs to the user."""
    crop = await session.get(Crop, crop_id)
    if crop and crop.user_id == user.id:
        return crop
    return None


async def resolve_product_id(
    user: User, product_name: str, session: AsyncSession
) -> Optional[int]:
    """Look up a product ID from its name for the current user."""
    stmt = select(Product).where(
        Product.user_id == user.id,
        Product.name.ilike(f"%{product_name}%"),
    )
    result = await session.exec(stmt)
    product = result.first()
    return product.id if product else None


def _infer_season() -> str:
    """Infer the crop season based on the current month."""
    month = datetime.now().month
    if month in (6, 7, 8, 9, 10):
        return "Kharif"
    elif month in (11, 12, 1, 2, 3):
        return "Rabi"
    else:
        return "Zaid"


def _check_protected_fields(data: dict) -> Optional[str]:
    """Check if any protected fields are in the data dict."""
    violations = [f for f in data.keys() if f in PROTECTED_FIELDS]
    if violations:
        return (
            f"🔒 Cannot modify {', '.join(violations)} via voice command. "
            f"Please update these sensitive details from the profile page directly."
        )
    return None


# ===========================================================================
# Action Executors
# ===========================================================================

async def execute_add_crop(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Add a new crop for the farmer."""
    try:
        name = data.get("name", "").strip()
        if not name:
            return {"success": False, "message": "Crop name is required."}

        area = data.get("area")
        if area is None:
            return {"success": False, "message": f"How many acres of {name} do you want to add?"}

        # Auto-fill defaults
        season = data.get("season") or _infer_season()
        sowing_date = data.get("sowing_date") or datetime.now().isoformat()
        status = data.get("status", "Growing")
        variety = data.get("variety")
        crop_type = data.get("crop_type", "Other")

        db_crop = Crop(
            name=name.title(),
            area=float(area),
            season=season,
            sowing_date=datetime.fromisoformat(str(sowing_date).replace("Z", "+00:00")) if isinstance(sowing_date, str) else sowing_date,
            status=status,
            variety=variety,
            crop_type=crop_type,
            user_id=user.id,
        )
        session.add(db_crop)
        await session.commit()
        await session.refresh(db_crop)

        return {
            "success": True,
            "message": f"✅ Added {area} acres of {name.title()} crop ({season} season).",
            "data": {"crop_id": db_crop.id, "name": db_crop.name, "area": db_crop.area},
        }
    except Exception as e:
        print(f"[VoiceExecutor] add_crop error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to add crop: {str(e)}"}


async def execute_add_expense(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Add an expense to a specific crop."""
    try:
        # Resolve crop
        crop_id = data.get("crop_id")
        crop_name = data.get("crop_name", "")
        if not crop_id and crop_name:
            crop_id = await resolve_crop_id(user, crop_name, session)
        if not crop_id:
            return {
                "success": False,
                "message": f"Could not find crop '{crop_name}'. Which crop is this expense for?",
            }

        # Verify crop belongs to user
        crop = await resolve_crop_by_id(user, crop_id, session)
        if not crop:
            return {"success": False, "message": "Crop not found or not yours."}

        total_cost = data.get("total_cost")
        if total_cost is None:
            return {"success": False, "message": "How much was the expense amount?"}

        # Auto-fill defaults
        category = data.get("category", "Input")
        expense_type = data.get("type", "General")
        quantity = data.get("quantity", 1)
        unit = data.get("unit", "lot")
        unit_cost = data.get("unit_cost", float(total_cost))
        expense_date = data.get("date") or datetime.now().isoformat()
        payment_mode = data.get("payment_mode", "cash")
        stage = data.get("stage", "General")

        db_expense = CropExpense(
            crop_id=crop_id,
            category=category,
            type=expense_type,
            quantity=float(quantity),
            unit=unit,
            unit_cost=float(unit_cost),
            total_cost=float(total_cost),
            date=datetime.fromisoformat(str(expense_date).replace("Z", "+00:00")) if isinstance(expense_date, str) else expense_date,
            payment_mode=payment_mode,
            stage=stage,
        )
        session.add(db_expense)
        await session.commit()
        await session.refresh(db_expense)

        # Recalculate crop financials
        await recalculate_crop_financials(crop_id, session)

        return {
            "success": True,
            "message": f"✅ Added ₹{float(total_cost):,.0f} {expense_type} expense for {crop.name}.",
            "data": {"expense_id": db_expense.id, "crop_name": crop.name, "amount": total_cost},
        }
    except Exception as e:
        print(f"[VoiceExecutor] add_expense error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to add expense: {str(e)}"}


async def execute_add_harvest(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Add a harvest entry for a crop."""
    try:
        crop_id = data.get("crop_id")
        crop_name = data.get("crop_name", "")
        if not crop_id and crop_name:
            crop_id = await resolve_crop_id(user, crop_name, session)
        if not crop_id:
            return {
                "success": False,
                "message": f"Could not find crop '{crop_name}'. Which crop is this harvest for?",
            }

        crop = await resolve_crop_by_id(user, crop_id, session)
        if not crop:
            return {"success": False, "message": "Crop not found or not yours."}

        quantity = data.get("quantity")
        if quantity is None:
            return {"success": False, "message": "How much did you harvest (in quintals)?"}

        selling_price = data.get("selling_price_per_unit", 0)
        total_revenue = data.get("total_revenue") or (float(quantity) * float(selling_price))

        db_harvest = CropHarvest(
            crop_id=crop_id,
            date=datetime.fromisoformat(str(data.get("date", datetime.now().isoformat())).replace("Z", "+00:00")),
            stage=data.get("stage", "Final Harvest"),
            quantity=float(quantity),
            unit=data.get("unit", "Quintals"),
            quality=data.get("quality", "Grade A"),
            selling_price_per_unit=float(selling_price),
            total_revenue=float(total_revenue),
            buyer_type=data.get("buyer_type", "Market"),
            sold_to=data.get("sold_to"),
            status=data.get("status", "Available"),
        )
        session.add(db_harvest)
        await session.commit()
        await session.refresh(db_harvest)

        await recalculate_crop_financials(crop_id, session)

        msg = f"✅ Recorded harvest of {quantity} quintals for {crop.name}."
        if selling_price:
            msg += f" Revenue: ₹{float(total_revenue):,.0f}."

        return {
            "success": True,
            "message": msg,
            "data": {"harvest_id": db_harvest.id, "crop_name": crop.name, "quantity": quantity},
        }
    except Exception as e:
        print(f"[VoiceExecutor] add_harvest error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to add harvest: {str(e)}"}


async def execute_add_sale(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Add a sale entry for a crop."""
    try:
        crop_id = data.get("crop_id")
        crop_name = data.get("crop_name", "")
        if not crop_id and crop_name:
            crop_id = await resolve_crop_id(user, crop_name, session)
        if not crop_id:
            return {
                "success": False,
                "message": f"Could not find crop '{crop_name}'. Which crop is this sale for?",
            }

        crop = await resolve_crop_by_id(user, crop_id, session)
        if not crop:
            return {"success": False, "message": "Crop not found or not yours."}

        quantity_quintals = data.get("quantity_quintals")
        if quantity_quintals is None:
            return {"success": False, "message": "How many quintals did you sell?"}

        price_per_quintal = data.get("price_per_quintal")
        if price_per_quintal is None:
            return {"success": False, "message": "What was the price per quintal?"}

        total_revenue = data.get("total_revenue") or (float(quantity_quintals) * float(price_per_quintal))
        bag_size = data.get("bag_size", 50)
        total_bags = data.get("total_bags") or max(1, int(float(quantity_quintals) * 100 / bag_size))

        db_sale = CropSale(
            crop_id=crop_id,
            date=datetime.fromisoformat(str(data.get("date", datetime.now().isoformat())).replace("Z", "+00:00")),
            buyer_type=data.get("buyer_type", "Market"),
            buyer_name=data.get("buyer_name", "Market Buyer"),
            quantity_quintals=float(quantity_quintals),
            total_bags=int(total_bags),
            bag_size=int(bag_size),
            price_per_quintal=float(price_per_quintal),
            total_revenue=float(total_revenue),
            payment_mode=data.get("payment_mode", "cash"),
            status=data.get("status", "sold"),
        )
        session.add(db_sale)
        await session.commit()
        await session.refresh(db_sale)

        await recalculate_crop_financials(crop_id, session)

        return {
            "success": True,
            "message": (
                f"✅ Recorded sale of {quantity_quintals} quintals of {crop.name} "
                f"at ₹{float(price_per_quintal):,.0f}/qtl. Total: ₹{float(total_revenue):,.0f}."
            ),
            "data": {
                "sale_id": db_sale.id, "crop_name": crop.name,
                "quantity": quantity_quintals, "revenue": total_revenue,
            },
        }
    except Exception as e:
        print(f"[VoiceExecutor] add_sale error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to add sale: {str(e)}"}


async def execute_update_crop(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Update fields of an existing crop."""
    try:
        crop_id = data.get("crop_id")
        crop_name = data.get("crop_name", "")
        if not crop_id and crop_name:
            crop_id = await resolve_crop_id(user, crop_name, session)
        if not crop_id:
            return {
                "success": False,
                "message": f"Could not find crop '{crop_name}'. Which crop do you want to update?",
            }

        crop = await resolve_crop_by_id(user, crop_id, session)
        if not crop:
            return {"success": False, "message": "Crop not found or not yours."}

        # Fields that can be updated
        updatable = {"name", "area", "season", "variety", "status", "notes", "crop_type",
                     "sowing_date", "expected_harvest_date"}
        updates = {k: v for k, v in data.items() if k in updatable and v is not None}

        if not updates:
            return {"success": False, "message": "What do you want to update for this crop?"}

        for key, value in updates.items():
            if key in ("sowing_date", "expected_harvest_date") and isinstance(value, str):
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            setattr(crop, key, value)

        session.add(crop)
        await session.commit()
        await session.refresh(crop)

        changed = ", ".join(f"{k}={v}" for k, v in updates.items())
        return {
            "success": True,
            "message": f"✅ Updated {crop.name}: {changed}.",
            "data": {"crop_id": crop.id, "updated_fields": list(updates.keys())},
        }
    except Exception as e:
        print(f"[VoiceExecutor] update_crop error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to update crop: {str(e)}"}


async def execute_delete_expense(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Delete a specific expense."""
    try:
        expense_id = data.get("expense_id")
        if not expense_id:
            return {"success": False, "message": "Which expense do you want to delete? Please provide the expense ID."}

        expense = await session.get(CropExpense, int(expense_id))
        if not expense:
            return {"success": False, "message": f"Expense #{expense_id} not found."}

        # Verify the expense belongs to user's crop
        crop = await session.get(Crop, expense.crop_id)
        if not crop or crop.user_id != user.id:
            return {"success": False, "message": "This expense does not belong to you."}

        expense_info = f"₹{expense.total_cost:,.0f} {expense.type} for {crop.name}"
        crop_id = expense.crop_id

        await session.delete(expense)
        await session.commit()
        await recalculate_crop_financials(crop_id, session)

        return {
            "success": True,
            "message": f"✅ Deleted expense: {expense_info}.",
            "data": {"deleted_expense_id": expense_id},
        }
    except Exception as e:
        print(f"[VoiceExecutor] delete_expense error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to delete expense: {str(e)}"}


async def execute_add_product(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Add a new product to shop inventory."""
    try:
        name = data.get("name", "").strip()
        if not name:
            return {"success": False, "message": "Product name is required."}

        price = data.get("price")
        if price is None:
            return {"success": False, "message": f"What is the selling price for {name}?"}

        quantity = data.get("quantity")
        if quantity is None:
            return {"success": False, "message": f"How many units of {name} do you have in stock?"}

        db_product = Product(
            name=name.title(),
            category=data.get("category", "general"),
            price=float(price),
            cost_price=data.get("cost_price", float(price) * 0.8),
            quantity=int(quantity),
            unit=data.get("unit", "unit"),
            batch_number=data.get("batch_number", f"VOICE-{datetime.now().strftime('%Y%m%d%H%M')}"),
            status=data.get("status", "active"),
            brand=data.get("brand"),
            description=data.get("description"),
            user_id=user.id,
        )
        session.add(db_product)
        await session.commit()
        await session.refresh(db_product)

        return {
            "success": True,
            "message": f"✅ Added {quantity} units of {name.title()} at ₹{float(price):,.0f} each.",
            "data": {"product_id": db_product.id, "name": db_product.name},
        }
    except Exception as e:
        print(f"[VoiceExecutor] add_product error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to add product: {str(e)}"}


async def execute_update_product(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Update an existing product in shop inventory."""
    try:
        product_id = data.get("product_id")
        product_name = data.get("product_name", "")
        if not product_id and product_name:
            product_id = await resolve_product_id(user, product_name, session)
        if not product_id:
            return {
                "success": False,
                "message": f"Could not find product '{product_name}'. Which product to update?",
            }

        product = await session.get(Product, int(product_id))
        if not product or product.user_id != user.id:
            return {"success": False, "message": "Product not found or not yours."}

        updatable = {"name", "price", "cost_price", "quantity", "unit", "category",
                     "brand", "status", "description", "low_stock_threshold"}
        updates = {k: v for k, v in data.items() if k in updatable and v is not None}

        if not updates:
            return {"success": False, "message": "What do you want to update for this product?"}

        for key, value in updates.items():
            setattr(product, key, value)

        session.add(product)
        await session.commit()
        await session.refresh(product)

        changed = ", ".join(f"{k}={v}" for k, v in updates.items())
        return {
            "success": True,
            "message": f"✅ Updated {product.name}: {changed}.",
            "data": {"product_id": product.id, "updated_fields": list(updates.keys())},
        }
    except Exception as e:
        print(f"[VoiceExecutor] update_product error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to update product: {str(e)}"}


async def execute_update_profile(
    user: User, data: dict, session: AsyncSession
) -> dict:
    """Update farmer profile fields (non-sensitive only)."""
    try:
        # Check for protected fields
        violation = _check_protected_fields(data)
        if violation:
            return {"success": False, "message": violation}

        role = user.role if isinstance(user.role, str) else user.role.value

        if role in ("farmer", "FARMER"):
            stmt = select(FarmerProfile).where(FarmerProfile.user_id == user.id)
            result = await session.exec(stmt)
            profile = result.first()
            if not profile:
                return {"success": False, "message": "Farmer profile not found. Please create your profile first."}

            updatable = {"village", "mandal", "district", "state", "pincode",
                         "house_no", "street", "father_husband_name", "total_area",
                         "gender", "country"}
            updates = {k: v for k, v in data.items() if k in updatable and v is not None}

            if not updates:
                return {"success": False, "message": "What profile details do you want to update?"}

            for key, value in updates.items():
                setattr(profile, key, value)

            session.add(profile)
            await session.commit()

            changed = ", ".join(f"{k}: {v}" for k, v in updates.items())
            return {
                "success": True,
                "message": f"✅ Updated profile: {changed}.",
                "data": {"updated_fields": list(updates.keys())},
            }
        else:
            return {"success": False, "message": "Profile update via voice is currently supported for farmers only."}

    except Exception as e:
        print(f"[VoiceExecutor] update_profile error: {e}")
        traceback.print_exc()
        return {"success": False, "message": f"Failed to update profile: {str(e)}"}


# ===========================================================================
# Main Dispatcher
# ===========================================================================

# Map of endpoint names to executor functions
EXECUTOR_MAP = {
    "add_crop": execute_add_crop,
    "add_expense": execute_add_expense,
    "add_harvest": execute_add_harvest,
    "add_sale": execute_add_sale,
    "update_crop": execute_update_crop,
    "delete_expense": execute_delete_expense,
    "add_product": execute_add_product,
    "update_product": execute_update_product,
    "update_profile": execute_update_profile,
}


async def execute_voice_action(
    user: User, action: str, params: dict, session: AsyncSession
) -> dict:
    """
    Main entry point — dispatches voice actions to the appropriate executor.
    
    Returns: {"success": bool, "message": str, "data": dict|None}
    """
    if action != "api_call":
        return {"success": False, "message": "Not an API action."}

    endpoint = params.get("endpoint", "")
    data = params.get("data", {})

    # Check for protected field modifications
    if endpoint == "update_profile":
        violation = _check_protected_fields(data)
        if violation:
            return {"success": False, "message": violation}

    executor = EXECUTOR_MAP.get(endpoint)
    if not executor:
        return {
            "success": False,
            "message": f"Unknown action '{endpoint}'. Available: {', '.join(EXECUTOR_MAP.keys())}",
        }

    print(f"[VoiceExecutor] Executing: {endpoint} with data: {data}")
    result = await executor(user, data, session)
    print(f"[VoiceExecutor] Result: {result.get('success')}: {result.get('message')}")
    return result
