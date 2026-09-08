"""
Translation API — AI-powered multilingual translation engine.
==============================================================
High-speed batch translation across 8 Regional Indian Languages.
Uses Gemini (with 1-call batch JSON) and fails over to Groq on 429 / quota limits.
Results are cached in-memory.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os
import re
import json
import hashlib
import asyncio
import google.generativeai as genai
from groq import AsyncGroq

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
MAX_CACHE_SIZE = 10000

def _cache_key(text: str, source: str, target: str) -> str:
    """Generate a deterministic cache key."""
    raw = f"{source}:{target}:{text.strip()}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()

def _get_cached(text: str, source: str, target: str) -> Optional[str]:
    key = _cache_key(text, source, target)
    return _translation_cache.get(key)

def _set_cached(text: str, source: str, target: str, translation: str):
    # Only cache if valid and actually translated
    if not translation or (source != target and translation.strip().lower() == text.strip().lower()):
        return
    if len(_translation_cache) >= MAX_CACHE_SIZE:
        evict_count = MAX_CACHE_SIZE // 5
        keys_to_evict = list(_translation_cache.keys())[:evict_count]
        for k in keys_to_evict:
            del _translation_cache[k]
    key = _cache_key(text, source, target)
    _translation_cache[key] = translation


# ── AI Translation Engines ───────────────────────────────────────────────────

def _extract_json_list(raw: str) -> Optional[list]:
    """Helper to extract a JSON list from raw LLM output."""
    if not raw:
        return None
    cleaned = raw.strip()
    # Strip markdown code fence if present
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # Might be wrapped in {"translations": [...]}
            for val in data.values():
                if isinstance(val, list):
                    return val
    except Exception:
        pass

    # Regex search for [...]
    m = re.search(r'\[[\s\S]*\]', cleaned)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, list):
                return data
        except Exception:
            pass
    return None


async def _translate_batch_gemini(texts: list[str], source_lang: str, target_lang: str) -> Optional[list[str]]:
    """Translate a batch of texts in a single call using Gemini."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    genai.configure(api_key=api_key)
    # Available models: gemini-3.5-flash-lite, gemini-3.6-flash, gemini-2.5-flash-lite
    candidate_models = ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    
    src_name = SUPPORTED_LANGUAGES.get(source_lang, "English")
    tgt_name = SUPPORTED_LANGUAGES.get(target_lang, "Hindi")

    prompt = (
        f"You are a professional agricultural multilingual translator.\n"
        f"Translate the following list of {len(texts)} UI texts from {src_name} to {tgt_name}.\n"
        f"Keep numbers, percentages, brand names, and units intact.\n"
        f"You MUST return ONLY a JSON array containing exactly {len(texts)} translated strings in the exact same order.\n\n"
        f"Input JSON:\n{json.dumps(texts, ensure_ascii=False)}"
    )

    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(prompt)
            parsed = _extract_json_list(response.text)
            if parsed and len(parsed) == len(texts):
                return [str(x).strip() for x in parsed]
        except Exception as e:
            print(f"[translate] Gemini ({model_name}) error: {e}")
            continue

    return None


async def _translate_batch_groq(texts: list[str], source_lang: str, target_lang: str) -> Optional[list[str]]:
    """Translate a batch of texts in a single call using Groq (fast fallback)."""
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return None

    src_name = SUPPORTED_LANGUAGES.get(source_lang, "English")
    tgt_name = SUPPORTED_LANGUAGES.get(target_lang, "Hindi")

    client = AsyncGroq(api_key=groq_api_key)
    models = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]

    prompt = (
        f"You are a professional agricultural multilingual translator.\n"
        f"Translate the following list of {len(texts)} agricultural UI texts from {src_name} to {tgt_name}.\n"
        f"Keep numbers, percentages, brand names, and technical terms accurate.\n"
        f"Output MUST be a valid JSON object with key 'translations' containing a list of {len(texts)} translated strings in the exact same order.\n\n"
        f"Input JSON list:\n{json.dumps(texts, ensure_ascii=False)}"
    )

    for model in models:
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a professional translator. Respond only in valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(raw)
            trans_list = data.get("translations") if isinstance(data, dict) else data
            if isinstance(trans_list, list) and len(trans_list) == len(texts):
                return [str(x).strip() for x in trans_list]
        except Exception as e:
            print(f"[translate] Groq ({model}) error: {e}")
            continue

    return None


