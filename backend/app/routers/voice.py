"""
Voice Processing Router — AI-Powered Voice Assistant (v2)
==========================================================
Full-power conversational AI that:
  - Understands voice commands in 10 Indian languages
  - Executes actions (add/update/delete) directly on the server
  - Answers data questions using real DB context
  - Supports multi-turn conversations (collects missing info)
  - Injects live external data (weather, prices, news, schemes)
  - Protects personal/sensitive data from voice modification
"""

import os
import json
import re
import traceback
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from groq import AsyncGroq

from ..database import get_session
from ..deps import get_current_user
from ..models.user import User
from ..models.crop import Crop

router = APIRouter(prefix="/voice", tags=["voice"])


# ── Request / Response Models ─────────────────────────────────────────────────

class VoiceMessage(BaseModel):
    role: str
    content: str

class VoiceRequest(BaseModel):
    transcript: str
    current_page: Optional[str] = "/dashboard/farmer"
    locale: Optional[str] = "en"
    history: List[VoiceMessage] = []


class VoiceAction(BaseModel):
    action: str  # navigate | api_call | fill_form | show_answer | change_language | ask_followup
    params: dict = {}
    response_text: str  # Human-readable text for TTS
    navigate_to: Optional[str] = None
    execution_result: Optional[dict] = None  # Server-side execution result
    requires_followup: bool = False           # True if the assistant needs more info


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the AgriFlow Voice Assistant — a powerful AI that helps Indian farmers, shop owners, and manufacturers manage their farm/business entirely by voice.

The user can speak in any Indian language (English, Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Punjabi) or select their preferred language. You must understand ALL of them.

CRITICAL LANGUAGE RULE:
You MUST respond with `response_text` in the user's SELECTED APP LANGUAGE specified in the prompt.
- If selected language is Telugu, ask all questions, follow-ups, and answers in Telugu (తెలుగు).
- If selected language is Hindi, ask all questions, follow-ups, and answers in Hindi (हिन्दी).
- If selected language is Tamil, Kannada, Marathi, Bengali, Gujarati, Punjabi, respond in that language.
- Only respond in English if the selected language is English.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation, no extra text). The JSON must have these fields:
{
  "action": "navigate" | "api_call" | "fill_form" | "show_answer" | "change_language" | "ask_followup",
  "params": { ... },
  "response_text": "Short spoken response STRICTLY in the user's SELECTED language",
  "navigate_to": "/path/to/page" or null,
  "requires_followup": false
}

## Available Actions

### 1. navigate — Go to a page
Pages for farmer: /dashboard/farmer, /dashboard/farmer/crops, /dashboard/farmer/market, /dashboard/farmer/market-prices, /dashboard/farmer/weather, /dashboard/farmer/news, /dashboard/farmer/community, /dashboard/farmer/nutrition, /dashboard/farmer/learning, /dashboard/farmer/expenses, /dashboard/farmer/profile, /dashboard/farmer/analytics
Pages for shop: /dashboard/shop, /dashboard/shop/inventory, /dashboard/shop/orders, /dashboard/shop/accounting, /dashboard/shop/profile
Pages for manufacturer: /dashboard/manufacturer, /dashboard/manufacturer/purchases, /dashboard/manufacturer/production, /dashboard/manufacturer/sales, /dashboard/manufacturer/profile
Pages for customer: /dashboard/customer, /dashboard/customer/orders, /dashboard/customer/profile

### 2. api_call — Create, modify, or delete data (EXECUTED ON SERVER)
The server will execute these actions directly. Return the complete data needed.

Available endpoints:

**Farmer actions:**
- add_crop: Add a new crop
  Required: name, area (in acres)
  Optional: season (Kharif/Rabi/Zaid - auto-inferred from month), variety, sowing_date (defaults to today), status (defaults to "Growing"), crop_type

- add_expense: Add expense to a crop
  Required: crop_name, total_cost
  Optional: category (Input/Labor/Machinery/Irrigation/Logistics/Miscellaneous), type (Seed/Fertilizer/Pesticide/Labor/etc), quantity, unit, unit_cost, date, payment_mode (cash/digital), stage

- add_harvest: Record a crop harvest
  Required: crop_name, quantity (in quintals)
  Optional: selling_price_per_unit, date, stage (First Picking/Second Picking/Final Harvest), unit (Quintals/Kg/Tons), quality, buyer_type (Market/Private/Government), sold_to

