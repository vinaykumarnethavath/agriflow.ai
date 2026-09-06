"""
Translation API — AI-powered multilingual translation using Google Gemini API.

Uses Gemini 1.5 Flash for high-quality contextual translation across 8 Regional 
Indian Languages. Results are cached in-memory to minimize API calls.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os
import hashlib
import httpx
import google.generativeai as genai

router = APIRouter(prefix="/api/translate", tags=["translation"])

# ── Supported Languages ──────────────────────────────────────────────────────

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
}

# ── Request / Response Models ─────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    texts: list[str] = Field(..., max_length=50, description="List of texts to translate (max 50)")
    target_lang: str = Field(..., description="Target language code (hi, te, ta, kn, mr, bn, gu, pa)")
    source_lang: str = Field(default="en", description="Source language code")

class TranslateResponse(BaseModel):
    translations: list[str]
    target_lang: str
    cached: bool = False

# ── In-Memory Cache ───────────────────────────────────────────────────────────

_translation_cache: dict[str, str] = {}
MAX_CACHE_SIZE = 5000

def _cache_key(text: str, source: str, target: str) -> str:
    """Generate a deterministic cache key."""
    raw = f"{source}:{target}:{text}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()

def _get_cached(text: str, source: str, target: str) -> Optional[str]:
    key = _cache_key(text, source, target)
    return _translation_cache.get(key)

def _set_cached(text: str, source: str, target: str, translation: str):
    if len(_translation_cache) >= MAX_CACHE_SIZE:
        # Evict oldest 20% when cache is full
        evict_count = MAX_CACHE_SIZE // 5
        keys_to_evict = list(_translation_cache.keys())[:evict_count]
        for k in keys_to_evict:
            del _translation_cache[k]
    key = _cache_key(text, source, target)
    _translation_cache[key] = translation

# ── Gemini Translation Engine ──────────────────────────────────────────

async def _translate_single_gemini(text: str, source_lang: str, target_lang: str, api_key: str) -> str:
    """Translate a single text using Google Gemini 1.5 Flash."""
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    src_name = SUPPORTED_LANGUAGES.get(source_lang, "English")
    tgt_name = SUPPORTED_LANGUAGES.get(target_lang, "Hindi")
    
    prompt = f"Translate the following agricultural app text from {src_name} to {tgt_name}. Provide ONLY the raw translated text. Do not include markdown, quotes, or conversational filler. Text: {text}"
    
    try:
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[translate] Gemini API error: {e}")
        return text

async def _translate_batch_gemini(texts: list[str], source_lang: str, target_lang: str) -> list[str]:
    """Translate a batch of texts using Gemini API."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Translation service not configured (missing GEMINI_API_KEY)"
        )

    import asyncio
    semaphore = asyncio.Semaphore(5)

    async def translate_with_limit(text: str) -> str:
        async with semaphore:
            try:
                return await _translate_single_gemini(text, source_lang, target_lang, api_key)
            except Exception as e:
                print(f"[translate] Failed for '{text[:50]}...': {e}")
                return text

    tasks = [translate_with_limit(t) for t in texts]
    results = await asyncio.gather(*tasks)
    return list(results)


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.post("/", response_model=TranslateResponse)
async def translate_texts(req: TranslateRequest):
    """
    Translate a batch of texts to a target Indian language.
    Uses Google Gemini 1.5 Flash with in-memory caching.
    """
    # Validate target language
    if req.target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {req.target_lang}. Supported: {list(SUPPORTED_LANGUAGES.keys())}"
        )

    # If source == target, return as-is
    if req.source_lang == req.target_lang:
        return TranslateResponse(translations=req.texts, target_lang=req.target_lang, cached=True)

    # Validate text lengths
    for text in req.texts:
        if len(text) > 5000:
            raise HTTPException(status_code=400, detail=f"Text exceeds 5000 character limit: '{text[:50]}...'")

    # Check cache for each text
    results: list[Optional[str]] = []
    uncached_indices: list[int] = []
    uncached_texts: list[str] = []

    for i, text in enumerate(req.texts):
        cached = _get_cached(text, req.source_lang, req.target_lang)
        if cached is not None:
            results.append(cached)
        else:
            results.append(None)
            uncached_indices.append(i)
            uncached_texts.append(text)

    all_cached = len(uncached_texts) == 0

    # Translate uncached texts
    if uncached_texts:
        translations = await _translate_batch_gemini(uncached_texts, req.source_lang, req.target_lang)

        # Store in cache and fill results
        for idx, (orig, trans) in enumerate(zip(uncached_texts, translations)):
            _set_cached(orig, req.source_lang, req.target_lang, trans)
            results[uncached_indices[idx]] = trans

    return TranslateResponse(
        translations=[r or t for r, t in zip(results, req.texts)],
        target_lang=req.target_lang,
        cached=all_cached,
    )


@router.get("/languages")
async def get_supported_languages():
    """Return list of supported languages for the UI."""
    return {
        "languages": [
            {"code": code, "name": name, "native_name": native}
            for code, name, native in [
                ("en", "English", "English"),
                ("hi", "Hindi", "हिन्दी"),
                ("te", "Telugu", "తెలుగు"),
                ("ta", "Tamil", "தமிழ்"),
                ("kn", "Kannada", "ಕನ್ನಡ"),
                ("mr", "Marathi", "मराठी"),
                ("bn", "Bengali", "বাংলা"),
                ("gu", "Gujarati", "ગુજરાતી"),
                ("pa", "Punjabi", "ਪੰਜਾਬੀ"),
            ]
        ]
    }