async def _execute_batch_translation(texts: list[str], source_lang: str, target_lang: str) -> list[str]:
    """
    Executes batch translation with automatic fallback:
    1. Try single-call Gemini
    2. Fallback to Groq
    3. If all fail, return original texts
    """
    if not texts or source_lang == target_lang:
        return texts

    # Try Gemini first
    translated = await _translate_batch_gemini(texts, source_lang, target_lang)
    if translated and len(translated) == len(texts):
        return translated

    # Fallback to Groq
    print("[translate] Falling back to Groq for batch translation...")
    translated = await _translate_batch_groq(texts, source_lang, target_lang)
    if translated and len(translated) == len(texts):
        return translated

    # If all AI providers fail, return originals
    print("[translate] Warning: All translation engines failed, returning originals.")
    return texts


# ── Public Helper Functions ──────────────────────────────────────────────────

async def translate_text(text: str, target_lang: str, source_lang: str = "en") -> str:
    """Translate a single string into target_lang, using cache where possible."""
    if not text or not text.strip() or target_lang == source_lang or target_lang not in SUPPORTED_LANGUAGES:
        return text

    cached = _get_cached(text, source_lang, target_lang)
    if cached:
        return cached

    results = await _execute_batch_translation([text], source_lang, target_lang)
    translated = results[0] if results else text
    if translated != text:
        _set_cached(text, source_lang, target_lang, translated)
    return translated


async def translate_texts_batch(texts: list[str], target_lang: str, source_lang: str = "en") -> list[str]:
    """Translate a list of strings into target_lang using cache + batch AI."""
    if not texts or target_lang == source_lang or target_lang not in SUPPORTED_LANGUAGES:
        return texts

    results: list[Optional[str]] = [None] * len(texts)
    uncached_indices: list[int] = []
    uncached_texts: list[str] = []

    for i, t in enumerate(texts):
        if not t or not t.strip():
            results[i] = t
            continue
        cached = _get_cached(t, source_lang, target_lang)
        if cached is not None:
            results[i] = cached
        else:
            uncached_indices.append(i)
            uncached_texts.append(t)

    if uncached_texts:
        translations = await _execute_batch_translation(uncached_texts, source_lang, target_lang)
        for idx, (orig, trans) in enumerate(zip(uncached_texts, translations)):
            if trans and trans != orig:
                _set_cached(orig, source_lang, target_lang, trans)
            results[uncached_indices[idx]] = trans

    return [r if r is not None else orig for r, orig in zip(results, texts)]


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.post("/", response_model=TranslateResponse)
@router.post("", response_model=TranslateResponse)
async def translate_texts_endpoint(req: TranslateRequest):
    """
    Translate a batch of texts to a target Indian language.
    Uses single-call batch JSON with Gemini & Groq fallback and in-memory caching.
    Supports both /api/translate and /api/translate/ to avoid 307 redirects.
    """
    if req.target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {req.target_lang}. Supported: {list(SUPPORTED_LANGUAGES.keys())}"
        )

    if req.source_lang == req.target_lang:
        return TranslateResponse(translations=req.texts, target_lang=req.target_lang, cached=True)

    # Validate text lengths
    for text in req.texts:
        if len(text) > 5000:
            raise HTTPException(status_code=400, detail=f"Text exceeds 5000 character limit: '{text[:50]}...'")

    translated = await translate_texts_batch(req.texts, req.target_lang, req.source_lang)
    
    # Check if all were served from cache
    all_cached = all(_get_cached(t, req.source_lang, req.target_lang) is not None for t in req.texts if t.strip())

    return TranslateResponse(
        translations=translated,
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
