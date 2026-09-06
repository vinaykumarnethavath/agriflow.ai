import os
import httpx
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

router = APIRouter(prefix="/news", tags=["news"])

load_dotenv()
NEWS_API_BASE = "https://newsapi.org/v2/everything"

# Agricultural keywords for search (tightened)
AGRI_KEYWORDS = (
    "agriculture OR farming OR agribusiness OR horticulture OR kisan OR mandi "
    "OR fertilizer OR pesticide OR irrigation OR \"minimum support price\" OR agritech"
)

GEO_POLITICS_EXCLUDE = (
    "war OR military OR missile OR attack OR conflict OR security OR terrorism "
    "OR ukraine OR russia OR israel OR gaza OR hamas OR iran OR china OR taiwan "
    "OR nato OR geopolitical OR geopolitics OR election OR sports OR movie OR bollywood"
)


def _is_agri_relevant(title: str, description: str, source: str) -> bool:
    text = f"{title} {description} {source}".lower()

    # Highly specific agriculture terms that rarely appear elsewhere
    unambiguous_agri = [
        "agriculture", "agricultural", "agribusiness", "farming", "farmer", "farmers",
        "agritech", "horticulture", "pesticide", "fertilizer", "irrigation",
        "mandi", "pm-kisan", "kisan", "minimum support price", "agro"
    ]
    
    # Common crop names that need context (must appear with an unambiguous term)
    crops_and_terms = [
        "crop", "crops", "harvest", "seed", "seeds", "sowing", "yield",
        "paddy", "rice", "wheat", "cotton", "maize", "sugarcane",
        "pulse", "pulses", "oilseed", "dairy", "poultry", "livestock", "tractor"
    ]
    
    exclude = [
        "football", "cricket", "match", "league", "premier", "transfer",
        "coach", "team", "tournament", "tennis", "basketball", "sports", "olympics",
        "celebrity", "movie", "film", "music", "actor", "actress", "hollywood", "bollywood",
        "ui trend", "user interface", "design", "tech crunch", "startup", "funding", "seed funding",
        "school protest", "protests", "election", "parliament", "political", "politics", "mla", "mp",
        "oil price", "oil prices", "shipping", "strait", "cargo", "logistics",
        "garden", "lawn", "weeds", "yard",
        "war", "military", "missile", "attack", "conflict", "security", "terror", "bomb",
        "ukraine", "russia", "israel", "gaza", "hamas", "iran", "china", "taiwan", "nato",
        "rice university", "state farm", "farmer's insurance", "farmers insurance",
        "stock market", "wall street", "sensex", "nifty", "nasdaq", "bse", "nse"
    ]

    if any(x in text for x in exclude):
        return False

    import re
    # Check for unambiguous terms with word boundaries to avoid matching subwords
    unambiguous_hits = sum(1 for x in unambiguous_agri if re.search(r'\b' + re.escape(x) + r'\b', text))
    
    # Check for secondary terms with word boundaries
    secondary_hits = sum(1 for x in crops_and_terms if re.search(r'\b' + re.escape(x) + r'\b', text))
    
    # Require at least one highly unambiguous term
    if unambiguous_hits >= 1:
        return True
        
    # Or require multiple secondary terms (e.g. "crop" AND "yield")
    if secondary_hits >= 2:
        return True
        
    return False


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
    # Tighten query to reduce unrelated results and focus on local Indian news.
    search_query = f"({query}) AND ({AGRI_KEYWORDS})" if query else AGRI_KEYWORDS
    search_query = f"({search_query}) AND (India OR Indian OR state OR local OR village) AND NOT ({GEO_POLITICS_EXCLUDE})"
    from_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(NEWS_API_BASE, params={
                "q": search_query,
                "from": from_date,
                "sortBy": "relevancy",
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
    Returns agricultural news from the past 5 days.
    Uses NewsAPI when API key is configured, otherwise returns mock data.
    Only agriculture-related news is fetched.
    Automatically translates article titles and summaries if lang != 'en'.
    """
    api_key = os.getenv("NEWS_API_KEY", "")
    articles = None
    if api_key:
        articles = await _fetch_news_api(api_key=api_key, query=q, lang=lang)
    
    if articles is None:
        articles = _get_mock_news()

    if lang and lang != "en" and articles:
        try:
            from .translate import translate_texts_batch
            titles = [a.get("title", "") for a in articles]
            summaries = [a.get("summary", "") for a in articles]
            
            all_texts = titles + summaries
            translated_all = await translate_texts_batch(all_texts, target_lang=lang)
            
            n = len(articles)
            translated_titles = translated_all[:n]
            translated_summaries = translated_all[n:]

            for idx, article in enumerate(articles):
                if translated_titles[idx]:
                    article["title"] = translated_titles[idx]
                if translated_summaries[idx]:
                    article["summary"] = translated_summaries[idx]
        except Exception as e:
            print(f"[news] Auto-translation error: {e}")

    return articles

