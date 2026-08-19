# Agent WAF — Local Deployment Guide

This guide provides step-by-step instructions for running the Agent WAF on your local machine. It is written for beginners, so every step is explained.

You have two options for local deployment:
1. **Standard Node.js (Development Mode)**: Best for active development. Runs the backend and frontend using standard Vite/Node processes, while relying on Docker just for the database and cache.
2. **Full Docker Deployment (Production Mode)**: Best for testing the exact production infrastructure. Runs the entire stack (including the frontend Nginx proxy and Node backend) inside Docker.

---

## 0. Download the Code (Required for both options)

Before you begin, you need to download the code to your machine using Git. Open your terminal (or command prompt) and run:

```bash
# Download the repository
git clone https://github.com/loopingdhanush/AgentWAF.git

# Navigate into the project folder
cd AgentWAF
```

---

## Option 1: Standard Node.js (Development Mode)

### Prerequisites
Make sure you have these installed on your computer:
- **Node.js** (version 22 or higher)
- **Git** (to clone the code)
- **Docker Desktop** (must be installed and running in the background)
- **pnpm** (Once Node.js is installed, run `corepack enable && corepack prepare pnpm@latest --activate` in your terminal to install pnpm)

### 1. Start Infrastructure (PostgreSQL & Redis)
Instead of installing databases directly on your machine, run them via Docker:
```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
```

### 2. Configure Environment Variables
Create the backend `.env` file from the example template:
```bash
cp apps/backend/.env.example apps/backend/.env
```
Open `apps/backend/.env` in your editor and add your **Gemini API Key**:
```env
GEMINI_API_KEY=your_real_key_from_google_ai_studio
```

### 3. Install Dependencies & Seed Database
Install all monorepo packages, run database migrations, and seed demo data:
```bash
pnpm install
pnpm --filter backend prisma migrate deploy
pnpm --filter backend db:seed
```

### 4. Start Development Servers
Start both the React frontend and Node.js backend simultaneously:
```bash
pnpm dev
```
- Open **http://localhost:3000** in your browser.
- Click **Quick Login (Demo Admin)** to access the dashboard.

---

## Option 2: Full Local Docker Deployment (Production Mode)

Use this method to verify that the Dockerfiles and `docker-compose.prod.yml` work correctly before deploying to a cloud provider.

### Prerequisites
- Docker Desktop (must be running)

### 1. Configure Environment Variables
Create the root `.env` file (Docker Compose will read this):
```bash
cp apps/backend/.env.example .env
```
Ensure your `GEMINI_API_KEY` is set in the `.env` file.

### 2. Build and Start the Stack
This command will build the multi-stage Docker images for the frontend (Nginx) and backend, and start them alongside PostgreSQL and Redis.
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Run Database Migrations
Once the containers are up, initialize the PostgreSQL schema by running the migration command *inside* the backend container:
```bash
docker compose -f docker-compose.prod.yml exec backend pnpm prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend pnpm db:seed
```

### 4. Verification
- Open **http://localhost** in your browser (Note: Port 80, not 3000!).
- The React application is served statically by Nginx.
- Nginx securely proxies all `/api/*` and `/socket.io/*` requests internally to the backend container.

### Stopping the Docker Stack
To stop all containers and remove the isolated network:
```bash
docker compose -f docker-compose.prod.yml down
```
*(To preserve your database data across restarts, do not use the `-v` flag unless you explicitly want to wipe the volumes).*
