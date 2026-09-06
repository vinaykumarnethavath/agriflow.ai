# Complete API Keys Setup Guide for AgriFlow

This guide provides an exact, step-by-step walkthrough for obtaining **every API key** used in AgriFlow. Each section contains the official link, click-by-click instructions, and where to paste the key in your `.env` and deployment dashboard.

---

## Quick Reference Summary

| Service | Purpose | Env Variable | Cost / Free Tier |
|---|---|---|---|
| **Brevo** | Email OTP (Port 443 HTTPS - Railway/Render friendly) | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Free (300 emails/day, no custom domain required) |
| **Gmail SMTP** | Email OTP (Local direct SMTP) | `SMTP_USER`, `SMTP_PASSWORD` | Free (Personal Gmail + App Password) |
| **Resend** | Email OTP (Alternative HTTP API) | `RESEND_API_KEY`, `RESEND_FROM` | Free (3,000 emails/mo) |
| **Fast2SMS** | Phone OTP (SMS in India) | `FAST2SMS_API_KEY` | Free ₹50 test credit |
| **Groq AI** | Farmer Assistant & RAG Chatbot | `GROQ_API_KEY` | Free generous tier |
| **Gemini AI** | Dynamic Text Translation | `GEMINI_API_KEY` | Free generous tier |
| **OpenWeatherMap**| Live Weather & Forecasts | `OPENWEATHER_API_KEY` | Free (1,000 calls/day) |
| **NewsAPI** | Agricultural News Feed | `NEWS_API_KEY` | Free (100 requests/day) |
| **OpenCage** | Geocoding & Reverse Location | `OPENCAGE_API_KEY` | Free (2,500 requests/day) |
| **Razorpay** | Payment Gateway (Orders/Checkout) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Free Test Mode |
| **YouTube Data v3** | Farming Tutorial Videos | `YOUTUBE_API_KEY` | Free (10,000 units/day) |
| **Hugging Face** | Crop Disease AI Inference | `HUGGINGFACE_API_KEY` | Free Community Inference |
| **JWT Secret** | Auth Token Cryptography | `JWT_SECRET` | Free (Generated locally) |

---

## 1. Brevo (Sendinblue) — Email OTP (Recommended for Cloud)

> **Why Brevo?** Cloud hosts (Railway, Render, Fly.io) block outbound SMTP ports `465/587`. Brevo sends via HTTP API (Port 443) which is **never blocked**, requires no purchased domain, and allows sending to any email.

