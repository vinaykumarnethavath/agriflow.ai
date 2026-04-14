import os
import math
import httpx
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional, List, Any
from datetime import datetime
from dotenv import load_dotenv, find_dotenv
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from ..database import get_session
from ..deps import get_current_user
from ..models import User, UserRole, FarmerProfile, ShopProfile, MillProfile, Product
from ..services.geocode_cache_service import build_address_key, build_address_query_text, geocode_cached

router = APIRouter(prefix="/location", tags=["location"])

load_dotenv()
OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"


def _get_opencage_api_key() -> str:
    dotenv_path = find_dotenv(usecwd=True)
    load_dotenv(dotenv_path=dotenv_path if dotenv_path else None, override=True)
    return os.getenv("OPENCAGE_API_KEY", "")


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two lat/lng points using Haversine formula."""
    R = 6371  # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def _bounds_from_radius_km(lat: float, lon: float, radius_km: float) -> str:
    # Approx: 1 deg lat ~= 111 km; 1 deg lon ~= 111 km * cos(lat)
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))
    sw_lat = lat - lat_delta
    sw_lon = lon - lon_delta
    ne_lat = lat + lat_delta
    ne_lon = lon + lon_delta
    return f"{sw_lon},{sw_lat},{ne_lon},{ne_lat}"


def _extract_components(comp: dict) -> dict:
    # Prefer smaller admin units (hamlet/village/suburb) over city.
    village = (
        comp.get("hamlet")
        or comp.get("village")
        or comp.get("suburb")
        or comp.get("neighbourhood")
        or comp.get("town")
        or comp.get("city")
        or ""
    )
    district = comp.get("state_district") or comp.get("county") or ""
    return {
        "village": village,
        "district": district,
        "state": comp.get("state", ""),
        "country": comp.get("country", ""),
        "postcode": comp.get("postcode", ""),
    }


def _best_geocode_result(query: str, results: list[dict]) -> dict | None:
    # Score candidates by how well they match the query tokens (village/mandal/district/state/pincode).
    q = (query or "").lower()
    tokens = [t.strip().lower() for t in q.split(",") if t.strip()]
    pincode = ""
    for t in tokens:
        digits = "".join([c for c in t if c.isdigit()])
        if len(digits) == 6:
            pincode = digits
            break

    best = None
    best_score = -1
    for r in results:
        comp = r.get("components", {}) or {}
        c = _extract_components(comp)

        score = 0
        # Prefer results that are actually a village/hamlet (not just an administrative boundary centroid)
        r_type = (comp.get("_type") or "").strip().lower()
        if r_type in {"hamlet", "village"}:
            score += 20
        if r_type in {"city", "county", "state", "region", "administrative"}:
            score -= 10

        if (comp.get("hamlet") or comp.get("village")):
            score += 12
        if (comp.get("city") or comp.get("county") or comp.get("state_district")) and not (comp.get("hamlet") or comp.get("village")):
            score -= 5

        if pincode and (c.get("postcode") or "").strip() == pincode:
            score += 30
        if c.get("village") and c["village"].lower() in q:
            score += 15
        if c.get("district") and c["district"].lower() in q:
            score += 8
        if c.get("state") and c["state"].lower() in q:
            score += 5

        # Token containment boosts (helps with mandal names that map to county/state_district)
        haystack = " ".join([
            (c.get("village") or ""),
            (c.get("district") or ""),
            (c.get("state") or ""),
            (c.get("postcode") or ""),
            (r.get("formatted") or ""),
        ]).lower()
        for t in tokens:
            if t and t in haystack:
                score += 2

        conf = r.get("confidence")
        if isinstance(conf, (int, float)):
            score += float(conf) / 10.0

        if score > best_score:
            best_score = score
            best = r

    return best


def _extract_nominatim_components(addr: dict) -> dict:
    village = (
        addr.get("hamlet")
        or addr.get("village")
        or addr.get("suburb")
        or addr.get("neighbourhood")
        or addr.get("town")
        or addr.get("city")
        or ""
    )
    district = addr.get("state_district") or addr.get("county") or addr.get("district") or ""
    return {
        "village": village,
        "district": district,
        "state": addr.get("state", ""),
        "country": addr.get("country", ""),
        "postcode": addr.get("postcode", ""),
    }


def _best_nominatim_result(query: str, results: list[dict]) -> dict | None:
    q = (query or "").lower()
    tokens = [t.strip().lower() for t in q.split(",") if t.strip()]
    pincode = ""
    for t in tokens:
        digits = "".join([c for c in t if c.isdigit()])
        if len(digits) == 6:
            pincode = digits
            break

    best = None
    best_score = -1
    for r in results:
        addr = r.get("address") or {}
        c = _extract_nominatim_components(addr)
        score = 0

        # Prefer village/hamlet POIs over administrative boundaries.
        r_class = (r.get("class") or "").strip().lower()
        r_type = (r.get("type") or "").strip().lower()
        if r_class == "place" and r_type in {"hamlet", "village", "suburb", "neighbourhood"}:
            score += 20
        if r_class == "boundary" or r_type in {"administrative", "city", "county", "state"}:
            score -= 10

        if pincode and (c.get("postcode") or "").strip() == pincode:
            score += 30
        if c.get("village") and c["village"].lower() in q:
            score += 15
        if c.get("district") and c["district"].lower() in q:
            score += 8
        if c.get("state") and c["state"].lower() in q:
            score += 5

        haystack = " ".join([
            (c.get("village") or ""),
            (c.get("district") or ""),
            (c.get("state") or ""),
            (c.get("postcode") or ""),
            (r.get("display_name") or ""),
        ]).lower()
        for t in tokens:
            if t and t in haystack:
                score += 2

        try:
            imp = float(r.get("importance"))
            score += imp
        except Exception:
            pass

        if score > best_score:
            best_score = score
            best = r

    return best


def _overpass_query(*, lat: float, lon: float, radius_m: int, types: str) -> str:
    requested = [t.strip().lower() for t in types.split(",")] if types else []

    parts = []
    if not requested or "bank" in requested:
        parts.append(f"node(around:{radius_m},{lat},{lon})[amenity=bank];")
        parts.append(f"way(around:{radius_m},{lat},{lon})[amenity=bank];")

    if not requested or "market" in requested:
        parts.append(f"node(around:{radius_m},{lat},{lon})[amenity=marketplace];")
        parts.append(f"way(around:{radius_m},{lat},{lon})[amenity=marketplace];")

    if not requested or "government" in requested:
        parts.append(f"node(around:{radius_m},{lat},{lon})[office~\"government|administrative\"]; ")
        parts.append(f"way(around:{radius_m},{lat},{lon})[office~\"government|administrative\"]; ")

    if not requested or "shop" in requested:
        parts.append(f"node(around:{radius_m},{lat},{lon})[shop~\"fertilizer|farm|seed|pesticide\"]; ")
        parts.append(f"way(around:{radius_m},{lat},{lon})[shop~\"fertilizer|farm|seed|pesticide\"]; ")

    body = "".join(parts)
    return (
        "[out:json][timeout:25];"
        "("
        f"{body}"
        ");"
        "out center tags;"
    )


async def _overpass_nearby(*, lat: float, lon: float, types: str, radius_km: float) -> list | None:
    radius_m = max(1000, int(radius_km * 1000))
    query = _overpass_query(lat=lat, lon=lon, radius_m=radius_m, types=types)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(OVERPASS_URL, content=query, headers={"Content-Type": "text/plain"})
            data = resp.json()

        elements = data.get("elements", [])
        results = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("brand") or tags.get("operator") or "Unknown"

            el_lat = el.get("lat")
            el_lon = el.get("lon")
            if el_lat is None or el_lon is None:
                center = el.get("center") or {}
                el_lat = center.get("lat")
                el_lon = center.get("lon")
            if el_lat is None or el_lon is None:
                continue

            dist = _haversine(lat, lon, float(el_lat), float(el_lon))
            if dist > radius_km:
                continue

            place_type = "shop"
            if tags.get("amenity") == "bank":
                place_type = "bank"
            elif tags.get("amenity") == "marketplace":
                place_type = "market"
            elif tags.get("office"):
                place_type = "government"

            address_parts = [
                tags.get("addr:street"),
                tags.get("addr:suburb"),
                tags.get("addr:city"),
                tags.get("addr:postcode"),
            ]
            address = ", ".join([p for p in address_parts if p])

            results.append({
                "name": name,
                "type": place_type,
                "lat": float(el_lat),
                "lng": float(el_lon),
                "distance_km": dist,
                "address": address,
            })

        results.sort(key=lambda p: p["distance_km"])

        # Deduplicate by name + type
        seen = set()
        unique = []
        for r in results:
            key = (r["type"], (r.get("name") or "").lower().strip())
            if key in seen:
                continue
            seen.add(key)
            unique.append(r)
        return unique[:30]
    except Exception as e:
        print(f"Overpass nearby search error: {e}")
        return None


async def _nominatim_forward(*, query: str, country: str = "IN") -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NOMINATIM_BASE_URL}/search",
                params={
                    "q": query,
                    "format": "json",
                    "addressdetails": 1,
                    "limit": 10,
                    "countrycodes": country.lower(),
                },
                headers={"User-Agent": "agriflow.ai/1.0"},
            )
            if resp.status_code != 200:
                return None
            results = resp.json() or []
            if results:
                chosen = _best_nominatim_result(query, results) or results[0]
                addr = chosen.get("address") or {}
                return {
                    "formatted_address": chosen.get("display_name", ""),
                    "components": _extract_nominatim_components(addr),
                    "lat": float(chosen.get("lat")),
                    "lng": float(chosen.get("lon")),
                    "confidence": 0,
                    "source": "nominatim",
                }
    except Exception as e:
        print(f"Nominatim forward geocode error: {e}")
    return None


async def _nominatim_reverse(*, lat: float, lon: float) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NOMINATIM_BASE_URL}/reverse",
                params={
                    "lat": lat,
                    "lon": lon,
                    "format": "json",
                    "addressdetails": 1,
                },
                headers={"User-Agent": "agriflow.ai/1.0"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json() or {}
            addr = data.get("address") or {}
            if addr:
                return {
                    "formatted_address": data.get("display_name", ""),
                    "components": _extract_nominatim_components(addr),
                    "lat": lat,
                    "lng": lon,
                    "confidence": 0,
                }
    except Exception as e:
        print(f"Nominatim reverse geocode error: {e}")
    return None


# ────────────────────────────────────────────────────────────
# MOCK DATA (used when OPENCAGE_API_KEY is not set)
# ────────────────────────────────────────────────────────────

def _mock_reverse(lat: float, lon: float) -> dict:
    return {
        "formatted_address": "Warangal, Telangana, India",
        "components": {
            "village": "Warangal",
            "district": "Warangal",
            "state": "Telangana",
            "country": "India",
            "postcode": "506002",
        },
        "lat": lat,
        "lng": lon,
        "confidence": 0,
    }


def _mock_nearby(lat: float, lon: float, types: str) -> list:
    places = [
        {"name": "Warangal Agricultural Market Yard", "type": "market", "lat": lat + 0.01, "lng": lon + 0.012,
         "distance_km": 1.5, "address": "Market Yard Road, Warangal"},
        {"name": "Sri Lakshmi Fertilizer Shop", "type": "shop", "lat": lat + 0.005, "lng": lon - 0.008,
         "distance_km": 0.9, "address": "Main Bazaar, Warangal"},
        {"name": "Karimnagar Mandi", "type": "market", "lat": lat + 0.15, "lng": lon + 0.05,
         "distance_km": 18.2, "address": "Mandi Road, Karimnagar"},
        {"name": "Kisan Seeds & Pesticides", "type": "shop", "lat": lat - 0.003, "lng": lon + 0.004,
         "distance_km": 0.5, "address": "Station Road, Warangal"},
        {"name": "State Bank of India", "type": "bank", "lat": lat + 0.002, "lng": lon - 0.001,
         "distance_km": 0.3, "address": "Main Road, Warangal"},
        {"name": "Hyderabad Rythu Bazaar", "type": "market", "lat": lat - 0.8, "lng": lon + 0.3,
         "distance_km": 95.0, "address": "Erragadda, Hyderabad"},
        {"name": "District Agriculture Office", "type": "government", "lat": lat + 0.008, "lng": lon + 0.002,
         "distance_km": 1.0, "address": "Collector Office Rd, Warangal"},
        {"name": "Agri Input Center", "type": "shop", "lat": lat - 0.007, "lng": lon + 0.01,
         "distance_km": 1.2, "address": "Bypass Road, Warangal"},
    ]
    if types:
        type_list = [t.strip().lower() for t in types.split(",")]
        places = [p for p in places if p["type"] in type_list]
    places.sort(key=lambda p: p["distance_km"])
    return places


# ────────────────────────────────────────────────────────────
# REAL API CALLS
# ────────────────────────────────────────────────────────────

async def _opencage_forward(*, api_key: str, query: str, country: str = "IN", proximity: tuple[float, float] | None = None, bounds: str | None = None, bounded: bool = False) -> dict | None:
    """Forward geocode: address text -> coordinates."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            params = {
                "q": query,
                "key": api_key,
                "countrycode": country,
                "limit": 10,
                "no_dedupe": 1,
                "no_annotations": 0,
                "language": "en",
            }
            if proximity is not None:
                params["proximity"] = f"{proximity[0]},{proximity[1]}"
            if bounds is not None:
                params["bounds"] = bounds
            if bounded:
                params["bounded"] = 1

            resp = await client.get(OPENCAGE_BASE_URL, params=params)
            data = resp.json()
            results = data.get("results") or []
            if results:
                chosen = _best_geocode_result(query, results) or results[0]
                comp = chosen.get("components", {})
                return {
                    "formatted_address": chosen.get("formatted", ""),
                    "components": _extract_components(comp),
                    "lat": chosen["geometry"]["lat"],
                    "lng": chosen["geometry"]["lng"],
                    "confidence": chosen.get("confidence", 0),
                    "source": "opencage",
                }
    except Exception as e:
        print(f"OpenCage forward geocode error: {e}")
    return None


