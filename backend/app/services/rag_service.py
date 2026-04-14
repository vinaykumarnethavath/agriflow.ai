"""
Privacy-Aware RAG Service for AgriFlow
========================================
Combines local database knowledge with Groq LLM for external knowledge,
while strictly protecting personal/sensitive information.

Source Types:
  - db_only  (🟢 Green)  → Personal data, answered from DB only
  - external (🟣 Purple) → General knowledge from Groq LLM
  - mixed    (🔵 Blue)   → AI reasoning + anonymised DB context
"""

import os
import re
import json
import traceback
from typing import Optional
from datetime import datetime, date

from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from groq import AsyncGroq

from ..models.user import User
from ..models.crop import Crop, CropExpense, CropHarvest, CropSale
from ..models.trade import Product, ShopOrder, ShopOrderItem
from ..models.expense import ShopExpense
from ..models.shop_accounting import ShopAccountingExpense
from ..models.farmer import FarmerProfile
from ..models.shop import ShopProfile
from ..models.payment import Payment
from ..models.manufacturer import ManufacturerPurchase, ProductionBatch, ManufacturerSale

# ---------------------------------------------------------------------------
# 1. Privacy Classifier
# ---------------------------------------------------------------------------

# Keywords that signal personal/sensitive data requests
PERSONAL_KEYWORDS = [
    "my account", "account number", "bank", "ifsc", "aadhaar", "aadhar",
    "pan number", "pan card", "email", "phone number", "mobile",
    "password", "license number", "payment id", "transaction id",
    "razorpay", "tracking id", "shipping address", "my address",
    "my name", "my profile", "my details", "personal",
    "contact number", "my phone", "my email", "my bank",
]

# Keywords that signal pure external / general knowledge queries
EXTERNAL_KEYWORDS = [
    "what is", "how to", "best practice", "recommend", "suggest",
    "explain", "difference between", "msp", "government scheme",
    "subsidy", "weather forecast", "climate", "soil type",
    "organic farming", "pest control", "disease", "fertilizer for",
    "pesticide for", "crop rotation", "irrigation method",
    "market trend", "price prediction", "technique", "tip",
    "benefit of", "disadvantage", "season for", "when to sow",
    "when to harvest", "nutrient", "compost", "vermiculture",
    "drip irrigation", "greenhouse", "hydroponics",
]

# Keywords that signal database queries about the user's own data
DATABASE_KEYWORDS = [
    "my crop", "my expense", "my harvest", "my sale", "my order",
    "my product", "my inventory", "my revenue", "my profit", "my cost",
    "my loss", "total expense", "total revenue", "total cost",
    "how much", "how many", "my batch", "my stock", "my listing",
    "this season", "my farm", "my business", "sold", "dispatched",
    "spent", "earned", "remaining", "pending", "confirmed",
    "show me", "list my", "give me", "tell me my", "what is my",
    "what are my", "revenue", "profit", "cost", "expense", "order",
    "product", "inventory", "stock", "batch", "crop", "harvest",
    "sale", "income", "loss", "quantity", "price",
]


def classify_question(question: str) -> str:
    """Classify user question into: personal, database, external, or mixed."""
    q = question.lower().strip()

    # Check personal first (highest priority)
    personal_score = sum(1 for kw in PERSONAL_KEYWORDS if kw in q)
    if personal_score >= 1:
        return "personal"

    db_score = sum(1 for kw in DATABASE_KEYWORDS if kw in q)
    ext_score = sum(1 for kw in EXTERNAL_KEYWORDS if kw in q)

    # Database takes priority when both match — user is asking about their data
    if db_score > 0 and ext_score > 0:
        return "database" if db_score >= ext_score else "mixed"
    if db_score > 0:
        return "database"
    if ext_score > 0:
        return "external"

    # If the question mentions the user's data indirectly, treat as database
    if any(word in q for word in ["my", "i have", "i spent", "i sold", "i bought", "show", "list"]):
        return "database"

    # Default to external for general questions
    return "external"


# ---------------------------------------------------------------------------
# 2. Database Query Engine — ALWAYS fetch ALL data for the role
# ---------------------------------------------------------------------------

