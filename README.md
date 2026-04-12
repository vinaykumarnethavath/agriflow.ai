# AgriChain AI

AgriChain AI is a full-stack web application for agriculture supply-chain and farm operations. It provides role-based modules (farmer, manufacturer, customer/shop) for managing crops, products, orders, analytics, and AI-assisted workflows (RAG chatbot), with optional integrations for payments and external data sources (weather/market/news).

## Features

- **Role-based access for real users**
  - Separate experiences for farmer, fertiliser shop, mills, and customers.
- **Farm operations management**
  - Manage crop records, activities, and status updates during the season.
- **Product and order lifecycle**
  - Create products, place orders, and track order status changes.
- **Real-time style dashboards**
  - Analytics endpoints used to power dashboards for day-to-day decisions.
- **Shop accounting support**
  - Track expenses and basic shop accounting entries.
- **Payments (real-world checkout)**
  - Razorpay-based payments integration.
- **AI assistant (RAG chatbot)**
  - Ask questions and get guided help using application knowledge.
- **Live external insights**
  - Weather, market prices, and agriculture news endpoints for operational awareness.

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                           Users                              │
│  - Farmer                                                     │
│  - Fertiliser Shop                                            │
│  - Mills                                                      │
│  - Customers                                                  │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                        Frontend UI                           │
│        (Next.js + React + TypeScript + TailwindCSS)           │
│  - Role-based screens                                         │
│  - Dashboards / charts                                        │
│  - Forms (crop, product, order, accounting)                   │
│  - Chat UI (RAG assistant)                                    │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                       FastAPI Backend                         │
│              (backend/app/main.py + routers/)                 │
│  - REST APIs (auth, crops, products, orders, analytics,       │
│    shop_accounting, payments, rag, weather, market_prices,    │
│    news, etc.)                                                │
│  - Request/response handling + CORS + error handling          │
│  - Service orchestration (app/services/*)                     │
└──────────────────────────────────────────────────────────────┘
            ↓                          ↓                       ↓
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│     AI / RAG Layer     │   │       Payments        │   │   External Insights    │
│ (app/services/rag_*)   │   │      (Razorpay)       │   │ (Weather/Market/News)  │
│ - Groq LLM integration │   │ - Checkout + verify   │   │ - Live data endpoints  │
│ - DB-aware answers     │   │                       │   │                       │
└───────────────────────┘   └───────────────────────┘   └───────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                         Data Layer                           │
│        (SQLModel + SQLAlchemy Async + asyncpg driver)         │
│  - Models + sessions + transactions                           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                         PostgreSQL                            │
│  - Application tables (users, crops, products, orders, etc.)  │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend

- Next.js (`next`)
- React
- TypeScript
- TailwindCSS
- Axios
- Zod
- Radix UI primitives

### Backend

- FastAPI
- Uvicorn
- SQLModel
- SQLAlchemy (async)
- Alembic
- JWT/Auth libs: `python-jose`, `pyjwt`, `passlib`
- Async DB drivers: `aiosqlite`, `asyncpg`
- Integrations: Razorpay
- Env management: `python-dotenv`, `pydantic-settings`
- AI: Groq SDK

### Database

- PostgreSQL

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Future Scope

- **Real-time market + weather intelligence**
  - Continuous updates and alerts for price changes, rainfall forecasts, and extreme weather.
- **Multiple API integrations**
  - Connect more sources (government advisories, mandi prices by region, satellite/weather providers).
- **AI crop health detection**
  - Upload field images to detect diseases, nutrient deficiency, and pest risk.
- **AI recommendations**
  - Personalized crop planning, fertilizer/pesticide guidance, and irrigation scheduling.
- **Smart notifications for farmers and shops**
  - Real-time order/payment updates, reminders, and actionable farm alerts.
- **Predictive analytics**
  - Yield prediction, demand forecasting, and price trend prediction.
