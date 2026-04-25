<div align="center">
  <h1>EffiSync</h1>
  <p><b>Your time deserves more than just a to-do list.</b></p>
</div>

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

### 5. Build for Production
```bash
pnpm build:all
```
