import os
import httpx
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

router = APIRouter(prefix="/news", tags=["news"])

load_dotenv()
NEWS_API_BASE = "https://newsapi.org/v2/everything"

# Agricultural keywords for search
AGRI_KEYWORDS = (
    "agriculture OR farming OR crop OR farmer OR mandi OR agri OR harvest "
    "OR fertilizer OR irrigation OR kisan OR agricultural OR pesticide "
    "OR horticulture OR dairy farming OR organic farming OR agribusiness"
)

GEO_POLITICS_EXCLUDE = (
    "war OR wars OR military OR missile OR attack OR conflict OR security OR terrorism "
    "OR ukraine OR russia OR israel OR gaza OR hamas OR iran OR china OR taiwan "
    "OR nato OR border dispute OR geopolitical OR geopolitics"
)


def _is_agri_relevant(title: str, description: str, source: str) -> bool:
    text = f"{title} {description} {source}".lower()

    strong = [
        "agriculture", "agricultural", "farming", "farmer", "farmers",
        "crop", "crops", "mandi", "msp", "minimum support", "kisan", "pm-kisan",
        "irrigation", "pesticide", "fertilizer", "seed", "seeds",
        "harvest", "horticulture", "agribusiness", "soil", "monsoon",
        "paddy", "rice", "wheat", "cotton", "maize", "sugarcane",
        "pulse", "pulses", "oilseed", "dairy",
    ]

    core = [
        "crop", "crops", "mandi", "msp", "minimum support", "irrigation",
        "pesticide", "fertilizer", "seed", "seeds", "harvest",
        "paddy", "rice", "wheat", "cotton", "maize", "sugarcane",
        "horticulture", "oilseed", "pulses",
    ]

    weak = [
        "milk", "rainfall", "weather",
    ]

    exclude = [
        "football", "cricket", "match", "league", "premier", "transfer",
        "coach", "team", "tournament",
        "celebrity", "movie", "film", "music", "actor",
        "ui trend", "user interface", "design trend", "blogging platform",
        "school protest", "protests", "election", "parliament",
        "oil price", "oil prices", "shipping", "strait", "hormuz", "cargo",
        "garden", "lawn", "weeds", "cultivate her garden",
        "war", "wars", "military", "missile", "attack", "conflict", "security", "terror",
        "ukraine", "russia", "israel", "gaza", "hamas", "iran", "china", "taiwan",
        "geopolitical", "geopolitics", "nato", "border dispute",
    ]

    if any(x in text for x in exclude):
        return False

    core_hits = sum(1 for x in core if x in text)
    if core_hits >= 1:
        return True

    strong_hits = sum(1 for x in strong if x in text)
    if strong_hits >= 2:
        return True

    weak_hits = sum(1 for x in weak if x in text)
    return weak_hits >= 2


def _categorize_article(title: str, description: str) -> str:
    """Auto-categorize an article based on keywords in title/description."""
    text = f"{title} {description}".lower()

    scheme_keywords = ["scheme", "subsidy", "kisan", "pm-kisan", "policy", "government",
                        "budget", "relief", "loan", "waiver", "msp", "minimum support"]
    market_keywords = ["price", "market", "mandi", "export", "import", "trade",
                        "commodity", "stock", "wholesale", "retail", "demand", "supply"]
    alert_keywords = ["pest", "disease", "flood", "drought", "warning", "alert",
                       "cyclone", "locust", "damage", "loss", "crisis", "shortage"]

    for kw in alert_keywords:
        if kw in text:
            return "alert"
    for kw in scheme_keywords:
        if kw in text:
            return "scheme"
    for kw in market_keywords:
        if kw in text:
            return "market"
    return "tip"


