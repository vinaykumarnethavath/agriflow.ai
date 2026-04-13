from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models import GeocodeCache


def _norm_part(v: Optional[str]) -> str:
    return (v or "").strip()


def build_address_query_text(*, house_no: Optional[str] = None, street: Optional[str] = None, village: Optional[str] = None, mandal: Optional[str] = None, district: Optional[str] = None, state: Optional[str] = None, pincode: Optional[str] = None, country: str = "India") -> str:
    # For geocoding accuracy, prefer administrative + locality fields first.
    # House/street often reduce match quality for rural locations.
    parts = [village, mandal, district, state, pincode, country, house_no, street]
    return ", ".join([_norm_part(p) for p in parts if _norm_part(p)])


def build_address_key(*, house_no: Optional[str] = None, street: Optional[str] = None, village: Optional[str] = None, mandal: Optional[str] = None, district: Optional[str] = None, state: Optional[str] = None, pincode: Optional[str] = None, country: str = "India") -> str:
    # Stable key: lowercased, normalized whitespace.
    q = build_address_query_text(
        house_no=house_no,
        street=street,
        village=village,
        mandal=mandal,
        district=district,
        state=state,
        pincode=pincode,
        country=country,
    )
    return " ".join(q.lower().split())


async def geocode_cached(*, session: AsyncSession, query_text: str, address_key: str, ttl_days: int = 30, force_refresh: bool = False) -> Optional[dict[str, Any]]:
    if not query_text:
        return None

    ttl = timedelta(days=ttl_days)
    now = datetime.utcnow()

    existing = (await session.exec(select(GeocodeCache).where(GeocodeCache.address_key == address_key))).first()

    query_tokens = [t.strip() for t in (query_text or "").split(",") if t.strip()]
    query_village_token = query_tokens[0] if query_tokens else ""

    if existing and not force_refresh and (now - existing.updated_at) <= ttl:
        try:
            components = json.loads(existing.components_json or "{}")
        except Exception:
            components = {}

        cached_village = (components or {}).get("village")
        # If the cached entry was created via display fallback (semantic-only village), refresh.
        provider_hint = (existing.provider or "").lower()
        semantic_only = ("display_fallback" in provider_hint) or ("alt_admin" in provider_hint)

        # If the query includes a village token but cached result is still broad, refresh immediately.
        should_refresh = semantic_only or (bool(query_village_token) and not (cached_village or "").strip())
        if not should_refresh:
            return {
                "formatted_address": existing.formatted_address or query_text,
                "components": components,
                "lat": existing.lat,
                "lng": existing.lng,
                "confidence": existing.confidence,
                "source": f"cache:{existing.provider}",
            }

    # Lazy import to avoid circular import (location router imports this service).
    from ..routers.location import _get_opencage_api_key, _haversine, _bounds_from_radius_km, _nominatim_forward, _opencage_forward

    api_key = _get_opencage_api_key()
    if not api_key:
        return None

    # If query includes pincode, first geocode pincode to get a proximity bias.
    proximity = None
    digits = "".join([c for c in query_text if c.isdigit()])
    pincode_hint = digits[:6] if len(digits) >= 6 else ""
    bounds = None
    if pincode_hint:
        pin_res = await _opencage_forward(api_key=api_key, query=f"{pincode_hint}, India", country="IN")
        if pin_res and pin_res.get("lat") is not None and pin_res.get("lng") is not None:
            proximity = (float(pin_res["lat"]), float(pin_res["lng"]))
            bounds = _bounds_from_radius_km(proximity[0], proximity[1], 25.0)

    fresh = await _opencage_forward(api_key=api_key, query=query_text, country="IN", proximity=proximity, bounds=bounds, bounded=True if bounds else False)
    if not fresh:
        return None

    # If OpenCage resolves only to a larger admin area, retry with a stricter village-focused query.
    comp = (fresh.get("components") or {})
    if query_village_token and not (comp.get("village") or "").strip():
        digits = "".join([c for c in query_text if c.isdigit()])
        pincode2 = digits[:6] if len(digits) >= 6 else ""

        rest = ", ".join(query_tokens[1:])
        strict_q = f"{query_village_token} village, {rest}" if rest else f"{query_village_token} village"
        if pincode2 and pincode2 not in strict_q:
            strict_q = f"{strict_q}, {pincode2}"

        strict = await _opencage_forward(api_key=api_key, query=strict_q, country="IN", proximity=proximity, bounds=bounds, bounded=True if bounds else False)
        if strict:
            strict_comp = (strict.get("components") or {})
            if (strict_comp.get("village") or "").strip() or (pincode2 and (strict_comp.get("postcode") or "").strip() == pincode2):
                fresh = strict

    # If still broad, try Nominatim as a fallback (often better for small villages).
    comp_after = (fresh.get("components") or {})
    if query_village_token and not (comp_after.get("village") or "").strip():
        nom = await _nominatim_forward(query=query_text, country="IN")
        if nom and (nom.get("components") or {}).get("village"):
            fresh = nom

    # If village is still missing, try dropping the village token and geocoding the remaining
    # administrative query (often yields a mandal/tehsil centroid which is more accurate than district).
    comp_after2 = (fresh.get("components") or {})
    if query_village_token and not (comp_after2.get("village") or "").strip() and len(query_tokens) > 1:
        alt_query = ", ".join(query_tokens[1:])
        alt = await _opencage_forward(api_key=api_key, query=alt_query, country="IN", proximity=proximity, bounds=bounds, bounded=True if bounds else False)
        if alt and alt.get("lat") is not None and alt.get("lng") is not None:
            # Use better coords, but preserve the user's village token for UI semantics.
            alt_comp = (alt.get("components") or {})
            if not (alt_comp.get("village") or "").strip():
                alt_comp["village"] = query_village_token
                alt["components"] = alt_comp
            alt["formatted_address"] = alt.get("formatted_address") or alt_query
            alt["source"] = f"{alt.get('source') or 'opencage'}+alt_admin"
            fresh = alt

    # Display fallback: preserve the village token for semantics if geocoder didn't return one.
    comp_final = (fresh.get("components") or {})
    if query_village_token and not (comp_final.get("village") or "").strip():
        comp_final["village"] = query_village_token
        fresh["components"] = comp_final
        fresh["formatted_address"] = query_text
        fresh["source"] = f"{fresh.get('source') or 'opencage'}+display_fallback"

    try:
        comp_json = json.dumps(fresh.get("components") or {})
    except Exception:
        comp_json = "{}"

    if existing:
        existing.query_text = query_text
        existing.lat = float(fresh["lat"])
        existing.lng = float(fresh["lng"])
        existing.confidence = int(fresh.get("confidence") or 0)
        existing.formatted_address = str(fresh.get("formatted_address") or "")
        existing.components_json = comp_json
        existing.provider = str(fresh.get("source") or "opencage")
        existing.updated_at = now
        session.add(existing)
    else:
        row = GeocodeCache(
            address_key=address_key,
            query_text=query_text,
            lat=float(fresh["lat"]),
            lng=float(fresh["lng"]),
            confidence=int(fresh.get("confidence") or 0),
            formatted_address=str(fresh.get("formatted_address") or ""),
            components_json=comp_json,
            provider=str(fresh.get("source") or "opencage"),
            updated_at=now,
        )
        session.add(row)

    await session.commit()

    return {
        **fresh,
        "source": f"live:{fresh.get('source') or 'opencage'}",
    }
