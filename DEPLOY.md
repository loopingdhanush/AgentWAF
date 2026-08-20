# Agent WAF — Local Deployment Guide

This guide provides step-by-step instructions for running the Agent WAF on your local machine for active development. It relies on standard Node.js processes for the backend and frontend, and uses Docker just for the PostgreSQL database and Redis cache.

---

## 0. Download the Code

Before you begin, you need to download the code to your machine using Git. Open your terminal (or command prompt) and run:

```bash
# Download the repository
git clone https://github.com/loopingdhanush/AgentWAF.git

# Navigate into the project folder
cd AgentWAF
```

---

## 1. Local Development Setup

### Prerequisites
Make sure you have these installed on your computer:
- **Node.js** (version 22 or higher)
- **Git** (to clone the code)
- **Docker Desktop** (must be installed and running in the background)
- **pnpm** (Once Node.js is installed, run `corepack enable && corepack prepare pnpm@latest --activate` in your terminal to install pnpm)

### Step 1: Install Dependencies
Install all required packages via `pnpm`:
```bash
pnpm install
```

### Step 2: Run the Setup Script
We've included an automated setup script that will start PostgreSQL and Redis via Docker, wait for them to initialize, run database migrations, and seed the demo data automatically.

```bash
pnpm run setup:dev
```
*(If prompted, add your **Gemini API Key** to `apps/backend/.env` and re-run the setup script)*

### Step 3: Start Development Servers
Once setup is complete, start both the React frontend and Node.js backend simultaneously in two different terminal windows:

**Terminal 1 (Backend):**
```bash
pnpm dev:backend
```

**Terminal 2 (Frontend):**
```bash
pnpm dev:frontend
```

- Open **http://localhost:3000** in your browser.
- Click **Quick Login (Demo Admin)** to access the dashboard.

---

## Troubleshooting

### 1. Database Connection Refused / Port Conflicts
If you already have PostgreSQL running on your machine (port `5432`), Docker will fail to bind the port.
**Fix:**
1. Open `docker-compose.dev.yml` and change the mapped port (e.g., to `"5433:5432"`).
2. Open your `.env` (and `apps/backend/.env`) and update the `DATABASE_URL` to match the new port:
   `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/agent_waf?schema=public`

### 2. Frontend Build Fails (Cannot find module)
If Docker build commands crash with a missing module error (like `typescript`), it usually means your host's local `node_modules` are conflicting.
**Fix:** Ensure the `.dockerignore` file exists in the root directory and contains `**/node_modules`.
