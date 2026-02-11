from fastapi import APIRouter
import random

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/prices")
async def get_market_prices():
    """
    Returns mock market prices for common crops.
    """
    crops = [
        {"name": "Wheat", "base_price": 2200, "msp": 2125},
        {"name": "Rice", "base_price": 1950, "msp": 2040},
        {"name": "Maize", "base_price": 1600, "msp": 1962},
        {"name": "Cotton", "base_price": 6000, "msp": 6620},
        {"name": "Soybean", "base_price": 3800, "msp": 4600},
        {"name": "Mustard", "base_price": 5000, "msp": 5450},
    ]
    
    market_data = []
    for crop in crops:
        # Simulate price fluctuation
        current_price = crop["base_price"] + random.randint(-200, 300)
        change = random.randint(-50, 50)
        
        market_data.append({
            "crop_name": crop["name"],
            "market_price": current_price,
            "change": change,
            "trend": "up" if change > 0 else "down",
            "nearest_mandi": "Local Mandi",
            "msp": crop["msp"],
            "msp_comparison": "above" if current_price > crop["msp"] else "below"
        })
        
    return market_data