async def _fetch_news_api(*, api_key: str, query: Optional[str] = None, lang: str = "en") -> list | None:
    """Fetch real agricultural news from NewsAPI (past 15 days)."""
    # Tighten query to reduce unrelated results; still allow user-provided q.
    search_query = f"({query}) AND ({AGRI_KEYWORDS})" if query else AGRI_KEYWORDS
    search_query = f"({search_query}) AND NOT ({GEO_POLITICS_EXCLUDE})"
    from_date = (datetime.now() - timedelta(days=15)).strftime("%Y-%m-%d")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(NEWS_API_BASE, params={
                "q": search_query,
                "from": from_date,
                "sortBy": "publishedAt",
                "language": lang,
                "pageSize": 30,
                "apiKey": api_key,
            })
            data = resp.json()

            if data.get("status") != "ok":
                print(f"NewsAPI error: {data.get('message', 'Unknown error')}")
                return None

            articles = []
            for idx, article in enumerate(data.get("articles", []), start=1):
                title = article.get("title") or ""
                description = article.get("description") or ""
                source_name = article.get("source", {}).get("name", "Unknown")

                # Skip removed/empty articles
                if not title or title == "[Removed]":
                    continue

                # Filter to agriculture-only
                if not _is_agri_relevant(title, description, source_name):
                    continue

                published_at = article.get("publishedAt", "")
                try:
                    date_str = datetime.fromisoformat(
                        published_at.replace("Z", "+00:00")
                    ).strftime("%Y-%m-%d")
                except Exception:
                    date_str = datetime.now().strftime("%Y-%m-%d")

                articles.append({
                    "id": idx,
                    "category": _categorize_article(title, description),
                    "title": title,
                    "summary": description,
                    "source": source_name,
                    "verified": False,
                    "date": date_str,
                    "url": article.get("url", ""),
                    "image_url": article.get("urlToImage", ""),
                })

            return articles

    except Exception as e:
        print(f"NewsAPI fetch error: {e}")
        return None


def _get_mock_news() -> list:
    """Returns mock news when NEWS_API_KEY is not set."""
    return [
        {
            "id": 1,
            "category": "scheme",
            "title": "PM-KISAN Update",
            "summary": "16th installment released. Check status on portal.",
            "source": "Govt of India",
            "verified": True,
            "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
            "url": "https://pmkisan.gov.in/",
            "image_url": "",
        },
        {
            "id": 2,
            "category": "tip",
            "title": "Pest Alert: Stem Borer",
            "summary": "Incidence of Stem Borer observed in paddy. Apply recommended pesticide if threshold crossed.",
            "source": "Agri Dept",
            "verified": True,
            "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
            "url": "https://farmer.gov.in/",
            "image_url": "",
        },
        {
            "id": 3,
            "category": "market",
            "title": "Wheat Exports Open",
            "summary": "Government eases restrictions on wheat exports. Prices expected to rise.",
            "source": "Economic Times",
            "verified": False,
            "date": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
            "url": "https://economictimes.indiatimes.com/news/economy/agriculture",
            "image_url": "",
        },
        {
            "id": 4,
            "category": "scheme",
            "title": "Drip Irrigation Subsidy",
            "summary": f"Apply before {(datetime.now() + timedelta(days=30)).strftime('%B %d')} to avail 45% subsidy on new drip irrigation systems.",
            "source": "State Agri Dept",
            "verified": True,
            "date": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
            "url": "https://agricoop.nic.in/",
            "image_url": "",
        },
        {
            "id": 5,
            "category": "alert",
            "title": "Fake Seeds Warning",
            "summary": "Reports of fake cotton seeds in the district. Buy only from certified dealers.",
            "source": "District Collector",
            "verified": True,
            "date": (datetime.now() - timedelta(days=0)).strftime("%Y-%m-%d"),
            "url": "https://seednet.gov.in/",
            "image_url": "",
        },
    ]


@router.get("/")
async def get_news(
    q: Optional[str] = Query(None, description="Optional search query to refine results"),
    lang: str = Query("en", description="Language code (en, hi, etc.)")
):
    """
    Returns agricultural news from the past 15 days.
    Uses NewsAPI when API key is configured, otherwise returns mock data.
    Only agriculture-related news is fetched.
    """
    api_key = os.getenv("NEWS_API_KEY", "")
    if api_key:
        result = await _fetch_news_api(api_key=api_key, query=q, lang=lang)
        if result is not None:
            return result

    return _get_mock_news()