async def _opencage_reverse(*, api_key: str, lat: float, lon: float) -> dict | None:
    """Reverse geocode: coordinates -> address."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(OPENCAGE_BASE_URL, params={
                "q": f"{lat},{lon}",
                "key": api_key,
                "limit": 1,
                "no_annotations": 0,
            })
            data = resp.json()
            if data.get("results"):
                r = data["results"][0]
                comp = r.get("components", {})
                return {
                    "formatted_address": r.get("formatted", ""),
                    "components": _extract_components(comp),
                    "lat": lat,
                    "lng": lon,
                    "confidence": r.get("confidence", 0),
                }
    except Exception as e:
        print(f"OpenCage reverse geocode error: {e}")
    return None


async def _opencage_nearby(*, api_key: str, lat: float, lon: float, types: str, radius_km: float, locality: str = "") -> list | None:
    """Search for nearby places using OpenCage forward search with proximity bias."""
    type_queries = {
        "market": ["agricultural market", "mandi", "market yard", "rythu bazaar", "grain market"],
        "shop": [
            "fertilizer shop", "seed shop", "pesticide shop", "agro input shop",
            "krishi seva kendra", "fertiliser and pesticides", "agriculture shop",
        ],
        "bank": ["bank branch", "SBI branch", "ICICI bank", "HDFC bank", "bank of baroda"],
        "government": ["agriculture office", "krishi bhavan"],
    }

    requested_types = [t.strip().lower() for t in types.split(",")] if types else list(type_queries.keys())
    results = []
    bounds = _bounds_from_radius_km(lat, lon, radius_km)
    locality_hint = locality.strip()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for place_type in requested_types:
                queries = type_queries.get(place_type, [place_type])
                for query in queries[:4]:  # Limit queries per type
                    q = f"{query}, {locality_hint}" if locality_hint else query
                    resp = await client.get(OPENCAGE_BASE_URL, params={
                        "q": q,
                        "key": api_key,
                        "proximity": f"{lat},{lon}",
                        "bounds": bounds,
                        "bounded": 1,
                        "limit": 20,
                        "no_annotations": 1,
                        "countrycode": "IN",
                    })
                    data = resp.json()
                    for r in data.get("results", []):
                        r_lat = r["geometry"]["lat"]
                        r_lng = r["geometry"]["lng"]
                        dist = _haversine(lat, lon, r_lat, r_lng)
                        if dist <= radius_km:
                            results.append({
                                "name": r.get("formatted", "Unknown"),
                                "type": place_type,
                                "lat": r_lat,
                                "lng": r_lng,
                                "distance_km": dist,
                                "address": r.get("formatted", ""),
                            })
        # Deduplicate by name
        seen = set()
        unique = []
        for r in results:
            key = r["name"].lower().strip()
            if key not in seen:
                seen.add(key)
                unique.append(r)
        unique.sort(key=lambda p: p["distance_km"])
        return unique[:20]
    except Exception as e:
        print(f"OpenCage nearby search error: {e}")
    return None


# ────────────────────────────────────────────────────────────
# API ENDPOINTS
# ────────────────────────────────────────────────────────────

@router.get("/geocode")
async def geocode(
    q: str = Query(..., description="Address or place name to geocode"),
    country: str = Query("IN", description="Country code (ISO 3166-1 alpha-2)"),
    session: AsyncSession = Depends(get_session),
):
    """Forward geocoding: convert address/place name to lat/lng coordinates."""
    # Use cache via DB session. This reduces OpenCage calls and makes geocoding stable.
    key = " ".join((q or "").lower().split())
    cached = await geocode_cached(session=session, query_text=q, address_key=key)
    if cached:
        return cached

    # As a last resort, run direct OpenCage (no caching) to preserve old behavior.
    api_key = _get_opencage_api_key()
    if api_key:
        direct = await _opencage_forward(api_key=api_key, query=q, country=country)
        if direct:
            return direct
    raise HTTPException(status_code=502, detail="Geocoding failed")


@router.get("/reverse")
async def reverse_geocode(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude")
):
    """Reverse geocoding: convert coordinates to address details."""
    api_key = _get_opencage_api_key()
    if api_key:
        result = await _opencage_reverse(api_key=api_key, lat=lat, lon=lon)
        if result:
            return result

    nom = await _nominatim_reverse(lat=lat, lon=lon)
    if nom:
        return nom
    return _mock_reverse(lat, lon)


@router.get("/nearby")
async def nearby_places(
    lat: float = Query(..., description="User latitude"),
    lon: float = Query(..., description="User longitude"),
    types: str = Query("market,shop", description="Comma-separated place types: market, shop, bank, government"),
    radius_km: float = Query(50.0, description="Search radius in km"),
    locality: str = Query("", description="Optional locality hint (e.g., Rayaparthi, Thorrur) to improve results")
):
    """Find nearby agricultural shops, markets, banks around user location."""
    api_key = _get_opencage_api_key()
    if api_key:
        result = await _opencage_nearby(api_key=api_key, lat=lat, lon=lon, types=types, radius_km=radius_km, locality=locality)
        if result is not None:
            if locality:
                hint = locality.strip()
                if hint:
                    hinted = []
                    for p in result:
                        if hint.lower() in (p.get("name", "").lower() + " " + p.get("address", "").lower()):
                            hinted.append(p)
                    if hinted:
                        return hinted + [p for p in result if p not in hinted]
            return result

    overpass_result = await _overpass_nearby(lat=lat, lon=lon, types=types, radius_km=radius_km)
    if overpass_result is not None and len(overpass_result) > 0:
        return overpass_result
    return _mock_nearby(lat, lon, types)


@router.get("/distance")
async def calculate_distance(
    lat1: float = Query(..., description="Origin latitude"),
    lon1: float = Query(..., description="Origin longitude"),
    lat2: float = Query(..., description="Destination latitude"),
    lon2: float = Query(..., description="Destination longitude")
):
    """Calculate distance between two points using the Haversine formula."""
    dist = _haversine(lat1, lon1, lat2, lon2)
    return {
        "origin": {"lat": lat1, "lng": lon1},
        "destination": {"lat": lat2, "lng": lon2},
        "distance_km": dist,
        "distance_miles": round(dist * 0.621371, 2),
    }


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def _closeness_score(*, user_loc: dict, provider_loc: dict) -> int:
    score = 0
    if _norm(user_loc.get("state")) and _norm(user_loc.get("state")) == _norm(provider_loc.get("state")):
        score += 1
    if _norm(user_loc.get("district")) and _norm(user_loc.get("district")) == _norm(provider_loc.get("district")):
        score += 2
    if _norm(user_loc.get("mandal")) and _norm(user_loc.get("mandal")) == _norm(provider_loc.get("mandal")):
        score += 4
    if _norm(user_loc.get("village")) and _norm(user_loc.get("village")) == _norm(provider_loc.get("village")):
        score += 8
    if _norm(user_loc.get("pincode")) and _norm(user_loc.get("pincode")) == _norm(provider_loc.get("pincode")):
        score += 3
    return score


@router.get("/nearby/internal")
async def nearby_internal_providers(
    types: str = Query("shop,mill", description="Comma-separated provider types: shop,mill"),
    include_products: bool = Query(True, description="Include example products for shops (fertilizer/pesticide/seeds)"),
    limit: int = Query(30, ge=1, le=100),
    radius_km: float = Query(50.0, ge=1.0, le=200.0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return nearby providers from the internal database.

    Uses OpenCage geocoding (cached in DB) to compute distance from the current user's saved address
    and filters to `radius_km`. No lat/lng are stored in profiles.
    """
    requested = [t.strip().lower() for t in types.split(",") if t.strip()]
    if not requested:
        requested = ["shop", "mill"]

    user_loc: dict[str, Any] = {
        "village": None,
        "mandal": None,
        "district": None,
        "state": None,
        "pincode": None,
    }

    if current_user.role == UserRole.FARMER:
        fp = (await session.exec(select(FarmerProfile).where(FarmerProfile.user_id == current_user.id))).first()
        if not fp:
            return []
        user_loc = {
            "house_no": getattr(fp, "house_no", None),
            "street": getattr(fp, "street", None),
            "village": fp.village,
            "mandal": fp.mandal,
            "district": fp.district,
            "state": fp.state,
            "pincode": fp.pincode,
        }
    elif current_user.role == UserRole.SHOP:
        sp = (await session.exec(select(ShopProfile).where(ShopProfile.user_id == current_user.id))).first()
        if not sp:
            return []
        user_loc = {
            "house_no": getattr(sp, "house_no", None),
            "street": getattr(sp, "street", None),
            "village": sp.village,
            "mandal": sp.mandal,
            "district": sp.district,
            "state": sp.state,
            "pincode": sp.pincode,
        }
    elif current_user.role == UserRole.MANUFACTURER:
        mp = (await session.exec(select(MillProfile).where(MillProfile.user_id == current_user.id))).first()
        if not mp:
            return []
        user_loc = {
            "house_no": getattr(mp, "house_no", None),
            "street": getattr(mp, "street", None),
            "village": mp.village,
            "mandal": mp.mandal,
            "district": mp.district,
            "state": mp.state,
            "pincode": mp.pincode,
        }
    else:
        return []

    # Geocode current user from their stored address.
    user_query = build_address_query_text(
        house_no=user_loc.get("house_no"),
        street=user_loc.get("street"),
        village=user_loc.get("village"),
        mandal=user_loc.get("mandal"),
        district=user_loc.get("district"),
        state=user_loc.get("state"),
        pincode=user_loc.get("pincode"),
    )
    user_key = build_address_key(
        house_no=user_loc.get("house_no"),
        street=user_loc.get("street"),
        village=user_loc.get("village"),
        mandal=user_loc.get("mandal"),
        district=user_loc.get("district"),
        state=user_loc.get("state"),
        pincode=user_loc.get("pincode"),
    )
    user_geo = await geocode_cached(session=session, query_text=user_query, address_key=user_key)
    if not user_geo:
        return []

    u_lat = float(user_geo["lat"])
    u_lng = float(user_geo["lng"])

    providers: list[dict[str, Any]] = []

    if "shop" in requested:
        shops = (await session.exec(select(ShopProfile))).all()
        for s in shops:
            if s.user_id == current_user.id:
                continue
            provider_loc = {
                "village": s.village,
                "mandal": s.mandal,
                "district": s.district,
                "state": s.state,
                "pincode": s.pincode,
            }
            score = _closeness_score(user_loc=user_loc, provider_loc=provider_loc)

            q = build_address_query_text(
                house_no=getattr(s, "house_no", None),
                street=getattr(s, "street", None),
                village=getattr(s, "village", None),
                mandal=getattr(s, "mandal", None),
                district=getattr(s, "district", None),
                state=getattr(s, "state", None),
                pincode=getattr(s, "pincode", None),
            )
            k = build_address_key(
                house_no=getattr(s, "house_no", None),
                street=getattr(s, "street", None),
                village=getattr(s, "village", None),
                mandal=getattr(s, "mandal", None),
                district=getattr(s, "district", None),
                state=getattr(s, "state", None),
                pincode=getattr(s, "pincode", None),
            )
            geo = await geocode_cached(session=session, query_text=q, address_key=k)
            if not geo:
                continue
            dist = _haversine(u_lat, u_lng, float(geo["lat"]), float(geo["lng"]))
            if dist > radius_km:
                continue

            providers.append({
                "provider_type": "shop",
                "score": score,
                "distance_km": dist,
                "name": s.shop_name,
                "contact_number": s.contact_number,
                "village": s.village,
                "mandal": s.mandal,
                "district": s.district,
                "state": s.state,
                "pincode": s.pincode,
                "address": s.shop_address or ", ".join([p for p in [s.house_no, s.street, s.village, s.mandal, s.district, s.state, s.pincode] if p]),
                "user_id": s.user_id,
                "products": [],
            })

    if "mill" in requested or "manufacturer" in requested:
        mills = (await session.exec(select(MillProfile))).all()
        for m in mills:
            if m.user_id == current_user.id:
                continue
            provider_loc = {
                "village": m.village,
                "mandal": m.mandal,
                "district": m.district,
                "state": m.state,
                "pincode": m.pincode,
            }
            score = _closeness_score(user_loc=user_loc, provider_loc=provider_loc)

            q = build_address_query_text(
                house_no=getattr(m, "house_no", None),
                street=getattr(m, "street", None),
                village=getattr(m, "village", None),
                mandal=getattr(m, "mandal", None),
                district=getattr(m, "district", None),
                state=getattr(m, "state", None),
                pincode=getattr(m, "pincode", None),
            )
            k = build_address_key(
                house_no=getattr(m, "house_no", None),
                street=getattr(m, "street", None),
                village=getattr(m, "village", None),
                mandal=getattr(m, "mandal", None),
                district=getattr(m, "district", None),
                state=getattr(m, "state", None),
                pincode=getattr(m, "pincode", None),
            )
            geo = await geocode_cached(session=session, query_text=q, address_key=k)
            if not geo:
                continue
            dist = _haversine(u_lat, u_lng, float(geo["lat"]), float(geo["lng"]))
            if dist > radius_km:
                continue

            providers.append({
                "provider_type": "mill",
                "score": score,
                "distance_km": dist,
                "name": m.mill_name,
                "contact_number": m.contact_number,
                "village": m.village,
                "mandal": m.mandal,
                "district": m.district,
                "state": m.state,
                "pincode": m.pincode,
                "address": ", ".join([p for p in [m.house_no, m.street, m.village, m.mandal, m.district, m.state, m.pincode] if p]),
                "user_id": m.user_id,
            })

    # Only keep providers with at least same district/state if user has those fields.
    if _norm(user_loc.get("district")):
        providers = [p for p in providers if _norm(p.get("district")) == _norm(user_loc.get("district"))]
    elif _norm(user_loc.get("state")):
        providers = [p for p in providers if _norm(p.get("state")) == _norm(user_loc.get("state"))]

    providers.sort(key=lambda p: (p.get("distance_km") is None, p.get("distance_km") or 0, -p.get("score", 0)))
    providers = providers[:limit]

    if include_products:
        shop_ids = [p["user_id"] for p in providers if p.get("provider_type") == "shop"]
        if shop_ids:
            prod_rows = (await session.exec(
                select(Product).where(
                    Product.user_id.in_(shop_ids),
                    Product.category.in_(["fertilizer", "pesticide", "seeds"]),
                    Product.status == "active",
                )
            )).all()
            by_shop: dict[int, list[dict[str, Any]]] = {}
            for pr in prod_rows:
                by_shop.setdefault(pr.user_id, []).append({
                    "id": pr.id,
                    "name": pr.name,
                    "category": pr.category,
                    "price": pr.price,
                    "unit": pr.unit,
                    "quantity": pr.quantity,
                })
            for p in providers:
                if p.get("provider_type") == "shop":
                    p["products"] = (by_shop.get(p["user_id"], [])[:10])

    for p in providers:
        p.pop("score", None)
    return providers
