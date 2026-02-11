from fastapi import APIRouter
import random
from typing import List, Dict, Any

router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/")
async def get_weather(lat: float = 0.0, lon: float = 0.0):
    """
    Returns mock weather data with forecast, alerts, and advice.
    """
    conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Stormy"]
    
    # Current Weather
    current_temp = round(random.uniform(20.0, 35.0), 1)
    current_condition = random.choice(conditions)
    
    # 7-Day Forecast
    forecast = []
    days = ["Today", "Tomorrow", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for i in range(7):
        forecast.append({
            "day": days[i],
            "temp": round(random.uniform(20.0, 35.0), 1),
            "condition": random.choice(conditions),
            "rain_prob": random.randint(0, 80)
        })

    # Alerts (Randomly generate 0-2 alerts)
    alerts = []
    if random.choice([True, False]):
        alerts.append({
            "type": "warning",
            "title": "Heavy Rain Alert",
            "message": "Heavy rainfall expected in next 24 hours. Delay irrigation."
        })
    if random.choice([True, False]) and current_temp > 32:
        alerts.append({
            "type": "caution",
            "title": "Heatwave Alert",
            "message": "High temperatures detected. Ensure crops are well-watered."
        })

    # Crop Advice (Rule-based mock)
    advice = []
    if "Rain" in current_condition or "Storm" in current_condition:
        advice.append("Avoid applying fertilizers today due to rain forecast.")
    elif current_temp > 30:
        advice.append("Monitor soil moisture levels daily.")
    else:
        advice.append(" favorable conditions for sowing vegetables.")

    return {
        "location": "Local Farm",
        "temperature": current_temp,
        "condition": current_condition,
        "humidity": random.randint(30, 80),
        "wind_speed": random.randint(5, 20),
        "rainfall_mm": random.randint(0, 15) if "Rain" in current_condition else 0,
        "forecast": forecast,
        "alerts": alerts,
        "advice": advice
    }