async def query_personal_data(user: User, session: AsyncSession) -> dict:
    """Retrieve personal/profile data from DB (NEVER sent to API)."""
    data = {
        "full_name": user.full_name,
        "email": user.email,
        "phone_number": user.phone_number,
        "role": user.role if isinstance(user.role, str) else user.role.value,
    }

    if user.role in ("farmer", "FARMER"):
        stmt = select(FarmerProfile).where(FarmerProfile.user_id == user.id)
        result = await session.exec(stmt)
        profile = result.first()
        if profile:
            data.update({
                "farmer_id": profile.farmer_id,
                "father_husband_name": profile.father_husband_name,
                "district": profile.district,
                "state": profile.state,
                "village": profile.village,
                "mandal": profile.mandal,
                "pincode": profile.pincode,
                "total_area": profile.total_area,
                "bank_name": profile.bank_name,
                "account_number": profile.account_number,
                "ifsc_code": profile.ifsc_code,
                "aadhaar_last_4": profile.aadhaar_last_4,
            })

    elif user.role in ("shop", "SHOP"):
        stmt = select(ShopProfile).where(ShopProfile.user_id == user.id)
        result = await session.exec(stmt)
        profile = result.first()
        if profile:
            data.update({
                "shop_name": profile.shop_name,
                "license_number": profile.license_number,
                "owner_name": profile.owner_name,
                "contact_number": profile.contact_number,
                "aadhaar_number": profile.aadhaar_number,
                "pan_number": profile.pan_number,
                "shop_address": profile.shop_address,
                "district": profile.district,
                "state": profile.state,
                "bank_name": profile.bank_name,
                "account_number": profile.account_number,
                "ifsc_code": profile.ifsc_code,
            })

    return data


