
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
import os
import asyncio
from .database import init_db
from fastapi.staticfiles import StaticFiles
from .routers import auth, crops, products, orders, traceability, farmer, upload, analytics, manufacturer, customer, profile_routers, payments, shop_accounting, rag

app = FastAPI(title="AgriFlow API")

# Ensure uploads directory exists (required for Railway/production)
os.makedirs("uploads", exist_ok=True)

# Mount static files directory
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "")
cors_allow_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
cors_allow_origins_regex = os.getenv("CORS_ALLOW_ORIGINS_REGEX", "")
cors_allow_credentials_env = os.getenv("CORS_ALLOW_CREDENTIALS", "true")

allow_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")

if frontend_url:
    for origin in frontend_url.split(","):
        origin = _normalize_origin(origin)
        if origin:
            allow_origins.append(origin)

if cors_allow_origins:
    if cors_allow_origins.strip() == "*":
        allow_origins = ["*"]
    else:
        for origin in cors_allow_origins.split(","):
            origin = _normalize_origin(origin)
            if origin:
                allow_origins.append(origin)

allow_credentials = cors_allow_credentials_env.strip().lower() in {"1", "true", "yes"}
if allow_origins == ["*"]:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=cors_allow_origins_regex or None,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    safe_errors = []
    for err in exc.errors():
        safe_err = dict(err)
        if "input" in safe_err and isinstance(safe_err["input"], bytes):
            safe_err["input"] = safe_err["input"].decode("utf-8", "ignore")
        safe_errors.append(safe_err)
        
    print(f"\n[422 ERROR] {safe_errors}")
    return JSONResponse(status_code=422, content={"detail": safe_errors})

@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    print(f"\nERROR: Server Error: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )

@app.on_event("startup")
async def on_startup():
    async def _init_db_safe():
        try:
            await init_db()
        except Exception as exc:
            print(f"[startup] init_db failed: {exc}")
            traceback.print_exc()

    asyncio.create_task(_init_db_safe())

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(auth.router)
app.include_router(crops.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(traceability.router)
app.include_router(farmer.router)
app.include_router(upload.router)
app.include_router(analytics.router)
app.include_router(manufacturer.router)
app.include_router(customer.router)
app.include_router(profile_routers.router)
app.include_router(payments.router)
app.include_router(shop_accounting.router)
app.include_router(rag.router)
from .routers import weather, market_prices, news, location
app.include_router(weather.router)
app.include_router(market_prices.router)
app.include_router(news.router)
app.include_router(location.router)

