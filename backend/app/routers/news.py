from fastapi import APIRouter
import random
from datetime import datetime, timedelta

router = APIRouter(prefix="/news", tags=["news"])

@router.get("/")
async def get_news():
    """
    Returns mock news, schemes, and farming tips.
    """
    news_items = [
        {
            "id": 1,
            "category": "scheme",
            "title": "PM-KISAN Update",
            "summary": "16th installment released. Check status on portal.",
            "source": "Govt of India",
            "verified": True,
            "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        },
        {
            "id": 2,
            "category": "tip",
            "title": "Pest Alert: Stem Borer",
            "summary": "Incidence of Stem Borer observed in paddy. Apply recommended pesticide if threshold crossed.",
            "source": "Agri Dept",
            "verified": True,
            "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        },
        {
            "id": 3,
            "category": "market",
            "title": "Wheat Exports Open",
            "summary": "Government eases restrictions on wheat exports. Prices expected to rise.",
            "source": "Economic Times",
            "verified": False,
            "date": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        },
         {
            "id": 4,
            "category": "scheme",
            "title": "Drip Irrigation Subsidy",
            "summary": "Apply before March 31st to avail 45% subsidy on new drip irrigation systems.",
            "source": "State Agri Dept",
            "verified": True,
            "date": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        },
        {
            "id": 5,
            "category": "alert",
            "title": "Fake Seeds Warning",
            "summary": "Reports of fake cotton seeds in the district. Buy only from certified dealers.",
            "source": "District Collector",
            "verified": True,
            "date": (datetime.now() - timedelta(days=0)).strftime("%Y-%m-%d")
        }
    ]
    
    return news_items