async def query_database_context(user: User, question: str, session: AsyncSession) -> dict:
    """
    Query the database for ALL relevant data for the user's role.
    We fetch everything so the LLM always has complete context and never
    misses related data (e.g., asking about profit needs both orders AND expenses).
    """
    context = {}
    role = user.role if isinstance(user.role, str) else user.role.value

    # =========================================================================
    # STRICT ROLE ISOLATION + ALWAYS FETCH ALL DATA
    # =========================================================================

    # --- Farmer: fetch ALL farm data ---
    if role in ("farmer", "FARMER"):
        # Crops
        stmt = select(Crop).where(Crop.user_id == user.id)
        result = await session.exec(stmt)
        crops = result.all()
        context["crops"] = [
            {
                "name": c.name, "area": c.area, "season": c.season,
                "variety": c.variety, "status": c.status, "crop_type": c.crop_type,
                "sowing_date": c.sowing_date.strftime("%Y-%m-%d") if c.sowing_date else None,
                "total_cost": c.total_cost, "total_revenue": c.total_revenue,
                "net_profit": c.net_profit, "actual_yield": c.actual_yield,
            }
            for c in crops
        ]

        # Expenses
        stmt = (
            select(CropExpense)
            .join(Crop, Crop.id == CropExpense.crop_id)
            .where(Crop.user_id == user.id)
        )
        result = await session.exec(stmt)
        expenses = result.all()
        expenses_by_cat = {}
        total_expenses = 0.0
        for e in expenses:
            expenses_by_cat[e.category] = expenses_by_cat.get(e.category, 0) + e.total_cost
            total_expenses += e.total_cost
        context["expenses_by_category"] = expenses_by_cat
        context["total_expenses"] = total_expenses

        # Harvests
        stmt = (
            select(CropHarvest)
            .join(Crop, Crop.id == CropHarvest.crop_id)
            .where(Crop.user_id == user.id)
        )
        result = await session.exec(stmt)
        harvests = result.all()
        context["harvests"] = [
            {
                "crop_id": h.crop_id, "stage": h.stage,
                "quantity": h.quantity, "unit": h.unit,
                "quality": h.quality, "status": h.status,
                "date": h.date.strftime("%Y-%m-%d") if h.date else None,
            }
            for h in harvests
        ]

        # Sales
        stmt = (
            select(CropSale)
            .join(Crop, Crop.id == CropSale.crop_id)
            .where(Crop.user_id == user.id)
        )
        result = await session.exec(stmt)
        sales = result.all()
        context["crop_sales"] = [
            {
                "buyer_type": s.buyer_type,
                "quantity_quintals": s.quantity_quintals,
                "price_per_quintal": s.price_per_quintal,
                "total_revenue": s.total_revenue,
                "payment_mode": s.payment_mode,
                "status": s.status,
                "date": s.date.strftime("%Y-%m-%d") if s.date else None,
            }
            for s in sales
        ]

        # Pre-computed summary
        context["financial_summary"] = {
            "total_crops": len(crops),
            "total_area": sum(c.area for c in crops),
            "total_cost": sum(c.total_cost or 0 for c in crops),
            "total_revenue": sum(c.total_revenue or 0 for c in crops),
            "total_profit": sum(c.net_profit or 0 for c in crops),
            "total_expenses": total_expenses,
        }

    # --- Shop: fetch ALL shop data ---
    elif role in ("shop", "SHOP"):
        # Products / Inventory
        stmt = select(Product).where(Product.user_id == user.id)
        result = await session.exec(stmt)
        products = result.all()
        context["products"] = [
            {
                "name": p.name, "category": p.category, "brand": p.brand,
                "price": p.price, "cost_price": p.cost_price,
                "quantity": p.quantity, "unit": p.unit,
                "batch_number": p.batch_number, "status": p.status,
            }
            for p in products
        ]
        context["inventory_summary"] = {
            "total_products": len(products),
            "active_products": len([p for p in products if p.status == "active"]),
            "draft_products": len([p for p in products if p.status == "draft"]),
            "total_stock_value": sum((p.cost_price or 0) * p.quantity for p in products),
        }

        # Orders
        stmt = select(ShopOrder).where(ShopOrder.shop_id == user.id).order_by(ShopOrder.created_at.desc()).limit(100)
        result = await session.exec(stmt)
        orders = result.all()
        statuses = {}
        for o in orders:
            statuses[o.status] = statuses.get(o.status, 0) + 1
        dispatched_completed = [o for o in orders if o.status in ("dispatched", "completed")]
        context["orders_summary"] = {
            "total_orders": len(orders),
            "total_revenue_from_dispatched_completed": sum(o.final_amount for o in dispatched_completed),
            "total_profit_from_dispatched_completed": sum(o.profit for o in dispatched_completed),
            "order_statuses": statuses,
            "pending_orders": statuses.get("pending", 0),
            "confirmed_orders": statuses.get("confirmed", 0),
            "dispatched_orders": statuses.get("dispatched", 0),
            "completed_orders": statuses.get("completed", 0),
            "cancelled_orders": statuses.get("cancelled", 0),
        }

        # Recent order details (last 10)
        context["recent_orders"] = [
            {
                "order_id": o.id, "customer_name": o.farmer_name,
                "status": o.status, "total_amount": o.final_amount,
                "profit": o.profit, "payment_method": o.payment_mode,
                "payment_status": o.payment_status,
                "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else None,
            }
            for o in orders[:10]
        ]

        # Accounting expenses
        stmt = select(ShopAccountingExpense).where(ShopAccountingExpense.shop_id == user.id)
        result = await session.exec(stmt)
        acct_expenses = result.all()
        expenses_by_cat = {}
        total_biz_expenses = 0.0
        for e in acct_expenses:
            expenses_by_cat[e.category] = expenses_by_cat.get(e.category, 0) + e.amount
            total_biz_expenses += e.amount
        context["business_expenses_by_category"] = expenses_by_cat
        context["total_business_expenses"] = total_biz_expenses

    # --- Manufacturer ---
    elif role in ("manufacturer", "MANUFACTURER"):
        stmt = select(ManufacturerPurchase).where(ManufacturerPurchase.user_id == user.id)
        result = await session.exec(stmt)
        purchases = result.all()
        context["purchases"] = [{"id": p.id, "supplier_name": p.supplier_name, "total_cost": p.total_cost} for p in purchases]
        context["total_purchase_cost"] = sum(p.total_cost or 0 for p in purchases)

        stmt = select(ProductionBatch).where(ProductionBatch.user_id == user.id)
        result = await session.exec(stmt)
        batches = result.all()
        context["production_batches"] = [{"id": b.id, "product_name": b.product_name, "status": b.status} for b in batches]

        stmt = select(ManufacturerSale).where(ManufacturerSale.user_id == user.id)
        result = await session.exec(stmt)
        sales = result.all()
        context["manufacturer_sales"] = [{"id": s.id, "total_amount": s.total_amount} for s in sales]
        context["total_sales_amount"] = sum(s.total_amount or 0 for s in sales)

    # --- Customer ---
    elif role in ("customer", "CUSTOMER"):
        pass  # Future: fetch customer's own purchase orders

    return context


# ---------------------------------------------------------------------------
# 3. Groq LLM Client (with PII sanitisation)
# ---------------------------------------------------------------------------

