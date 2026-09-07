"""
Voice Processing Router — AI-Powered Voice Assistant
=====================================================
Uses Groq LLM (llama-3.3-70b-versatile) to understand natural language
voice commands and return structured JSON actions.

Supports all 9 Indian languages + English.
"""

import os
import json
import traceback
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession
from groq import AsyncGroq

from ..database import get_session
from ..deps import get_current_user
from ..models.user import User

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
    action: str  # navigate | api_call | fill_form | show_answer | change_language
    params: dict = {}
    response_text: str  # Human-readable text for TTS
    navigate_to: Optional[str] = None


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the AgriFlow Voice Assistant — an AI that converts spoken farmer commands into structured JSON actions.

The user speaks in any Indian language (English, Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Punjabi). You must understand ALL of them.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation, no extra text). The JSON must have these fields:
{
  "action": "navigate" | "api_call" | "fill_form" | "show_answer" | "change_language",
  "params": { ... },
  "response_text": "Short spoken response in the SAME LANGUAGE the user spoke",
  "navigate_to": "/path/to/page" or null
}

## Available Actions

### 1. navigate — Go to a page
Pages available (for farmer role):
- /dashboard/farmer — Main dashboard
- /dashboard/farmer/crops — My crops list
- /dashboard/farmer/market — Buy fertilizers/pesticides/seeds from shops
- /dashboard/farmer/market-prices — Check mandi/market commodity prices
- /dashboard/farmer/weather — Weather forecast
- /dashboard/farmer/news — Agriculture news
- /dashboard/farmer/community — Community chat with other farmers
- /dashboard/farmer/nutrition — Precision nutrition / fertilizer recommendations
- /dashboard/farmer/learning — Learning hub (videos, tutorials)
- /dashboard/farmer/expenses — Expense tracking
- /dashboard/farmer/profile — My profile settings
- /dashboard/farmer/analytics — Farm analytics

Pages available (for shop role):
- /dashboard/shop — Main dashboard
- /dashboard/shop/inventory — Product inventory
- /dashboard/shop/orders — Customer orders
- /dashboard/shop/accounting — Accounting/expenses
- /dashboard/shop/profile — Shop profile

Pages available (for manufacturer role):
- /dashboard/manufacturer — Main dashboard
- /dashboard/manufacturer/purchases — Raw material purchases
- /dashboard/manufacturer/production — Production batches
- /dashboard/manufacturer/sales — Sales
- /dashboard/manufacturer/profile — Mill profile

Pages available (for customer role):
- /dashboard/customer — Main dashboard
- /dashboard/customer/orders — My orders
- /dashboard/customer/profile — My profile

Example:
User says: "Go to my crops" or "నా పంటలు చూపించు" or "मेरी फसलें दिखाओ"
Response: {"action": "navigate", "params": {}, "response_text": "Opening your crops page", "navigate_to": "/dashboard/farmer/crops"}

### 2. api_call — Create or modify data via API
Available API calls:
- add_crop: POST /crops/ — fields: name, area, season, variety, sowing_date, status
- add_expense: POST /crops/{crop_id}/expenses — fields: crop_name (if mentioned), category, type, quantity, unit, unit_cost, total_cost, date, payment_mode, stage
- add_harvest: POST /crops/{crop_id}/harvests — fields: crop_name (if mentioned), date, quantity, unit, quality, selling_price_per_unit, total_revenue, buyer_type, sold_to
- update_profile: PUT /farmer/profile — fields: village, mandal, district, state, pincode, house_no, street, father_husband_name, etc.

Example:
User says: "Add 2 acres of rice crop"
Response: {"action": "api_call", "params": {"endpoint": "add_crop", "data": {"name": "Rice", "area": 2, "season": "Kharif", "status": "active"}}, "response_text": "Adding 2 acres of rice crop", "navigate_to": "/dashboard/farmer/crops"}

User says: "Add expense 500 rupees for fertilizer in rice crop"
Response: {"action": "api_call", "params": {"endpoint": "add_expense", "data": {"crop_name": "Rice", "category": "Input", "type": "Fertilizer", "total_cost": 500, "unit_cost": 500, "quantity": 1, "unit": "lot", "payment_mode": "cash", "stage": "Growth"}}, "response_text": "Adding fertilizer expense of 500 rupees for Rice crop", "navigate_to": null}

User says: "Update my village to Rayaparthi"
Response: {"action": "api_call", "params": {"endpoint": "update_profile", "data": {"village": "Rayaparthi"}}, "response_text": "Updating your village to Rayaparthi", "navigate_to": "/dashboard/farmer/profile"}

### 3. fill_form — Pre-fill a form on the current page (for complex forms the user should review)
Use this when the user gives data but you think they should review before submitting.

Example:
User says: "Fill my profile with village Rayaparthi, mandal Manthani, district Peddapalli, state Telangana"
Response: {"action": "fill_form", "params": {"fields": {"village": "Rayaparthi", "mandal": "Manthani", "district": "Peddapalli", "state": "Telangana"}}, "response_text": "I've filled your profile details. Please review and save.", "navigate_to": "/dashboard/farmer/profile"}

