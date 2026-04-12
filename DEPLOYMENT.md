# Deployment Guide

This guide covers deploying AgriChain AI to production using separate platforms for optimal performance.

## Overview

- **Frontend**: Vercel (optimized for Next.js)
- **Backend**: Railway or Render (supports FastAPI/Python)
- **Database**: PostgreSQL (Railway PostgreSQL or external)

## Separate Deployment (Recommended)

### 1. Backend Deployment (Railway or Render)

#### Option A: Railway

1. Create a new Railway account at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select this repository
4. Configure:
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (from `backend/.env.example`):
   - `DATABASE_URL`: Use Railway PostgreSQL or your own
   - `FRONTEND_URL`: Your Vercel frontend URL (add after frontend deployment)
   - `JWT_SECRET`: Generate a secure random string
   - Add other required variables (Razorpay, Groq, SMTP, etc.)
6. Deploy and note the backend URL (e.g., `https://agri-backend.railway.app`)

#### Option B: Render

1. Create account at [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add same environment variables as Railway
6. Deploy and note the backend URL

### 2. Frontend Deployment (Vercel)

1. Create account at [vercel.com](https://vercel.com)
2. Click "Add New Project" → "Continue with GitHub"
3. Import this repository
4. Configure:
   - **Root directory**: `frontend`
   - **Framework preset**: Next.js
5. Add environment variable:
   - `NEXT_PUBLIC_API_URL`: Your backend URL from step 1
6. Click "Deploy"
7. Note the frontend URL (e.g., `https://agri-frontend.vercel.app`)

### 3. Update Backend CORS

After frontend deployment, update backend CORS:
1. Go to Railway/Render dashboard
2. Edit environment variables
3. Set `FRONTEND_URL` to your Vercel frontend URL
4. Redeploy backend

## Environment Variables

### Frontend (.env.local or Vercel env vars)
```
NEXT_PUBLIC_API_URL=http://localhost:8000  # Local development
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app  # Production
```

### Backend (.env or Railway/Render env vars)
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/agrichain
FRONTEND_URL=https://your-frontend-url.vercel.app
JWT_SECRET=your-secret-key-here
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
GROQ_API_KEY=your_groq_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Local Development

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly in backend environment variables
- Check that the frontend URL matches exactly (including https://)
- Redeploy backend after changing CORS settings

### Database Connection Issues
- Verify `DATABASE_URL` format is correct
- Ensure PostgreSQL is accessible from the deployment platform
- Check firewall/network settings

### Build Failures
- Ensure all dependencies are in `requirements.txt`
- Check build logs for specific errors
- Verify Python version compatibility

## Alternative: Single Platform Deployment

If you prefer deploying everything on one platform:

### Render (Full Stack)
1. Deploy backend as a Web Service
2. Deploy frontend as a Static Site
3. Use Render's internal networking for connection

### Railway (Full Stack)
1. Deploy backend as a Service
2. Deploy frontend as a Service
3. Use Railway's private networking for connection

Note: This approach may have slower build times compared to Vercel for Next.js.
