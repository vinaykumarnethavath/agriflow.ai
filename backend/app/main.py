
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
from .database import init_db
from fastapi.staticfiles import StaticFiles
from .routers import auth, crops, products, orders, traceability, farmer, upload, analytics, manufacturer, customer, profile_routers, payments, shop_accounting

app = FastAPI(title="AgriChain API")

# Mount static files directory
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"\n[422 ERROR] {exc.errors()}")
    try:
        body = await request.body()
        print(f"[422 BODY] {body.decode()}")
    except:
        pass
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

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
    await init_db()

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
from .routers import weather, market_prices, news
app.include_router(weather.router)
app.include_router(market_prices.router)
app.include_router(news.router)

