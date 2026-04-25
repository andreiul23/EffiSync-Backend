<div align="center">
  <h1>EffiSync</h1>
  <p><b>Your time deserves more than just a to-do list.</b></p>
</div>

## 🎬 Try the Live Demo (no signup)

A one-click demo seeds a household ("Demo Household"), 3 members, and 8 realistic tasks across all categories.

**On the Login page click `✨ Try Live Demo (no signup)`** — or use these credentials manually:

| Email                  | Password   | Role               | Points |
| ---------------------- | ---------- | ------------------ | ------ |
| `demo@effisync.app`    | `demo1234` | Primary user (you) | 120    |
| `maria@effisync.app`   | `demo1234` | Housemate          | 80     |
| `andrei@effisync.app`  | `demo1234` | Housemate          | 45     |

The seed is **idempotent** — every demo login resets the data to a clean state.

### 🎯 Suggested 90-second demo script
1. Login with the demo button → land on **Groups**: see 3 members + 8 tasks pre-populated.
2. Click the **✨ AI button** (bottom-right) → click the starter prompt **"⚖️ Split chores fairly"** → watch the AI chain multiple tools (chips appear under each step — click to expand).
3. Try **"⏰ What's overdue?"** to see the AI read household state and prioritize.
4. Open **Calendar** → see tasks rendered in their time slots.
5. Open **Account** → click **Connect Google Calendar** for the OAuth flow (optional).

## 📸 Overview
<!-- Add placeholders for screenshots/GIFs here -->
![EffiSync Dashboard Placeholder](https://via.placeholder.com/800x400?text=EffiSync+Dashboard+Screenshot)

## 💡 The "Why"
Household chores and group scheduling often devolve into chaos, miscommunication, and unfair distribution of work. **EffiSync** solves this using an autonomous **AI Fairness algorithm** that intelligently delegates tasks, manages your calendar, and maintains harmony through a balanced gamified economy. It's not just a tracker; it's your proactive household orchestrator.

## ✨ Key Features
- **🤖 AI Secretary**: Proactive scheduling, natural language chat, and group orchestration using Gemini AI.
- **⚖️ Fairness Algorithm**: Smart task distribution based on Google Calendar availability and current points.
- **🎮 Gamified Economy**: Earn points by completing tasks, use "Veto" rights to reject assignments, and engage in the "Task Bidding" loop.
- **📧 Agentic Emailing**: Real transactional Gmail notifications sent directly on your behalf by your AI agent.
- **📅 Google Calendar Sync**: Deep, bi-directional integration with the Google ecosystem to respect your true free time.

## 🛠 Tech Stack
- **Fastify** - High-performance Node.js backend.
- **Prisma** - Next-generation Node.js and TypeScript ORM.
- **Supabase** - Serverless PostgreSQL database with connection pooling.
- **Gemini AI** - Advanced LLM for intelligent orchestration and natural language processing.
- **React & SCSS** - Modern, responsive, and visually stunning frontend.
- **pnpm Workspaces** - Monorepo orchestration for a unified developer experience.

## 📁 Project Structure
```
EffiSync/
├── backend/          # Fastify + Prisma + Gemini AI
│   ├── src/
│   │   ├── config/       # Environment validation (Zod)
│   │   ├── controllers/  # Request handlers
│   │   ├── lib/          # Singletons (Prisma, AI model)
│   │   ├── routes/       # Route registrations (auth, tasks, chat, debug)
│   │   └── services/     # Business logic (economy, email, calendar, cron)
│   └── prisma/           # Prisma schema & migrations
├── frontend/         # React + Vite + SCSS
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── context/      # React context (AuthContext)
│       ├── layout/       # App shell (Header, Footer, Layout)
│       ├── pages/        # Route-level pages
│       ├── services/     # API client layer
│       └── styles/       # Global SCSS variables, mixins
├── shared/           # @effisync/shared — enums, constants, DTOs
├── .env.example      # Master env template for all projects
├── .prettierrc       # Shared code formatting config
└── pnpm-workspace.yaml
```

## 🚀 Setup Guide

### Prerequisites
- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0

### 1. Clone & Install
```bash
git clone https://github.com/your-repo/EffiSync.git
cd EffiSync
pnpm install:all
```

### 2. Environment Configuration
Copy the template and fill in your credentials:
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
# Backend
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
GOOGLE_GENERATIVE_AI_API_KEY="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"
PORT=3000
NODE_ENV="development"

# Frontend
VITE_API_URL="http://localhost:3000/api"

# Security / Demo safety
JWT_SECRET="replace_with_a_long_random_secret_at_least_32_chars"
SAFE_MODE="true"
```

### 3. Database Setup
```bash
cd backend
npx prisma db push
npx prisma generate
```

### 4. Run Both Projects
From the **root** directory:
```bash
pnpm dev
```
This starts both the backend (`:3000`) and frontend (`:5173`) concurrently.

Or run individually:
```bash
pnpm dev:backend     # Backend only
pnpm --filter @effisync/frontend dev  # Frontend only
```

### 4.1 Quick Smoke Test (recommended before demo)
With backend running on `http://localhost:3000`, run:
```bash
pnpm --filter @effisync/backend test:smoke
```

### 5. Build for Production
```bash
pnpm build:all
```

## ☁️ Deployment

### Frontend → Vercel
The frontend (`frontend/`) is preconfigured for Vercel via [`frontend/vercel.json`](frontend/vercel.json) (SPA rewrites + Vite framework preset).

1. Import the repo in Vercel and set the **Root Directory** to `frontend`.
2. In **Environment Variables** add:
   - `VITE_API_URL` → public URL of your backend (e.g. `https://your-tunnel.example.com/api`).
3. Deploy. Vercel will run `pnpm install` + `pnpm build` and serve from `dist/`.

### Backend → Local (with optional public tunnel)
For the hackathon the backend runs locally:

```bash
cd backend
pnpm dev    # Listens on http://localhost:3000
```

To make it reachable from the deployed frontend, expose it with a tunnel:

```bash
# Cloudflare quick tunnel (no signup)
cloudflared tunnel --url http://localhost:3000

# or ngrok
ngrok http 3000
```

Take the public URL and set `VITE_API_URL=https://<tunnel>/api` in Vercel, then redeploy.

> ⚠️ **CORS** is already enabled (`origin: true`) so the backend will accept requests from any origin — fine for a demo, tighten before going public.