- add_sale: Record a crop sale
  Required: crop_name, quantity_quintals, price_per_quintal
  Optional: buyer_type (Mill/Market/Direct/Trader), buyer_name, date, payment_mode, total_bags, bag_size

- update_crop: Update an existing crop
  Required: crop_name + at least one field to update
  Updatable: name, area, season, variety, status, notes, crop_type

- delete_expense: Delete an expense
  Required: expense_id OR (crop_name + expense description to identify it)

- update_profile: Update farmer profile (NON-SENSITIVE fields only)
  Allowed: village, mandal, district, state, pincode, house_no, street, father_husband_name, total_area, gender
  ⚠️ BLOCKED: bank_name, account_number, ifsc_code, aadhaar, pan_number, email, phone_number, password, license_number

**Shop actions:**
- add_product: Add product to inventory
  Required: name, price, quantity
  Optional: category, unit, brand, cost_price, batch_number, description, status

- update_product: Update existing product
  Required: product_name + at least one field
  Updatable: name, price, cost_price, quantity, unit, category, brand, status, description

Examples:
User: "Add 2 acres of rice crop"
→ {"action": "api_call", "params": {"endpoint": "add_crop", "data": {"name": "Rice", "area": 2}}, "response_text": "Adding 2 acres of rice crop", "navigate_to": "/dashboard/farmer/crops"}

User: "Add expense 500 rupees for fertilizer in rice"
→ {"action": "api_call", "params": {"endpoint": "add_expense", "data": {"crop_name": "Rice", "total_cost": 500, "category": "Input", "type": "Fertilizer"}}, "response_text": "Adding 500 rupees fertilizer expense for Rice", "navigate_to": null}

User: "I harvested 10 quintals of rice at 2000 per quintal"
→ {"action": "api_call", "params": {"endpoint": "add_harvest", "data": {"crop_name": "Rice", "quantity": 10, "selling_price_per_unit": 2000}}, "response_text": "Recording harvest of 10 quintals of Rice at 2000 per quintal", "navigate_to": null}

User: "I sold 5 quintals of wheat at 2200 per quintal to a trader"
→ {"action": "api_call", "params": {"endpoint": "add_sale", "data": {"crop_name": "Wheat", "quantity_quintals": 5, "price_per_quintal": 2200, "buyer_type": "Trader"}}, "response_text": "Recording sale of 5 quintals of Wheat at 2200 per quintal", "navigate_to": null}

User: "Update rice crop status to harvested"
→ {"action": "api_call", "params": {"endpoint": "update_crop", "data": {"crop_name": "Rice", "status": "Harvested"}}, "response_text": "Updating Rice status to Harvested", "navigate_to": null}

### 3. ask_followup — Ask for missing required information
When the user wants to do something but HASN'T provided all required fields, DO NOT return api_call.
Instead, return ask_followup with the info collected so far and what's missing.

Set "requires_followup": true

Include in params:
  - pending_action: the endpoint name (e.g., "add_expense")
  - collected_data: data collected so far
  - missing_fields: list of fields still needed
  - question_field: the MOST important missing field to ask about next

Examples:
User: "Add an expense"
→ {"action": "ask_followup", "params": {"pending_action": "add_expense", "collected_data": {}, "missing_fields": ["crop_name", "total_cost", "type"], "question_field": "crop_name"}, "response_text": "Which crop is this expense for?", "requires_followup": true}

User: "Add expense for rice"
→ {"action": "ask_followup", "params": {"pending_action": "add_expense", "collected_data": {"crop_name": "Rice"}, "missing_fields": ["total_cost"], "question_field": "total_cost"}, "response_text": "How much was the expense for Rice?", "requires_followup": true}

### 4. show_answer — Answer a question using the provided data
You will be given the user's ACTUAL farm/business data and LIVE external data.
Use this data to answer questions ACCURATELY with real numbers.

When the user asks about their crops, expenses, profits, weather, prices, news, or schemes:
- Use the DATABASE CONTEXT to give exact numbers (total expenses, crop count, revenue, etc.)
- Use the LIVE EXTERNAL DATA for weather, prices, news, and schemes
- Do NOT redirect to a page when you can answer directly

Examples:
User: "How much did I spend?" (with DB context showing total_expenses: 15000)
→ {"action": "show_answer", "params": {}, "response_text": "You have spent a total of 15,000 rupees on your crops this season.", "navigate_to": null}

User: "What is today's weather?" (with live weather data showing 28°C)
→ {"action": "show_answer", "params": {}, "response_text": "Today's temperature is 28 degrees with light rain expected. Wind is 6 km per hour.", "navigate_to": null}

