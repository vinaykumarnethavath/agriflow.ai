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

# Keywords that strongly signal MIXED mode — the user wants AI advice
# combined with their personal farm/business data
MIXED_SIGNAL_KEYWORDS = [
    "what should i", "which crop", "can i plant", "can i plan",
    "can i grow", "can i sow", "remaining land", "available land",
    "unused land", "empty land", "free land", "left land",
    "what could be", "potential profit", "expected profit",
    "best crop for my", "suitable crop", "what to grow",
    "what to plant", "what to sow", "advise me", "advice for my",
    "improve my", "optimize my", "increase my", "reduce my",
    "how can i improve", "how to increase", "how to reduce",
    "based on my", "for my farm", "for my land", "on my land",
    "predict", "forecast for my", "plan for", "planning",
    "next season", "upcoming season", "what if",
]

# Common crop names for data-awareness checks
KNOWN_CROP_NAMES = [
    "rice", "paddy", "wheat", "cotton", "maize", "corn", "sugarcane",
    "groundnut", "peanut", "soybean", "soya", "mustard", "sunflower",
    "jowar", "sorghum", "bajra", "millet", "ragi", "finger millet",
    "chickpea", "chana", "toor", "pigeon pea", "moong", "urad",
    "lentil", "masoor", "barley", "oats", "tobacco", "jute",
    "turmeric", "chili", "chilli", "onion", "tomato", "potato",
    "brinjal", "eggplant", "okra", "bhindi", "capsicum", "pepper",
    "banana", "mango", "papaya", "guava", "coconut", "areca",
    "tea", "coffee", "rubber", "cashew", "cardamom",
]


def extract_crop_names_from_question(question: str) -> list[str]:
    """Extract any specific crop names mentioned in the user's question."""
    q = question.lower()
    found = []
    for crop in KNOWN_CROP_NAMES:
        # Word-boundary check to avoid partial matches (e.g., 'rice' in 'price')
        pattern = r'\b' + re.escape(crop) + r'\b'
        if re.search(pattern, q):
            found.append(crop)
    return found


def user_has_relevant_crop(crop_names: list[str], db_context: dict) -> bool:
    """Check whether the user's DB data contains any of the mentioned crops."""
    if not crop_names or not db_context:
        return False
    user_crops = db_context.get("crops", [])
    user_crop_names = {c.get("name", "").lower() for c in user_crops}
    for mentioned in crop_names:
        for user_crop in user_crop_names:
            if mentioned in user_crop or user_crop in mentioned:
                return True
    return False


def classify_question(question: str) -> str:
    """Classify user question into: personal, database, external, or mixed.

    Classification priority:
      1. personal  — sensitive profile/account data
      2. mixed     — user's data + AI advice/recommendations needed together
      3. database  — pure data lookups about user's own records
      4. external  — general agricultural knowledge
    """
    q = question.lower().strip()

    # --- 1. Check personal first (highest priority) ---
    personal_score = sum(1 for kw in PERSONAL_KEYWORDS if kw in q)
    if personal_score >= 1:
        return "personal"

    # --- 2. Score each category ---
    db_score = sum(1 for kw in DATABASE_KEYWORDS if kw in q)
    ext_score = sum(1 for kw in EXTERNAL_KEYWORDS if kw in q)
    mixed_score = sum(1 for kw in MIXED_SIGNAL_KEYWORDS if kw in q)

    # Indirect DB references ("my", "i have", etc.)
    indirect_db = any(word in q for word in
                      ["my", "i have", "i spent", "i sold", "i bought"])

    # --- 3. Mixed takes priority when mixed-signal keywords are present ---
    # If the question has mixed-signal keywords, it means the user wants
    # AI reasoning combined with their personal data.
    if mixed_score >= 1:
        # Even if it also has DB keywords, mixed-signal keywords indicate
        # the user wants AI advice on top of their data.
        return "mixed"

    # When both DB and external keywords match, treat as mixed —
    # the user is asking about their data AND wants general advice
    if db_score > 0 and ext_score > 0:
        return "mixed"

    # --- 4. Pure database ---
    if db_score > 0:
        return "database"
    if indirect_db:
        return "database"

    # --- 5. Pure external ---
    if ext_score > 0:
        return "external"

    # --- 6. Default to external for general questions ---
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


