from fastapi import APIRouter
import random

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/prices")
async def get_market_prices(lang: str = "en"):
    """
    Returns mock market prices for common crops with multiple nearby markets.
    Translates crop names and mandi names if lang != 'en'.
    """
    crops = [
        {"name": "Wheat", "base_price": 2200, "msp": 2125},
        {"name": "Rice", "base_price": 1950, "msp": 2040},
        {"name": "Maize", "base_price": 1600, "msp": 1962},
        {"name": "Cotton", "base_price": 6000, "msp": 6620},
        {"name": "Soybean", "base_price": 3800, "msp": 4600},
        {"name": "Mustard", "base_price": 5000, "msp": 5450},
        {"name": "Sugarcane", "base_price": 3150, "msp": 3150},
        {"name": "Chilli", "base_price": 18000, "msp": 0},
        {"name": "Sweet Corn", "base_price": 2200, "msp": 0},
        {"name": "Mango", "base_price": 4500, "msp": 0},
    ]

    market_locations = [
        {"name": "Warangal Mandi", "distance_km": 12},
        {"name": "Hyderabad Market", "distance_km": 35},
        {"name": "Karimnagar Mandi", "distance_km": 22},
        {"name": "Nizamabad Market", "distance_km": 45},
        {"name": "Khammam Mandi", "distance_km": 30},
    ]
    
    market_data = []
    for crop in crops:
        # Primary market price
        primary_price = crop["base_price"] + random.randint(-200, 300)
        primary_change = random.randint(-50, 50)
        
        # Generate prices at multiple markets
        markets = []
        for loc in market_locations:
            loc_price = primary_price + random.randint(-100, 100)
            loc_change = random.randint(-30, 30)
            markets.append({
                "market_name": loc["name"],
                "distance_km": loc["distance_km"],
                "price": loc_price,
                "change": loc_change,
                "trend": "up" if loc_change > 0 else "down"
            })
        
        # Sort by nearest
        markets.sort(key=lambda m: m["distance_km"])
        
        market_data.append({
            "crop_name": crop["name"],
            "market_price": primary_price,
            "change": primary_change,
            "trend": "up" if primary_change > 0 else "down",
            "nearest_mandi": markets[0]["market_name"] if markets else "Local Mandi",
            "msp": crop["msp"],
            "msp_comparison": "above" if primary_price > crop["msp"] and crop["msp"] > 0 else ("below" if crop["msp"] > 0 else "n/a"),
            "markets": markets
        })
        
    if lang and lang != "en" and market_data:
        try:
            from .translate import translate_texts_batch
            crop_names = [item["crop_name"] for item in market_data]
            unique_mandi_names = list({loc["name"] for loc in market_locations})

            all_to_translate = crop_names + unique_mandi_names
            translated = await translate_texts_batch(all_to_translate, target_lang=lang)

            crop_translated = translated[:len(crop_names)]
            mandi_translated = translated[len(crop_names):]
            mandi_map = dict(zip(unique_mandi_names, mandi_translated))

            for idx, item in enumerate(market_data):
                if crop_translated[idx]:
                    item["crop_name"] = crop_translated[idx]
                if item["nearest_mandi"] in mandi_map:
                    item["nearest_mandi"] = mandi_map[item["nearest_mandi"]]
                for m in item["markets"]:
                    if m["market_name"] in mandi_map:
                        m["market_name"] = mandi_map[m["market_name"]]
        except Exception as e:
            print(f"[market_prices] Auto-translation error: {e}")

    return market_data