User: "What is the price of wheat?" (with live market data)
→ {"action": "show_answer", "params": {}, "response_text": "Wheat is currently at 2,200 rupees per quintal. The MSP is 2,125 rupees.", "navigate_to": null}

### 5. fill_form — Pre-fill a form for user to review
Use when user gives complex data they should review before submitting.

### 6. change_language — Switch app language
Available: en, hi, te, ta, kn, mr, bn, gu, pa

## Multi-Turn Conversation Rules
1. Use the Conversation History to resolve follow-up responses
2. If history shows a pending ask_followup with pending_action and collected_data, and the user provides the missing field, COMBINE the collected_data with the new info and return a COMPLETE api_call
3. If still missing required fields after combining, return another ask_followup
4. The user might say things like "500 rupees", "Rice", "yes", "2 acres" — interpret these as answers to your previous question

Example multi-turn flow:
History: Assistant asked "Which crop is this expense for?" (pending_action: add_expense, collected_data: {total_cost: 500, type: "Fertilizer"})
User says: "Rice"
→ {"action": "api_call", "params": {"endpoint": "add_expense", "data": {"crop_name": "Rice", "total_cost": 500, "type": "Fertilizer"}}, "response_text": "Adding 500 rupees fertilizer expense for Rice crop"}

## Privacy & Security Rules
1. NEVER allow modification of: bank_name, account_number, ifsc_code, aadhaar, pan_number, email, phone_number, password, license_number
2. If user tries to change these via voice, return show_answer saying "For security, please update bank and identity details from the profile page directly"
3. You CAN read and display non-sensitive profile data (name, village, district, crop info)

## General Rules
1. ALWAYS respond in valid JSON only — no markdown, no explanations
2. response_text MUST be in the SAME LANGUAGE the user spoke
3. Keep response_text SHORT (1-3 sentences max) — it will be spoken aloud
4. Parse numbers from any format: "500", "five hundred", "పంచ వందలు", "पाँच सौ"
5. Capitalize crop names: "rice" → "Rice", "tomato" → "Tomato"
6. When adding crops, infer season from current month if not specified
7. When you have DATABASE CONTEXT with the user's real data, use it to answer data questions directly — don't just say "check the page"
8. When LIVE EXTERNAL DATA is provided, use it for weather/prices/news — do NOT make up data
9. For data questions, prefer giving a direct answer over navigating to a page
"""  # noqa: E501

# Keywords that indicate the voice query needs real-time external data
VOICE_REALTIME_KEYWORDS = [
    # Weather
    "weather", "rain", "temperature", "forecast", "mausam", "barish",
    "monsoon", "frost", "cold", "hot", "humidity", "varsha", "vana",
    # Market prices
    "price", "rate", "mandi", "market price", "bhav", "dham",
    "wheat price", "rice price", "cotton price",
    # News
    "news", "headline", "khabar", "samachar", "update",
    # Government schemes
    "scheme", "yojana", "subsidy", "pm-kisan", "pm kisan", "kisan",
    "loan", "insurance", "pmfby", "kcc",
]

# Keywords that indicate the user is asking about their own data
VOICE_DATA_KEYWORDS = [
    "how much", "how many", "total", "spent", "earned", "profit", "loss",
    "revenue", "expense", "cost", "crop", "my crop", "my expense", "my harvest",
    "my sale", "my order", "my product", "inventory", "stock", "kitna",
    "kharcha", "kamai", "munafa", "labh", "show me", "tell me", "list",
    "status", "active", "pending", "what is my", "what are my",
]


# ── DB Context Builder ────────────────────────────────────────────────────────

async def _build_user_context(user: User, session: AsyncSession) -> str:
    """Build a compact summary of the user's data for the LLM."""
    role = user.role if isinstance(user.role, str) else user.role.value
    lines = [f"USER DATA (role: {role}):"]

    if role in ("farmer", "FARMER"):
        # Crops list
        stmt = select(Crop).where(Crop.user_id == user.id)
        result = await session.exec(stmt)
        crops = result.all()

        if crops:
            lines.append(f"  Active Crops ({len(crops)} total):")
            total_area = 0.0
            total_cost = 0.0
            total_revenue = 0.0
            for c in crops:
                area_str = f"{c.area} acres" if c.area else ""
                status_str = f"[{c.status}]" if c.status else ""
                cost_str = f", Cost: ₹{c.total_cost:,.0f}" if c.total_cost else ""
                rev_str = f", Revenue: ₹{c.total_revenue:,.0f}" if c.total_revenue else ""
                profit_str = f", Profit: ₹{c.net_profit:,.0f}" if c.net_profit else ""
                lines.append(f"    - {c.name} (ID:{c.id}) — {area_str} {status_str}{cost_str}{rev_str}{profit_str}")
                total_area += c.area or 0
                total_cost += c.total_cost or 0
                total_revenue += c.total_revenue or 0

            total_profit = total_revenue - total_cost
            lines.append(f"  Summary: {len(crops)} crops, {total_area:.1f} acres total")
            lines.append(f"    Total Expenses: ₹{total_cost:,.0f}")
            lines.append(f"    Total Revenue: ₹{total_revenue:,.0f}")
            lines.append(f"    Net Profit: ₹{total_profit:,.0f}")
        else:
            lines.append("  No crops recorded yet.")

    elif role in ("shop", "SHOP"):
        from ..models.trade import Product as ShopProduct
        stmt = select(ShopProduct).where(ShopProduct.user_id == user.id)
        result = await session.exec(stmt)
        products = result.all()

        if products:
            active = [p for p in products if p.status == "active"]
            lines.append(f"  Products: {len(products)} total ({len(active)} active)")
            total_value = sum((p.cost_price or 0) * p.quantity for p in products)
            lines.append(f"  Total Stock Value: ₹{total_value:,.0f}")
            for p in products[:10]:
                lines.append(f"    - {p.name} (ID:{p.id}): ₹{p.price}, Stock: {p.quantity} {p.unit}")
        else:
            lines.append("  No products in inventory.")

    return "\n".join(lines)


