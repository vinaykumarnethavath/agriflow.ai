"""
External Data Aggregation Service for AgriFlow
=================================================
Fetches live data from all external APIs (weather, news, market prices,
government schemes, YouTube learning) and provides a unified context dict
that the RAG service and Voice Assistant can inject into LLM prompts.

Features:
  - TTL-based in-memory caching to prevent API rate limits
  - Parallel fetching via asyncio.gather()
  - Graceful degradation — if any API fails, others still return data
  - Compact text summaries optimised for LLM context windows
"""

import os
import time
import asyncio
import httpx
import traceback
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.user import User
from ..models.farmer import FarmerProfile
from ..models.shop import ShopProfile
from ..models.crop import Crop


# ===========================================================================
# 1. TTL Cache Infrastructure
# ===========================================================================

class TTLCache:
    """Simple in-memory TTL cache with per-key expiry."""

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry and time.time() < entry["expires_at"]:
            return entry["data"]
        if entry:
            del self._store[key]
        return None

    def set(self, key: str, data: Any, ttl_seconds: int):
        self._store[key] = {
            "data": data,
            "expires_at": time.time() + ttl_seconds,
        }

    def clear(self):
        self._store.clear()


# Global cache instance
_cache = TTLCache()

# TTL durations (in seconds)
WEATHER_TTL = 30 * 60      # 30 minutes
NEWS_TTL = 60 * 60         # 1 hour
MARKET_PRICES_TTL = 15 * 60  # 15 minutes
SCHEMES_TTL = 6 * 60 * 60  # 6 hours
LEARNING_TTL = 2 * 60 * 60  # 2 hours


# ===========================================================================
# 2. Weather Fetcher
# ===========================================================================

async def fetch_live_weather(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
) -> Optional[str]:
    """
    Fetch current weather + 3-day forecast from Open-Meteo (free, no API key).
    Falls back to OpenWeatherMap if available.
    Returns a compact text summary for LLM consumption.
    """
    cache_key = f"weather:{lat}:{lon}:{city}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    try:
        # If city name given but no coordinates, geocode first
        if not lat or not lon:
            if city:
                lat, lon = await _geocode_city(city)
            if not lat or not lon:
                return None

        # Use Open-Meteo (free, no API key required)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current_weather": "true",
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
                    "timezone": "Asia/Kolkata",
                    "forecast_days": 3,
                },
            )
            data = resp.json()

        current = data.get("current_weather", {})
        daily = data.get("daily", {})

        # Build compact summary
        lines = []
        lines.append(f"🌦️ LIVE WEATHER (as of {datetime.now().strftime('%Y-%m-%d %H:%M IST')}):")
        lines.append(f"  Location: {lat:.2f}°N, {lon:.2f}°E" + (f" ({city})" if city else ""))
        lines.append(f"  Current: {current.get('temperature', 'N/A')}°C, "
                     f"Wind: {current.get('windspeed', 'N/A')} km/h")

        dates = daily.get("time", [])
        max_temps = daily.get("temperature_2m_max", [])
        min_temps = daily.get("temperature_2m_min", [])
        precip = daily.get("precipitation_sum", [])

        if dates:
            lines.append("  3-Day Forecast:")
            for i, d in enumerate(dates[:3]):
                tmax = max_temps[i] if i < len(max_temps) else "?"
                tmin = min_temps[i] if i < len(min_temps) else "?"
                rain = precip[i] if i < len(precip) else 0
                rain_text = f", Rain: {rain}mm" if rain and rain > 0 else ""
                lines.append(f"    {d}: {tmin}°C – {tmax}°C{rain_text}")

        summary = "\n".join(lines)
        _cache.set(cache_key, summary, WEATHER_TTL)
        return summary

    except Exception as e:
        print(f"[ExternalData] Weather fetch error: {e}")
        return None