async def call_groq(
    question: str,
    context: Optional[dict] = None,
    role: str = "farmer",
    strict_data_only: bool = False,
    mixed_mode: bool = False,
    target_lang: str = "en",
) -> str:
    """Call Groq LLM with sanitised context. Returns the LLM text answer.

    Args:
        strict_data_only: When True, the LLM must ONLY use DB data (no advice).
        mixed_mode:       When True, the LLM should blend DB data WITH AI advice.
        target_lang:      Target language code (e.g. 'te', 'hi', 'ta', etc.)
    """
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your-groq-api-key-here":
        return "⚠️ Groq API key not configured. Please add your GROQ_API_KEY to the .env file."

    client = AsyncGroq(api_key=api_key)

    from ..routers.translate import SUPPORTED_LANGUAGES
    target_lang_name = SUPPORTED_LANGUAGES.get(target_lang, "English")

    system_prompt = (
        "You are AgriFlow AI, a helpful agricultural assistant for Indian farmers, shops, and manufacturers. "
        "You provide advice on farming, crop management, fertilizers, market prices, government schemes, "
        "and business operations. Keep answers concise, practical, and in simple language. "
        f"Respond in {target_lang_name} if possible, otherwise in English. Use ₹ for currency. "
        f"IMPORTANT: The current user's role is '{role}'. Only reference data relevant to this role. "
        "Never mention or reference data from other roles. Each user's data is strictly isolated."
    )

    if mixed_mode:
        system_prompt += (
            "\n\nMIXED MODE — IMPORTANT INSTRUCTIONS:"
            "\nYou have access to the user's REAL farm/business data from their database AND "
            "your own agricultural knowledge. You MUST use BOTH to answer."
            "\n1. First, reference the user's actual data (crops, areas, expenses, land, etc.) "
            "using the EXACT numbers from the JSON provided."
            "\n2. Then, supplement with your AI knowledge — recommendations, predictions, "
            "best practices, expected profits, suitable crops, fertilizer advice, etc."
            "\n3. Clearly distinguish between facts from data vs. AI recommendations."
            "\n4. If the data shows the user does NOT have a particular crop or record, "
            "say so, then still provide general AI advice about it."
            "\n5. Be practical and actionable. The farmer wants concrete advice."
        )
    elif strict_data_only:
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
        if mixed_mode:
            context_text = (
                "Here is the user's REAL data from their database. "
                "Use these facts as the foundation, then ADD your AI expertise:\n"
                f"```json\n{json.dumps(safe_context, indent=2)}\n```"
            )
            messages.append({"role": "user", "content": context_text})
            messages.append({"role": "assistant", "content": "I have your farm data loaded. I will combine your real data with my agricultural knowledge to give you the best answer."})
        else:
            context_text = (
                "Here is the user's COMPLETE data from the database. "
                "Use ONLY these exact numbers to answer the question:\n"
                f"```json\n{json.dumps(safe_context, indent=2)}\n```"
            )
            messages.append({"role": "user", "content": context_text})
            messages.append({"role": "assistant", "content": "I have your complete data loaded. I will answer using only the exact numbers from your records."})

    messages.append({"role": "user", "content": question})

    candidate_models = [
        os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    ]
    models = list(dict.fromkeys(candidate_models))

    # Use slightly higher temperature for mixed mode to allow creative advice
    temp = 0.4 if mixed_mode else 0.2

    raw_answer = "⚠️ AI service temporarily unavailable. Please try again shortly."
    for model_name in models:
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=temp,
                max_tokens=1024,
            )
            content = response.choices[0].message.content or ""
            if "<think>" in content and "</think>" in content:
                content = content.split("</think>")[-1].strip()
            if content:
                raw_answer = content
                break
        except Exception as e:
            print(f"[RAG] Groq API error with {model_name}: {e}")
            continue

    return raw_answer


# ---------------------------------------------------------------------------
# 4. RAG Orchestrator
# ---------------------------------------------------------------------------

async def handle_chat(user: User, question: str, session: AsyncSession, target_lang: str = "en") -> dict:
    """
    Main entry point. Classifies the question, queries DB if needed,
    calls Groq if needed, translates answer into target_lang, and returns a structured response.
    """
    classification = classify_question(question)
    role = user.role if isinstance(user.role, str) else user.role.value

    print(f"[RAG] Question: {question!r}")
    print(f"[RAG] Initial classification: {classification}")

    result = None

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

        result = {
            "answer": "\n".join(answer_parts),
            "source": "db_only",
            "data_points": None,  # Don't expose raw personal data in API response
        }

    # ----- DATABASE: answer from DB data with LLM formatting -----
    elif classification == "database":
        db_context = await query_database_context(user, question, session)

        if not db_context:
            result = {
                "answer": "I couldn't find relevant data in your records. Try asking about your crops, expenses, orders, or inventory.",
                "source": "db_only",
                "data_points": None,
            }
        else:
            answer = await call_groq(question, context=db_context, role=role, strict_data_only=True, target_lang=target_lang)
            result = {
                "answer": answer,
                "source": "db_only",
                "data_points": db_context,
            }

    # ----- EXTERNAL: pure general knowledge from Groq -----
    elif classification == "external":
        answer = await call_groq(question, role=role, target_lang=target_lang)
        result = {
            "answer": answer,
            "source": "external",
            "data_points": None,
        }

    # ----- MIXED: combine DB context with AI reasoning -----
    else:
        # Fetch DB data first so we can check data-awareness
        db_context = await query_database_context(user, question, session)

        mentioned_crops = extract_crop_names_from_question(question)
        if mentioned_crops and db_context:
            has_crop = user_has_relevant_crop(mentioned_crops, db_context)
            if not has_crop:
                print(f"[RAG] User asked about {mentioned_crops} but doesn't have them → downgrading to external")
                answer = await call_groq(question, role=role, target_lang=target_lang)
                result = {
                    "answer": answer,
                    "source": "external",
                    "data_points": None,
                }

        if result is None:
            if not db_context:
                print(f"[RAG] No DB context found → downgrading to external")
                answer = await call_groq(question, role=role, target_lang=target_lang)
                result = {
                    "answer": answer,
                    "source": "external",
                    "data_points": None,
                }
            else:
                answer = await call_groq(
                    question,
                    context=db_context,
                    role=role,
                    mixed_mode=True,
                    target_lang=target_lang
                )
                result = {
                    "answer": answer,
                    "source": "mixed",
                    "data_points": db_context,
                }

    # Auto-translate final answer if target_lang != 'en' using Gemini translate_text
    if target_lang and target_lang != "en" and result and result.get("answer"):
        try:
            from ..routers.translate import translate_text
            result["answer"] = await translate_text(result["answer"], target_lang=target_lang)
        except Exception as e:
            print(f"[RAG] Auto-translation error: {e}")

    return result