### 4. show_answer — Answer a question (about farming, prices, weather, their data)
Use this for information queries. The response_text should contain the full answer.

Example:
User says: "What is the best season to grow rice?"
Response: {"action": "show_answer", "params": {}, "response_text": "Rice is best grown in the Kharif season (June-November) when monsoon rains provide adequate water.", "navigate_to": null}

User says: "How much did I spend?" — For data questions, tell them to check the relevant page.
Response: {"action": "show_answer", "params": {}, "response_text": "Let me take you to your expenses page where you can see all your spending.", "navigate_to": "/dashboard/farmer/expenses"}

### 5. change_language — Switch app language
Available: en, hi, te, ta, kn, mr, bn, gu, pa

Example:
User says: "Change language to Telugu" or "తెలుగులో మార్చు"
Response: {"action": "change_language", "params": {"locale": "te"}, "response_text": "భాష తెలుగుకు మారుస్తున్నాను", "navigate_to": null}

## Conversational Context
You will be provided with the Conversation History. 
Use the history to resolve missing information for the current command. 
If the user's current command is a follow-up (like just providing a number or name), combine it with the intent from the history.
For example, if the history shows the user wanted to add an expense, and their current command is "500 rupees", return the full `api_call` action for `add_expense` with 500 rupees and all other details mentioned previously.
If the user wants to perform an action (like add_crop or add_expense) but is MISSING required fields, DO NOT return an `api_call`. Instead, return a `show_answer` action to ASK them for the missing information (e.g., "How much was the expense?").

## Rules
1. ALWAYS respond in valid JSON only — never add markdown or explanations
2. response_text MUST be in the SAME language the user spoke. If they spoke Telugu, respond in Telugu.
3. If unsure what the user wants, use show_answer with a helpful message
4. For navigation, always use the correct path for the user's role
5. Keep response_text SHORT (1-2 sentences max) — it will be spoken aloud
6. For expense amounts, parse numbers from any format: "500", "five hundred", "పంచ వందలు", "पाँच सौ"
7. When adding crops, infer reasonable defaults: season based on month, status="active"
8. For crop names, capitalize properly: "rice" → "Rice", "tomato" → "Tomato"
9. When LIVE EXTERNAL DATA is provided (weather, prices, news, schemes), use that data to give accurate, real-time answers. Do NOT make up weather/price/news data — use only what is provided.
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

    # Build history context
    history_context = ""
    if request.history:
        history_context = "Conversation History:\n"
        for msg in request.history:
            history_context += f"{msg.role.capitalize()}: {msg.content}\n"
        history_context += "\n"

    # Build the user message with context
    user_message = (
        f"User role: {role}\n"
        f"Current page: {request.current_page}\n"
        f"Language: {request.locale}\n"
        f"{history_context}"
        f"User said: \"{transcript}\"\n\n"
        f"Parse this voice command into a JSON action considering the conversation history."
    )

    # Check if the voice query needs real-time external data
    transcript_lower = transcript.lower()
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
            if external_data_text:
                user_message += (
                    f"\n\nLIVE EXTERNAL DATA (use this for accurate real-time answers):\n"
                    f"{external_data_text}"
                )
                print(f"[Voice] Injected live external data for real-time query")
        except Exception as e:
            print(f"[Voice] External data fetch error: {e}")

    candidate_models = [
        os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    ]
    models = list(dict.fromkeys(candidate_models))

    for model_name in models:
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
                max_tokens=512,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content or "{}"
            if "<think>" in raw and "</think>" in raw:
                raw = raw.split("</think>")[-1].strip()
            
            # Parse the JSON response
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown if LLM wrapped it
                import re
                json_match = re.search(r'\{[\s\S]*\}', raw)
                if json_match:
                    parsed = json.loads(json_match.group())
                else:
                    continue

            # Intercept to resolve crop_id if crop_name is present
            if parsed.get("action") == "api_call":
                endpoint = parsed.get("params", {}).get("endpoint")
                data = parsed.get("params", {}).get("data", {})
                if endpoint in ["add_expense", "add_harvest"] and "crop_id" not in data:
                    crop_name = data.get("crop_name") or data.get("name")
                    if crop_name:
                        from sqlmodel import select
                        from ..models.crop import Crop
                        statement = select(Crop).where(
                            Crop.user_id == current_user.id,
                            Crop.name.ilike(f"%{crop_name}%")
                        )
                        result = await session.execute(statement)
                        crop = result.scalars().first()
                        if crop:
                            parsed["params"]["data"]["crop_id"] = crop.id

            return VoiceAction(
                action=parsed.get("action", "show_answer"),
                params=parsed.get("params", {}),
                response_text=parsed.get("response_text", "Done."),
                navigate_to=parsed.get("navigate_to"),
            )

        except Exception as e:
            print(f"[Voice] Groq API error with {model_name}: {e}")
            continue

    return VoiceAction(
        action="show_answer",
        params={},
        response_text="Sorry, the AI service is temporarily unavailable. Please try again.",
        navigate_to=None,
    )