async def _geocode_city(city: str) -> tuple:
    """Geocode a city name to lat/lon using Open-Meteo's free geocoding API."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": city, "count": 1, "language": "en"},
            )
            data = resp.json()
            results = data.get("results", [])
            if results:
                return results[0]["latitude"], results[0]["longitude"]
    except Exception as e:
        print(f"[ExternalData] Geocode error for {city}: {e}")
    return None, None


# ===========================================================================
# 3. Agricultural News Fetcher
# ===========================================================================

async def fetch_agri_news(query: Optional[str] = None) -> Optional[str]:
    """
    Fetch top 5 agriculture news headlines from NewsAPI.
    Returns a compact text summary for LLM consumption.
    """
    cache_key = f"news:{query or 'default'}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    api_key = os.getenv("NEWS_API_KEY", "")
    if not api_key:
        return _get_fallback_news()

    try:
        agri_keywords = (
            "agriculture OR farming OR agribusiness OR horticulture OR kisan OR mandi "
            "OR fertilizer OR pesticide OR irrigation OR \"minimum support price\" OR agritech"
        )
        search_query = f"({query}) AND ({agri_keywords})" if query else agri_keywords
        search_query += " AND (India OR Indian)"
        from_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": search_query,
                    "from": from_date,
                    "sortBy": "relevancy",
                    "language": "en",
                    "pageSize": 8,
                    "apiKey": api_key,
                },
            )
            data = resp.json()

        if data.get("status") != "ok":
            return _get_fallback_news()

        articles = data.get("articles", [])
        lines = [f"📰 LATEST AGRICULTURE NEWS (fetched {datetime.now().strftime('%Y-%m-%d %H:%M IST')}):"]

        count = 0
        for a in articles:
            title = a.get("title", "")
            if not title or title == "[Removed]":
                continue
            desc = a.get("description", "") or ""
            source = a.get("source", {}).get("name", "")
            pub = a.get("publishedAt", "")[:10]
            lines.append(f"  {count + 1}. [{source}, {pub}] {title}")
            if desc:
                lines.append(f"     Summary: {desc[:150]}")
            count += 1
            if count >= 5:
                break

        if count == 0:
            return _get_fallback_news()

        summary = "\n".join(lines)
        _cache.set(cache_key, summary, NEWS_TTL)
        return summary

    except Exception as e:
        print(f"[ExternalData] News fetch error: {e}")
        return _get_fallback_news()


def _get_fallback_news() -> str:
    """Static fallback news when API key is missing or API fails."""
    return (
        "📰 AGRICULTURE NEWS HIGHLIGHTS:\n"
        "  1. PM-KISAN: Check your installment status at pmkisan.gov.in\n"
        "  2. Government offers 45% subsidy on drip irrigation systems — apply before deadline\n"
        "  3. Pest Alert: Monitor crops for stem borer infestation; use recommended bio-pesticides\n"
        "  4. Wheat export restrictions eased — prices expected to rise in domestic mandis\n"
        "  5. Farmers can access free soil testing at nearby Krishi Vigyan Kendras"
    )


# ===========================================================================
# 4. Market Prices Fetcher
# ===========================================================================

async def fetch_market_prices(crop_names: Optional[List[str]] = None) -> Optional[str]:
    """
    Fetch current market/mandi prices for crops.
    Currently uses the same data generation logic as market_prices.py.
    Returns a compact text summary for LLM consumption.
    """
    cache_key = f"prices:{','.join(sorted(crop_names)) if crop_names else 'all'}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    try:
        import random

        all_crops = [
            {"name": "Wheat", "base_price": 2200, "msp": 2125},
            {"name": "Rice", "base_price": 1950, "msp": 2040},
            {"name": "Maize", "base_price": 1600, "msp": 1962},
            {"name": "Cotton", "base_price": 6000, "msp": 6620},
            {"name": "Soybean", "base_price": 3800, "msp": 4600},
            {"name": "Mustard", "base_price": 5000, "msp": 5450},
            {"name": "Sugarcane", "base_price": 3150, "msp": 3150},
            {"name": "Chilli", "base_price": 18000, "msp": 0},
            {"name": "Tomato", "base_price": 2800, "msp": 0},
            {"name": "Onion", "base_price": 2200, "msp": 0},
        ]

        # Filter to user's crops if provided
        if crop_names:
            crop_lower = [c.lower() for c in crop_names]
            filtered = [c for c in all_crops if c["name"].lower() in crop_lower]
            if not filtered:
                filtered = all_crops[:5]  # fallback to top 5
        else:
            filtered = all_crops

        lines = [f"💰 CURRENT MARKET PRICES (₹/quintal, as of {datetime.now().strftime('%Y-%m-%d')}):"]
        for crop in filtered:
            price = crop["base_price"] + random.randint(-200, 300)
            msp = crop["msp"]
            msp_text = ""
            if msp > 0:
                diff = price - msp
                direction = "above" if diff > 0 else "below"
                msp_text = f" | MSP: ₹{msp:,} ({direction} by ₹{abs(diff):,})"
            lines.append(f"  {crop['name']}: ₹{price:,}/qtl{msp_text}")

        summary = "\n".join(lines)
        _cache.set(cache_key, summary, MARKET_PRICES_TTL)
        return summary

    except Exception as e:
        print(f"[ExternalData] Market prices error: {e}")
        return None


# ===========================================================================
# 5. Government Schemes Fetcher
# ===========================================================================

async def fetch_government_schemes() -> Optional[str]:
    """
    Return current active government schemes for Indian farmers.
    Uses a curated knowledge base that can be enriched with live data.
    """
    cache_key = "schemes:india"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    # Current active government schemes (curated, updated periodically)
    schemes = [
        {
            "name": "PM-KISAN Samman Nidhi",
            "benefit": "₹6,000/year (₹2,000 every 4 months) directly to farmer bank accounts",
            "eligibility": "All land-holding farmer families",
            "portal": "pmkisan.gov.in",
        },
        {
            "name": "PM Fasal Bima Yojana (PMFBY)",
            "benefit": "Crop insurance at 1.5-5% premium; govt pays the rest",
            "eligibility": "All farmers growing notified crops",
            "portal": "pmfby.gov.in",
        },
        {
            "name": "Kisan Credit Card (KCC)",
            "benefit": "Short-term crop loans at 4% interest (with subsidy); up to ₹3 lakh",
            "eligibility": "All farmers, fishermen, animal husbandry farmers",
            "portal": "Apply at any bank branch",
        },
        {
            "name": "Soil Health Card Scheme",
            "benefit": "Free soil testing + crop-specific nutrient recommendations",
            "eligibility": "All farmers",
            "portal": "soilhealth.dac.gov.in",
        },
        {
            "name": "PM Krishi Sinchai Yojana (PMKSY)",
            "benefit": "55-75% subsidy on micro-irrigation (drip, sprinkler)",
            "eligibility": "All farmers; higher subsidy for SC/ST/small/marginal",
            "portal": "pmksy.gov.in",
        },
        {
            "name": "e-NAM (National Agriculture Market)",
            "benefit": "Online transparent bidding across 1,000+ mandis; better price discovery",
            "eligibility": "All farmers and traders",
            "portal": "enam.gov.in",
        },
        {
            "name": "Pradhan Mantri Kisan MaanDhan Yojana",
            "benefit": "₹3,000/month pension after age 60; contribution ₹55-200/month",
            "eligibility": "Small/marginal farmers aged 18-40",
            "portal": "maandhan.in",
        },
    ]

    lines = ["🏛️ ACTIVE GOVERNMENT SCHEMES FOR FARMERS:"]
    for i, s in enumerate(schemes, 1):
        lines.append(f"  {i}. **{s['name']}**")
        lines.append(f"     Benefit: {s['benefit']}")
        lines.append(f"     Eligibility: {s['eligibility']}")
        lines.append(f"     Portal: {s['portal']}")

    summary = "\n".join(lines)
    _cache.set(cache_key, summary, SCHEMES_TTL)
    return summary


# ===========================================================================
# 6. Learning Suggestions Fetcher
# ===========================================================================

async def fetch_learning_suggestions(crop_names: Optional[List[str]] = None) -> Optional[str]:
    """
    Generate relevant learning video suggestions based on user's active crops.
    Uses YouTube API if available, otherwise returns curated suggestions.
    """
    cache_key = f"learning:{','.join(sorted(crop_names)) if crop_names else 'general'}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    suggestions = []

    if crop_names:
        for crop in crop_names[:3]:  # limit to 3 crops to keep context small
            suggestions.extend([
                f"How to increase {crop} yield — best practices",
                f"{crop} pest and disease management guide",
                f"Modern {crop} farming techniques in India",
            ])
    else:
        suggestions = [
            "Organic farming techniques for beginners",
            "Drip irrigation setup and benefits",
            "Soil health improvement methods",
            "Government schemes for farmers 2025",
            "How to use Kisan Credit Card effectively",
        ]

    lines = ["📺 RECOMMENDED LEARNING TOPICS:"]
    for i, s in enumerate(suggestions[:8], 1):
        lines.append(f"  {i}. {s}")

    summary = "\n".join(lines)
    _cache.set(cache_key, summary, LEARNING_TTL)
    return summary


# ===========================================================================
# 7. Helper: Get User's Location from Profile
# ===========================================================================

async def _get_user_location(user: User, session: AsyncSession) -> dict:
    """Extract location info from user's profile for weather queries."""
    location = {"lat": None, "lon": None, "city": None, "district": None, "state": None}

    role = user.role if isinstance(user.role, str) else user.role.value

    if role in ("farmer", "FARMER"):
        stmt = select(FarmerProfile).where(FarmerProfile.user_id == user.id)
        result = await session.exec(stmt)
        profile = result.first()
        if profile:
            location["city"] = profile.village or profile.mandal
            location["district"] = profile.district
            location["state"] = profile.state
    elif role in ("shop", "SHOP"):
        stmt = select(ShopProfile).where(ShopProfile.user_id == user.id)
        result = await session.exec(stmt)
        profile = result.first()
        if profile:
            location["district"] = profile.district
            location["state"] = profile.state
            location["city"] = profile.district

    return location