# ── Voice Processing Endpoint ────────────────────────────────────────────────

@router.post("/process", response_model=VoiceAction)
async def process_voice(
    request: VoiceRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Process a voice command transcript and return a structured action."""
    transcript = request.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Empty transcript")

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your-groq-api-key-here":
        raise HTTPException(status_code=500, detail="Groq API key not configured")

    client = AsyncGroq(api_key=api_key)

    role = current_user.role if isinstance(current_user.role, str) else current_user.role.value

    # ── 1. Build history context ──────────────────────────────────────────
    history_context = ""
    if request.history:
        history_context = "Conversation History:\n"
        for msg in request.history:
            history_context += f"{msg.role.capitalize()}: {msg.content}\n"
        history_context += "\n"

    # ── 2. Build DB context (user's real data) ────────────────────────────
    transcript_lower = transcript.lower()
    db_context_text = ""

    # Always inject DB context for data queries and api_call commands
    needs_db = (
        any(kw in transcript_lower for kw in VOICE_DATA_KEYWORDS) or
        any(kw in transcript_lower for kw in [
            "add", "expense", "harvest", "sale", "crop", "product",
            "update", "delete", "remove", "change",
            # Hindi/Telugu/Tamil equivalents
            "jodo", "kharcha", "fasal", "becho", "bikri",
            "panta", "pancha", "kharchu", "ammu",
        ]) or
        # If there's a pending action in history, we need context
        any("pending_action" in msg.content for msg in request.history if msg.role == "assistant")
    )

    if needs_db:
        try:
            db_context_text = await _build_user_context(current_user, session)
        except Exception as e:
            print(f"[Voice] DB context error: {e}")

    # ── 3. Fetch live external data if needed ─────────────────────────────
    external_data_text = ""
    if any(kw in transcript_lower for kw in VOICE_REALTIME_KEYWORDS):
        try:
            from ..services.external_data_service import (
                gather_all_external_context,
                format_external_context_for_llm,
            )
            external_data = await gather_all_external_context(
                user=current_user, session=session, question=transcript
            )
            external_data_text = format_external_context_for_llm(external_data)
        except Exception as e:
            print(f"[Voice] External data fetch error: {e}")

    # ── 4. Build the user message ─────────────────────────────────────────
    lang_code = request.locale or "en"
    lang_name_map = {
        "en": "English",
        "hi": "Hindi (हिन्दी)",
        "te": "Telugu (తెలుగు)",
        "ta": "Tamil (தமிழ்)",
        "kn": "Kannada (ಕನ್ನಡ)",
        "mr": "Marathi (मराठी)",
        "bn": "Bengali (বাংলা)",
        "gu": "Gujarati (ગુજરાતી)",
        "pa": "Punjabi (ਪੰਜਾਬੀ)",
    }
    target_lang_name = lang_name_map.get(lang_code, "English")

    user_message = (
        f"User role: {role}\n"
        f"Current page: {request.current_page}\n"
        f"Target App Language: {target_lang_name} (code: {lang_code})\n"
        f"Current date/time: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"MANDATORY INSTRUCTION: You MUST provide 'response_text' strictly in {target_lang_name}.\n"
        f"- If asking a question or follow-up, write the question in {target_lang_name}.\n"
        f"- If answering, provide numbers and details in {target_lang_name}.\n"
        f"- If confirming an action, write the confirmation in {target_lang_name}.\n"
    )

    if db_context_text:
        user_message += f"\nDATABASE CONTEXT (user's real data):\n{db_context_text}\n"

    if external_data_text:
        user_message += f"\nLIVE EXTERNAL DATA:\n{external_data_text}\n"

    user_message += f"\n{history_context}"
    user_message += f'User said: "{transcript}"\n\n'
    user_message += "Parse this voice command into a JSON action. Use DATABASE CONTEXT and LIVE DATA to answer questions directly."

    # ── 5. Call LLM ───────────────────────────────────────────────────────
    candidate_models = [
        os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    ]
    models = list(dict.fromkeys(candidate_models))

    parsed = None
    for model_name in models:
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
                max_tokens=800,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content or "{}"
            if "<think>" in raw and "</think>" in raw:
                raw = raw.split("</think>")[-1].strip()

            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                json_match = re.search(r'\{[\s\S]*\}', raw)
                if json_match:
                    parsed = json.loads(json_match.group())
                else:
                    continue

            break  # Successfully parsed

        except Exception as e:
            print(f"[Voice] Groq API error with {model_name}: {e}")
            continue

    if not parsed:
        return VoiceAction(
            action="show_answer",
            params={},
            response_text="Sorry, the AI service is temporarily unavailable. Please try again.",
            navigate_to=None,
        )

    # ── 6. Server-side execution for api_call ─────────────────────────────
    execution_result = None

    if parsed.get("action") == "api_call":
        endpoint = parsed.get("params", {}).get("endpoint", "")
        data = parsed.get("params", {}).get("data", {})

        # Auto-resolve crop_id from crop_name
        crop_name = data.get("crop_name") or data.get("name", "")
        if session and crop_name and "crop_id" not in data and endpoint in (
            "add_expense", "add_harvest", "add_sale", "update_crop"
        ):
            stmt = select(Crop).where(
                Crop.user_id == current_user.id,
                Crop.name.ilike(f"%{crop_name}%"),
            )
            result = await session.exec(stmt)
            crop = result.first()
            if crop:
                data["crop_id"] = crop.id
                parsed["params"]["data"] = data

        # Execute the action on the server
        try:
            from ..services.voice_executor import execute_voice_action
            execution_result = await execute_voice_action(
                user=current_user,
                action="api_call",
                params=parsed.get("params", {}),
                session=session,
            )

            # Update response text with the execution result
            if execution_result.get("success"):
                parsed["response_text"] = execution_result.get("message", parsed.get("response_text", "Done."))
            else:
                # Execution failed — check if it's a missing-field issue
                error_msg = execution_result.get("message", "")
                if any(q in error_msg.lower() for q in ["which crop", "how much", "how many", "what is", "what was"]):
                    # Convert to ask_followup
                    parsed["action"] = "ask_followup"
                    parsed["response_text"] = error_msg
                    parsed["requires_followup"] = True
                    parsed["params"] = {
                        "pending_action": endpoint,
                        "collected_data": data,
                        "missing_fields": [],
                    }
                else:
                    parsed["response_text"] = error_msg

        except Exception as e:
            print(f"[Voice] Execution error: {e}")
            traceback.print_exc()
            parsed["response_text"] = f"Sorry, there was an error: {str(e)}"

    # ── 7. Multilingual Guard: Ensure response_text matches selected locale ──
    final_text = parsed.get("response_text", "Done.")
    target_locale = request.locale or "en"
    if target_locale != "en" and final_text and final_text.strip():
        try:
            from .translate import translate_text
            # Translate whatever text was generated (including execution messages, errors, follow-ups)
            final_text = await translate_text(final_text, target_lang=target_locale, source_lang="en")
        except Exception as e:
            print(f"[Voice] Multilingual guard translation error: {e}")

    # ── 8. Build response ─────────────────────────────────────────────────
    return VoiceAction(
        action=parsed.get("action", "show_answer"),
        params=parsed.get("params", {}),
        response_text=final_text,
        navigate_to=parsed.get("navigate_to"),
        execution_result=execution_result,
        requires_followup=parsed.get("requires_followup", False),
    )
