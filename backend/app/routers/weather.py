import os
import httpx
from fastapi import APIRouter
from typing import List, Dict, Any
from datetime import datetime, timedelta
from dotenv import load_dotenv, find_dotenv

router = APIRouter(prefix="/weather", tags=["weather"])

def _get_openweather_api_key() -> str:
    dotenv_path = find_dotenv(usecwd=True)
    load_dotenv(dotenv_path=dotenv_path if dotenv_path else None, override=True)
    return os.getenv("OPENWEATHER_API_KEY", "")

def _get_day_name(offset: int) -> str:
    """Get day name based on offset from today."""
    if offset == 0:
        return "Today"
    if offset == 1:
        return "Tomorrow"
    return (datetime.now() + timedelta(days=offset)).strftime("%a")

async def _fetch_openweather(lat: float, lon: float, api_key: str) -> dict:
    """Fetch real weather from OpenWeatherMap API."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Current weather
            current_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}
            )
            if current_resp.status_code != 200:
                print(
                    f"OpenWeather current weather error: {current_resp.status_code} {current_resp.text[:300]}",
                    flush=True,
                )
                return None
            current_data = current_resp.json()
            
            # 5-day forecast (free tier)
            forecast_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}
            )
            if forecast_resp.status_code != 200:
                print(
                    f"OpenWeather forecast error: {forecast_resp.status_code} {forecast_resp.text[:300]}",
                    flush=True,
                )
                return None
            forecast_data = forecast_resp.json()
        
        # Parse current
        temp = current_data["main"]["temp"]
        condition = current_data["weather"][0]["main"]
        humidity = current_data["main"]["humidity"]
        wind_speed = round(current_data["wind"]["speed"] * 3.6, 1)  # m/s to km/h
        rain = current_data.get("rain", {}).get("1h", 0)
        location = current_data.get("name", "Your Location")
        
        # Parse forecast (take one reading per day)
        forecast = []
        seen_days = set()
        for entry in forecast_data.get("list", []):
            dt = datetime.fromtimestamp(entry["dt"])
            day_key = dt.strftime("%Y-%m-%d")
            if day_key not in seen_days and len(forecast) < 7:
                seen_days.add(day_key)
                offset = (dt.date() - datetime.now().date()).days
                forecast.append({
                    "day": _get_day_name(max(0, offset)),
                    "temp": round(entry["main"]["temp"], 1),
                    "condition": entry["weather"][0]["main"],
                    "rain_prob": int(entry.get("pop", 0) * 100)
                })
        
        # Generate alerts
        alerts = []
        if rain > 5 or any(f.get("rain_prob", 0) > 60 for f in forecast[:2]):
            alerts.append({
                "type": "warning",
                "title": "Heavy Rain Alert",
                "message": "Heavy rainfall expected. Consider delaying irrigation and fertilizer application."
            })
        if temp > 35:
            alerts.append({
                "type": "caution",
                "title": "Heatwave Alert",
                "message": f"Temperature is {temp}°C. Ensure crops are well-watered and consider shade nets."
            })
        if humidity < 30:
            alerts.append({
                "type": "caution",
                "title": "Low Humidity Warning",
                "message": "Very dry conditions. Monitor soil moisture and increase irrigation frequency."
            })
        
        # Generate farming advice
        advice = []
        if "Rain" in condition or "rain" in condition.lower():
            advice.append("Avoid applying fertilizers today due to rain — nutrients may wash away.")
        if temp > 30:
            advice.append("Water crops early morning or late evening to reduce evaporation.")
        if temp < 15:
            advice.append("Protect sensitive crops from cold. Consider mulching or row covers.")
        if humidity > 70:
            advice.append("High humidity increases fungal disease risk. Monitor crops for leaf spots.")
        if not advice:
            advice.append("Weather conditions are favorable for most farming activities today.")
        
        return {
            "location": location,
            "temperature": round(temp, 1),
            "condition": condition,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "rainfall_mm": round(rain, 1),
            "forecast": forecast,
            "alerts": alerts,
            "advice": advice
        }
    except Exception as e:
        print(f"OpenWeather API error: {e}")
        return None

def _get_realistic_mock(lat: float, lon: float) -> dict:
    """Return realistic static mock weather data (deterministic, not random)."""
    # Use lat/lon to seed consistent data
    import hashlib
    seed = int(hashlib.md5(f"{lat:.2f},{lon:.2f},{datetime.now().strftime('%Y-%m-%d')}".encode()).hexdigest()[:8], 16)
    
    # Deterministic but varying by day and location
    base_temp = 26.0 + (seed % 12)
    humidity = 45 + (seed % 35)
    wind = 5 + (seed % 15)
    
    conditions_list = ["Sunny", "Partly Cloudy", "Cloudy", "Sunny", "Partly Cloudy"]
    condition = conditions_list[seed % len(conditions_list)]
    
    forecast = []
    for i in range(7):
        day_seed = seed + i * 7
        forecast.append({
            "day": _get_day_name(i),
            "temp": round(base_temp + (day_seed % 8) - 3, 1),
            "condition": conditions_list[day_seed % len(conditions_list)],
            "rain_prob": (day_seed % 6) * 10
        })
    
    alerts = []
    if base_temp > 34:
        alerts.append({
            "type": "caution",
            "title": "High Temperature Advisory",
            "message": "Temperatures are elevated. Ensure adequate irrigation for crops."
        })
    
    advice = ["Weather conditions are favorable for farming activities today."]
    if base_temp > 30:
        advice.append("Water crops early morning or late evening to reduce evaporation.")
    
    return {
        "location": "Local Farm",
        "temperature": round(base_temp, 1),
        "condition": condition,
        "humidity": humidity,
        "wind_speed": wind,
        "rainfall_mm": 0,
        "forecast": forecast,
        "alerts": alerts,
        "advice": advice
    }

@router.get("/")
async def get_weather(lat: float = 17.385, lon: float = 78.4867):
    """
    Returns weather data. Uses OpenWeatherMap API if key is set,
    otherwise returns realistic deterministic mock data.
    Default coordinates: Hyderabad, India.
    """
    api_key = _get_openweather_api_key()
    if api_key:
        result = await _fetch_openweather(lat, lon, api_key)
        if result:
            result["source"] = "openweather"
            return result
    else:
        print(
            "OPENWEATHER_API_KEY not set (or not loaded). Returning mock weather.",
            flush=True,
        )
    
    mock = _get_realistic_mock(lat, lon)
    mock["source"] = "mock"
    return mock