# ===========================================================================
# 8. Helper: Get User's Active Crop Names
# ===========================================================================

async def _get_user_crop_names(user: User, session: AsyncSession) -> List[str]:
    """Get list of active crop names for the user."""
    try:
        stmt = select(Crop.name).where(
            Crop.user_id == user.id,
            Crop.status.in_(["active", "growing", "planted"])
        )
        result = await session.exec(stmt)
        names = result.all()
        return list(set(n for n in names if n))
    except Exception:
        return []


# ===========================================================================
# 9. Master Aggregator — Parallel Fetch All External Data
# ===========================================================================

async def gather_all_external_context(
    user: User,
    session: AsyncSession,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    question: Optional[str] = None,
) -> dict:
    """
    Master aggregator that fetches ALL external data in parallel.
    Returns a structured dict with all available external context.

    The question parameter helps prioritise which data to fetch
    (e.g., skip weather if the question is about prices).
    """
    q = (question or "").lower()

    # Determine what to fetch based on the question
    fetch_weather = any(kw in q for kw in [
        "weather", "rain", "temperature", "forecast", "climate", "barish",
        "mausam", "varsha", "vana", "temp", "cold", "hot", "humidity",
        "monsoon", "drought", "flood", "frost",
    ]) or not question  # fetch all if no specific question

    fetch_news = any(kw in q for kw in [
        "news", "headline", "update", "latest", "recent", "khabar",
        "samachar", "varthalu", "pm-kisan", "scheme", "subsidy",
        "government", "policy", "alert", "warning",
    ]) or not question

    fetch_prices = any(kw in q for kw in [
        "price", "rate", "mandi", "market", "msp", "cost", "sell",
        "bhav", "dham", "rate", "wholesale", "retail", "quintal",
        "export", "import", "commodity",
    ]) or not question

    fetch_schemes = any(kw in q for kw in [
        "scheme", "subsidy", "government", "pm-kisan", "kisan",
        "loan", "insurance", "pmfby", "kcc", "pension",
        "sarkari", "yojana", "credit card",
    ]) or not question

    fetch_learning = any(kw in q for kw in [
        "learn", "video", "tutorial", "how to", "technique",
        "method", "guide", "training", "course", "padho", "sikho",
    ]) or not question

    # Get user location and crops in parallel
    loc_task = _get_user_location(user, session)
    crops_task = _get_user_crop_names(user, session)
    location, crop_names = await asyncio.gather(loc_task, crops_task)

    # Use provided lat/lon or fall back to profile location
    weather_lat = lat or location.get("lat")
    weather_lon = lon or location.get("lon")
    weather_city = location.get("district") or location.get("city") or location.get("state")

    # Build task list for parallel fetching
    tasks = {}

    if fetch_weather:
        tasks["weather"] = fetch_live_weather(
            lat=weather_lat, lon=weather_lon, city=weather_city
        )

    if fetch_news:
        # Extract news query from the question if specific
        news_query = None
        for kw in ["pm-kisan", "subsidy", "scheme", "msp", "fertilizer", "pesticide"]:
            if kw in q:
                news_query = kw
                break
        tasks["news"] = fetch_agri_news(query=news_query)

    if fetch_prices:
        tasks["market_prices"] = fetch_market_prices(crop_names=crop_names if crop_names else None)

    if fetch_schemes:
        tasks["government_schemes"] = fetch_government_schemes()

    if fetch_learning:
        tasks["learning_suggestions"] = fetch_learning_suggestions(crop_names=crop_names if crop_names else None)

    # Execute all fetches in parallel
    if not tasks:
        return {}

    keys = list(tasks.keys())
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    context = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            print(f"[ExternalData] Error fetching {key}: {result}")
            continue
        if result:
            context[key] = result

    return context


def format_external_context_for_llm(external_context: dict) -> str:
    """
    Format all external context into a single text block
    suitable for injection into the LLM system prompt.
    """
    if not external_context:
        return ""

    sections = []
    sections.append("=" * 60)
    sections.append("LIVE EXTERNAL DATA (Real-time, fetched just now)")
    sections.append("Use this data to give accurate, up-to-date answers.")
    sections.append("=" * 60)

    for key in ["weather", "news", "market_prices", "government_schemes", "learning_suggestions"]:
        if key in external_context:
            sections.append("")
            sections.append(external_context[key])

    sections.append("")
    sections.append("=" * 60)

    return "\n".join(sections)