# Fields to dummy-replace before sending to LLM
PII_DUMMY_MAP = {
    "full_name": "Farmer A",
    "email": "user@example.com",
    "phone_number": "9XXXXXXXXX",
    "account_number": "XXXX1234",
    "ifsc_code": "XXXXX0001",
    "bank_name": "Sample Bank",
    "aadhaar_last_4": "XXXX",
    "aadhaar_number": "XXXX-XXXX-XXXX",
    "pan_number": "XXXXXXXXXX",
    "license_number": "LIC-XXXXX",
    "farmer_id": "FRM-XXX",
    "shop_name": "Sample Shop",
    "owner_name": "Owner A",
    "contact_number": "9XXXXXXXXX",
    "father_husband_name": "Parent A",
}


def sanitize_context(context: dict) -> dict:
    """Remove or replace any PII that might have leaked into context dict."""
    sanitized = json.loads(json.dumps(context, default=str))  # deep copy + serialize dates

    def _scrub(obj):
        if isinstance(obj, dict):
            for key in list(obj.keys()):
                if key in PII_DUMMY_MAP:
                    obj[key] = PII_DUMMY_MAP[key]
                elif key in ("buyer_name", "sold_to", "farmer_name"):
                    obj[key] = "Buyer X"
                else:
                    _scrub(obj[key])
        elif isinstance(obj, list):
            for item in obj:
                _scrub(item)

    _scrub(sanitized)
    return sanitized