- **Official Website**: [https://www.brevo.com/](https://www.brevo.com/)
- **Direct SMTP & API Page**: [https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)

### Step-by-Step Instructions:
1. Go to [https://www.brevo.com/](https://www.brevo.com/) and click **Sign up free**.
2. Enter your email and create a password (or sign in with Google).
3. Check your email and click the confirmation link to activate your account.
4. Complete your basic profile details (Company: "AgriFlow", etc. — no credit card needed).
5. Once inside the dashboard, click your **Account Name** in the top right corner.
6. Select **SMTP & API** from the drop-down menu (or visit [https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)).
7. Select the **API Keys** tab and click **Generate a new API key**.
8. Set the name to `agriflow-otp` and click **Generate**.
9. Copy the generated key (starts with `xkeysib-...`).
10. **Authorize your sender email**:
    - On the left sidebar, click **Senders, Domains & Dedicated IPs** -> **Senders** (or visit [https://app.brevo.com/senders](https://app.brevo.com/senders)).
    - Click **Add a sender**.
    - Enter your name (`AgriFlow`) and your Gmail address (e.g., `your-email@gmail.com`).
    - Brevo sends a 6-digit code or link to your Gmail; verify it.
11. Paste into `backend/.env` and Railway Variables:
    ```env
    BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxx
    BREVO_SENDER_EMAIL=your-email@gmail.com
    ```

---

## 2. Gmail SMTP App Password — Email OTP (Localhost)

- **Official Page**: [https://myaccount.google.com/security](https://myaccount.google.com/security)
- **Direct App Passwords Page**: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### Step-by-Step Instructions:
1. Open [https://myaccount.google.com/](https://myaccount.google.com/) while logged into your Google Account.
2. In the left navigation menu, click **Security**.
3. Under "How you sign in to Google", confirm that **2-Step Verification** is turned **ON** (required by Google to generate App Passwords).
4. In the top search bar, type **App passwords** and click on it, or navigate to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
5. In the **App name** input, type `AgriFlow` and click **Create**.
6. A modal will appear showing a **16-character code** (e.g. `uzcg mgnx onrh fhgp`).
7. Copy the 16 characters without spaces.
8. Paste into `backend/.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your_16_char_app_password
   ```

---

## 3. Resend — Alternative Email API

- **Official Page**: [https://resend.com/](https://resend.com/)
- **Direct API Keys Page**: [https://resend.com/api-keys](https://resend.com/api-keys)

### Step-by-Step Instructions:
1. Navigate to [https://resend.com/](https://resend.com/) and click **Get Started** (or sign in with GitHub).
2. On the left sidebar navigation, click **API Keys**.
3. Click the **Create API Key** button.
4. Set Name to `AgriFlow`, Permission to **Full Access**, and click **Add**.
5. Copy the generated key starting with `re_...`.
6. Paste into `backend/.env` and Railway Variables:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   RESEND_FROM=AgriFlow <onboarding@resend.dev>
   ```
> **Note**: `onboarding@resend.dev` can only send emails to the email address registered to your Resend account. To send to any recipient on Resend, you must verify a custom domain under **Domains**.

---

## 4. Fast2SMS — Phone OTP via SMS

- **Official Website**: [https://www.fast2sms.com/](https://www.fast2sms.com/)
- **Direct Dev API Page**: [https://www.fast2sms.com/dashboard/dev-api](https://www.fast2sms.com/dashboard/dev-api)

### Step-by-Step Instructions:
1. Visit [https://www.fast2sms.com/](https://www.fast2sms.com/) and click **Register**.
2. Enter your Name, Mobile Number, and Email.
3. Verify your mobile number using the SMS OTP.
4. After logging in, look at the left sidebar and click **Dev API** (or visit [https://www.fast2sms.com/dashboard/dev-api](https://www.fast2sms.com/dashboard/dev-api)).
5. Under **Authorization**, you will find your API key string.
6. Click the copy icon next to the key.
7. Paste into `backend/.env` and Railway Variables:
   ```env
   FAST2SMS_API_KEY=your_fast2sms_authorization_key
   ```

---

## 5. Groq Cloud — AI Chatbot & RAG LLM

- **Official Page**: [https://console.groq.com/](https://console.groq.com/)
- **Direct API Keys Page**: [https://console.groq.com/keys](https://console.groq.com/keys)

### Step-by-Step Instructions:
1. Go to [https://console.groq.com/](https://console.groq.com/) and sign in with GitHub or Google.
2. In the left navigation menu, click **API Keys**.
3. Click the **Create API Key** button.
4. Enter an optional name like `AgriFlow-AI`.
5. Click **Submit**.
6. Immediately copy the key starting with `gsk_...` (Groq only displays this once).
7. Paste into `backend/.env` and Railway Variables:
   ```env
   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## 5B. Google Gemini API — Translation Engine

- **Official Page**: [https://aistudio.google.com/](https://aistudio.google.com/)
- **Direct API Keys Page**: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### Step-by-Step Instructions:
1. Go to [https://aistudio.google.com/](https://aistudio.google.com/) and sign in with your Google account.
2. In the left navigation menu, click **Get API key**.
3. Click the **Create API Key** button.
4. Select a Google Cloud project from the dropdown (or select "Create API key in a new project" if you don't have one).
5. Click **Create API key in new project**.
6. Once generated, click the copy icon next to your new key.
7. Paste into `backend/.env` and Railway Variables:
   ```env
   GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## 6. OpenWeatherMap — Real-Time Weather

- **Official Sign-Up Page**: [https://home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up)
- **Direct API Keys Page**: [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)

### Step-by-Step Instructions:
1. Go to [https://home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up).
2. Enter Username, Email, and Password. Agree to terms and click **Create Account**.
3. Open the verification email sent to your inbox and confirm your email.
4. Click your username at the top right -> select **My API Keys**.
5. Under "Create key", enter a name (e.g., `agriflow-weather`) and click **Generate**.
6. Copy the 32-character hexadecimal key.
7. Paste into `backend/.env` and Railway Variables:
   ```env
   OPENWEATHER_API_KEY=your_openweathermap_api_key_here
   ```
> **Note**: New OpenWeatherMap keys take 10-30 minutes to activate on their servers.

---

## 7. NewsAPI — Agricultural News Feed

- **Official Sign-Up Page**: [https://newsapi.org/register](https://newsapi.org/register)
- **Direct Account Page**: [https://newsapi.org/account](https://newsapi.org/account)

### Step-by-Step Instructions:
1. Navigate to [https://newsapi.org/register](https://newsapi.org/register).
2. Fill in First Name, Email, and Password.
3. Select "I am an individual" and accept terms.
4. Click **Submit**.
5. Your API key will be displayed directly on the screen.
6. Copy the 32-character key.
7. Paste into `backend/.env` and Railway Variables:
   ```env
   NEWS_API_KEY=your_news_api_key_here
   ```

---

## 8. OpenCage — Geocoding & Coordinates

- **Official Sign-Up Page**: [https://opencagedata.com/users/sign_up](https://opencagedata.com/users/sign_up)
- **Direct Dashboard Page**: [https://opencagedata.com/dashboard#api-keys](https://opencagedata.com/dashboard#api-keys)

### Step-by-Step Instructions:
1. Visit [https://opencagedata.com/users/sign_up](https://opencagedata.com/users/sign_up) and register with your email.
2. Check your email inbox to verify your account and set your password.
3. Once logged in, go to the **Geosearch / API Keys** tab.
4. Your default API key (32 characters) is listed under **Your API Keys**.
5. Click **Copy**.
6. Paste into `backend/.env` and Railway Variables:
   ```env
   OPENCAGE_API_KEY=your_opencage_api_key_here
   ```

---

## 9. Razorpay — Payment Gateway Checkout (Test Mode)

- **Official Sign-Up Page**: [https://dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup)
- **Direct API Keys Page**: [https://dashboard.razorpay.com/app/keys](https://dashboard.razorpay.com/app/keys)

### Step-by-Step Instructions:
1. Go to [https://dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup) and sign up with Google or your phone number.
2. Once on the dashboard, look at the top header or left sidebar and switch the mode toggle from **Live Mode** to **Test Mode** (no KYC/bank required).
3. On the left navigation bar, go to **Account & Settings**.
4. Under the "Website and app settings" section, click **API Keys**.
5. Click **Generate Test Key** (or Regenerate Key).
6. A pop-up will display:
   - **Key Id** (starts with `rzp_test_...`)
   - **Key Secret**
7. Copy both values.
8. Paste into `backend/.env` and Railway Variables:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## 10. YouTube Data API v3 — Learning Hub Video Search

- **Official Console**: [https://console.cloud.google.com/](https://console.cloud.google.com/)
- **Direct API Library Page**: [https://console.cloud.google.com/apis/library/youtube.googleapis.com](https://console.cloud.google.com/apis/library/youtube.googleapis.com)

### Step-by-Step Instructions:
1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/) and sign in with your Google account.
2. Click the project dropdown in the top navigation bar and click **New Project**. Name it `AgriFlow` and click **Create**.
3. In the left menu, select **APIs & Services** -> **Library**.
4. In the search box, type **YouTube Data API v3** and select it from the results.
5. Click the blue **Enable** button.
6. Once enabled, go to **APIs & Services** -> **Credentials** from the left menu.
7. Click **+ CREATE CREDENTIALS** at the top and choose **API Key**.
8. A modal will show your new key (starts with `AIzaSy...`).
9. Copy the key.
10. Paste into `backend/.env` and Railway Variables:
    ```env
    YOUTUBE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    ```

---

## 11. Hugging Face — Crop Disease AI Models

- **Official Sign-Up Page**: [https://huggingface.co/join](https://huggingface.co/join)
- **Direct Access Tokens Page**: [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

### Step-by-Step Instructions:
1. Navigate to [https://huggingface.co/join](https://huggingface.co/join) and create an account (or log in).
2. In the top-right corner, click your profile icon and select **Settings**.
3. In the left sidebar under settings, click **Access Tokens** (or visit [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)).
4. Click **+ Create new token**.
5. Set Name to `agriflow-models` and select Type as **Read** (free inference only requires Read permissions).
6. Click **Create token**.
7. Copy the token starting with `hf_...`.
8. Paste into `backend/.env` and Railway Variables:
    ```env
    HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    ```

---

## 12. JWT Secret — Auth Encryption Token

No external website is needed. This is generated locally using Python's cryptographic randomness.

### Step-by-Step Instructions:
1. Open PowerShell, Command Prompt, or terminal.
2. Run this one-line command:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```
3. Copy the output string.
4. Paste into `backend/.env` and Railway Variables:
   ```env
   JWT_SECRET=your_generated_cryptographic_secret_here
   ```

---

## 13. Emergency Demo Mode (Skip All OTP Verification)

If you are demonstrating the app or want to test without sending real emails or SMS:
- Add this line to `backend/.env` or Railway Variables:
  ```env
  DISABLE_OTP_VERIFICATION=true
  ```
- **What this does**:
  - Registration completes immediately without waiting for an email verification code.
  - Forgot Password allows instant password reset.
  - Phone OTP verification is auto-approved.
