# AgriChain Deployment Guide

## Architecture

- **Backend**: FastAPI (Python) → Deploy on **Railway**
- **Frontend**: Next.js 16 (React) → Deploy on **Vercel**
- **Database**: PostgreSQL → Provision on **Railway** (add-on)

---

## API Keys Used in This Project

| Service | Purpose | Get Key At |
|---------|---------|------------|
| **PostgreSQL** | Database | Provisioned automatically on Railway |
| **GROQ AI** | RAG Chatbot (LLM) | [console.groq.com](https://console.groq.com/) |
| **OpenWeatherMap** | Real-time weather data | [openweathermap.org/api](https://openweathermap.org/api) |
| **NewsAPI** | Agricultural news feed | [newsapi.org](https://newsapi.org/) |
| **OpenCage** | Geocoding / location | [opencagedata.com/api](https://opencagedata.com/api) |
| **Fast2SMS** | Phone OTP via SMS | [fast2sms.com](https://www.fast2sms.com/) |
| **Gmail SMTP** | Email OTP | Use Gmail App Password |
| **Razorpay** | Payment gateway (mock) | [razorpay.com](https://razorpay.com/) |

---

## Step 1: Deploy Backend on Railway

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app/) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your repository
4. Set the **Root Directory** to `backend`

### 1.2 Add PostgreSQL Database

1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway will automatically inject `DATABASE_URL` into your service

### 1.3 Configure Environment Variables

In your Railway backend service, go to **Settings → Variables** and add:

```env
# Database - Railway auto-provides DATABASE_URL, but we need asyncpg format
# Use the Railway-provided DATABASE_URL but replace postgres:// with postgresql+asyncpg://
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@HOST:PORT/railway

# Security
JWT_SECRET=<generate a strong random string>

# Frontend URL for CORS (add after Vercel deployment)
FRONTEND_URL=https://your-app.vercel.app

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password

# SMS
FAST2SMS_API_KEY=your_fast2sms_api_key

# AI & Data APIs
GROQ_API_KEY=your_groq_api_key
OPENCAGE_API_KEY=your_opencage_api_key
NEWS_API_KEY=your_news_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
```

> **Important**: For `DATABASE_URL`, Railway gives you a URL starting with `postgres://`. 
> You must change the prefix to `postgresql+asyncpg://` for our async driver.

### 1.4 Deploy

Railway will automatically detect the `Procfile` and `requirements.txt`, install dependencies, and start the server. The health check at `/health` confirms successful deployment.

**Your backend URL will be**: `https://your-backend-name.railway.app`

---

## Step 2: Deploy Frontend on Vercel

### 2.1 Import Project

1. Go to [vercel.com](https://vercel.com/) and sign in with GitHub
2. Click **"Add New" → "Project"**
3. Import your repository
4. Set **Root Directory** to `frontend`
5. Framework Preset will auto-detect **Next.js**

### 2.2 Configure Environment Variables

In Vercel project settings → **Environment Variables**, add:

```env
NEXT_PUBLIC_API_URL=https://your-backend-name.railway.app
```

### 2.3 Deploy

Click **Deploy**. Vercel will:
- Run `npm install`
- Run `next build`
- Deploy the production build

**Your frontend URL will be**: `https://your-app.vercel.app`

---

## Step 3: Connect Frontend ↔ Backend

After both are deployed:

1. **Update Railway backend** `FRONTEND_URL` environment variable with your Vercel URL:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
2. **Redeploy** the Railway backend for the CORS change to take effect

---

## Verification Checklist

After deployment, verify:

- [ ] Backend health check: `GET https://your-backend.railway.app/health` returns `{"status": "ok"}`
- [ ] Frontend loads at your Vercel URL
- [ ] Registration with email OTP works
- [ ] Login works for all roles (farmer, shop, manufacturer, customer)
- [ ] Weather data loads on farmer dashboard
- [ ] News feed displays articles
- [ ] RAG chatbot responds to queries

---

## Troubleshooting

### CORS Errors
Make sure `FRONTEND_URL` in Railway matches your exact Vercel domain (including `https://`).

### Database Connection Fails
Ensure `DATABASE_URL` uses `postgresql+asyncpg://` prefix, not `postgres://`.

### Build Fails on Vercel
Run `npm run build` locally first. The project is configured to pass TypeScript strict checks.

### API Keys Not Working
All external APIs (weather, news, geocoding) have mock fallbacks. The app will still work without API keys but will show mock data.

---

## Local Development

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` for the frontend, `http://localhost:8000/docs` for the API docs.