async def call_groq(question: str, context: Optional[dict] = None, role: str = "farmer", strict_data_only: bool = False) -> str:
    """Call Groq LLM with sanitised context. Returns the LLM text answer."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your-groq-api-key-here":
        return "⚠️ Groq API key not configured. Please add your GROQ_API_KEY to the .env file."

    client = AsyncGroq(api_key=api_key)

    system_prompt = (
        "You are AgriFlow AI, a helpful agricultural assistant for Indian farmers, shops, and manufacturers. "
        "You provide advice on farming, crop management, fertilizers, market prices, government schemes, "
        "and business operations. Keep answers concise, practical, and in simple language. "
        "Always answer in English. Use ₹ for currency. "
        f"IMPORTANT: The current user's role is '{role}'. Only reference data relevant to this role. "
        "Never mention or reference data from other roles. Each user's data is strictly isolated."
    )
    if strict_data_only:
        system_prompt += (
            "\n\nCRITICAL RULES FOR DATA QUESTIONS:"
            "\n1. ONLY use the EXACT numbers from the provided JSON data. NEVER estimate, guess, or round numbers."
            "\n2. If a number is in the data, quote it EXACTLY (e.g., if total_revenue is 9150.0, say '₹9,150')."
            "\n3. If the data shows 0 or empty lists, say so clearly — do NOT make up data."
            "\n4. If the question cannot be answered from the provided data, say 'I don't have that information in your records.'"
            "\n5. Do NOT add advice or recommendations unless asked — just answer the specific question with the data."
            "\n6. Format numbers clearly with commas for readability."
            "\n7. When listing items, include all relevant details from the data."
        )

    messages = [{"role": "system", "content": system_prompt}]

    if context:
        safe_context = sanitize_context(context)
        context_text = (
            "Here is the user's COMPLETE data from the database. "
            "Use ONLY these exact numbers to answer the question:\n"
            f"```json\n{json.dumps(safe_context, indent=2)}\n```"
        )
        messages.append({"role": "user", "content": context_text})
        messages.append({"role": "assistant", "content": "I have your complete data loaded. I will answer using only the exact numbers from your records."})

    messages.append({"role": "user", "content": question})

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.2,  # Low temperature for factual accuracy
            max_tokens=1024,
        )
        return response.choices[0].message.content or "I couldn't generate a response."
    except Exception as e:
        print(f"[RAG] Groq API error: {e}")
        traceback.print_exc()
        return f"⚠️ AI service temporarily unavailable. Error: {str(e)}"


# ---------------------------------------------------------------------------
# 4. RAG Orchestrator
# ---------------------------------------------------------------------------

async def handle_chat(user: User, question: str, session: AsyncSession) -> dict:
    """
    Main entry point. Classifies the question, queries DB if needed,
    calls Groq if needed, and returns a structured response.

    Returns:
        {
            "answer": str,
            "source": "db_only" | "external" | "mixed",
            "data_points": dict | None   # optional raw data from DB
        }
    """
    classification = classify_question(question)
    role = user.role if isinstance(user.role, str) else user.role.value

    # ----- PERSONAL: answer from DB only, never call API -----
    if classification == "personal":
        personal_data = await query_personal_data(user, session)
        q = question.lower()

        # Build a human-friendly answer from personal data
        answer_parts = []

        if any(kw in q for kw in ["account number", "bank", "ifsc"]):
            bank = personal_data.get("bank_name", "N/A")
            acc = personal_data.get("account_number", "N/A")
            ifsc = personal_data.get("ifsc_code", "N/A")
            answer_parts.append(f"🏦 **Bank Details**\n- Bank: {bank}\n- Account: {acc}\n- IFSC: {ifsc}")

        if any(kw in q for kw in ["aadhaar", "aadhar"]):
            aadhaar = personal_data.get("aadhaar_last_4") or personal_data.get("aadhaar_number", "N/A")
            answer_parts.append(f"🪪 **Aadhaar**: ...{aadhaar}")

        if any(kw in q for kw in ["pan"]):
            pan = personal_data.get("pan_number", "N/A")
            answer_parts.append(f"🪪 **PAN**: {pan}")

        if any(kw in q for kw in ["email"]):
            answer_parts.append(f"📧 **Email**: {personal_data.get('email', 'N/A')}")

        if any(kw in q for kw in ["phone", "mobile", "contact"]):
            phone = personal_data.get("phone_number") or personal_data.get("contact_number", "N/A")
            answer_parts.append(f"📱 **Phone**: {phone}")

        if any(kw in q for kw in ["my name", "my profile", "my details", "personal"]):
            answer_parts.append(f"👤 **Name**: {personal_data.get('full_name', 'N/A')}")
            answer_parts.append(f"🎭 **Role**: {personal_data.get('role', 'N/A').capitalize()}")
            if personal_data.get("district"):
                answer_parts.append(f"📍 **Location**: {personal_data.get('village', '')}, {personal_data.get('mandal', '')}, {personal_data.get('district', '')}, {personal_data.get('state', '')}")
            if personal_data.get("shop_name"):
                answer_parts.append(f"🏪 **Shop**: {personal_data.get('shop_name')}")
            if personal_data.get("total_area"):
                answer_parts.append(f"🌾 **Total Land**: {personal_data.get('total_area')} acres")

        if any(kw in q for kw in ["address"]):
            parts = [personal_data.get("village"), personal_data.get("mandal"), personal_data.get("district"), personal_data.get("state"), personal_data.get("pincode")]
            addr = ", ".join([p for p in parts if p])
            shop_addr = personal_data.get("shop_address")
            if shop_addr:
                answer_parts.append(f"📍 **Shop Address**: {shop_addr}")
            if addr:
                answer_parts.append(f"🏠 **Address**: {addr}")

        if any(kw in q for kw in ["license"]):
            answer_parts.append(f"📋 **License No**: {personal_data.get('license_number', 'N/A')}")

        if any(kw in q for kw in ["payment id", "transaction id", "razorpay", "tracking"]):
            answer_parts.append("🔒 This is sensitive payment/transaction data. Please check your Payments section in the dashboard for detailed transaction records.")

        if not answer_parts:
            answer_parts.append("🔒 This is **personal data**. Here's what I found in your profile:")
            for k, v in personal_data.items():
                if k not in ("hashed_password",) and v:
                    answer_parts.append(f"- **{k.replace('_', ' ').title()}**: {v}")

        return {
            "answer": "\n".join(answer_parts),
            "source": "db_only",
            "data_points": None,  # Don't expose raw personal data in API response
        }

    # ----- DATABASE: answer from DB data with LLM formatting -----
    if classification == "database":
        db_context = await query_database_context(user, question, session)

        if not db_context:
            return {
                "answer": "I couldn't find relevant data in your records. Try asking about your crops, expenses, orders, or inventory.",
                "source": "db_only",
                "data_points": None,
            }

        answer = await call_groq(question, context=db_context, role=role, strict_data_only=True)

        return {
            "answer": answer,
            "source": "db_only",
            "data_points": db_context,
        }

    # ----- EXTERNAL: pure general knowledge from Groq -----
    if classification == "external":
        answer = await call_groq(question, role=role)
        return {
            "answer": answer,
            "source": "external",
            "data_points": None,
        }

    # ----- MIXED: combine DB context with AI reasoning -----
    db_context = await query_database_context(user, question, session)
    answer = await call_groq(question, context=db_context if db_context else None, role=role)

    return {
        "answer": answer,
        "source": "mixed",
        "data_points": db_context,
    }
