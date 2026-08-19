# Agent WAF — AWS EC2 Deployment Guide

This guide details the complete process for deploying the Agent WAF monorepo to an AWS EC2 `t3.micro` instance running Ubuntu 24.04 LTS.

## 1. AWS EC2 Provisioning

1. **Launch Instance**: Launch a `t3.micro` instance using the latest Ubuntu 24.04 LTS AMI.
2. **Key Pair**: Create or attach an existing RSA key pair (`.pem`) for SSH access.
3. **Security Group**:
   - **Inbound Rule 1**: SSH (Port 22) - `0.0.0.0/0` (or your IP).
   - **Inbound Rule 2**: HTTP (Port 80) - `0.0.0.0/0`.
4. **Elastic IP**: Allocate an Elastic IP and associate it with your new instance so the public IP remains static.

## 2. Server Initialization (SSH)

SSH into your instance using your key pair:

```bash
ssh -i /path/to/key.pem ubuntu@<ELASTIC_IP>
```

Update packages and install Docker:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
```

_Note: Log out and back in for the Docker group permissions to take effect._

## 3. Deployment Preparation

Clone the repository:

```bash
git clone <YOUR_REPO_URL> agent-waf
cd agent-waf
```

Create the production environment file:

```bash
cat << 'EOF' > .env
# Production Environment Variables
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agent_waf?schema=public
REDIS_URL=redis://redis:6379

# Replace this with your actual Gemini API Key
GEMINI_API_KEY=YOUR_API_KEY_HERE
GEMINI_MODEL=gemini-2.5-flash

# Generate a strong random string (e.g. openssl rand -base64 32)
BETTER_AUTH_SECRET=YOUR_SECRET_KEY_HERE

# The public Elastic IP of your EC2 instance
BETTER_AUTH_URL=http://<ELASTIC_IP>
CORS_ORIGIN=http://<ELASTIC_IP>
EOF
```

## 4. Spin Up the Stack

Bring up the multi-container Docker Compose stack in detached mode:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This will build the frontend and backend containers, and pull PostgreSQL 17 and Redis 7.

## 5. Database Migration & Seeding

Once the containers are running and healthy, apply the Prisma migrations to initialize the PostgreSQL database schema:

```bash
docker compose -f docker-compose.prod.yml exec backend pnpm prisma migrate deploy
```

_(If you created a database seed script, you can run it via `docker compose -f docker-compose.prod.yml exec backend pnpm prisma db seed`)_

## 6. Verification

1. Access the dashboard by navigating to `http://<ELASTIC_IP>` in your browser.
2. The UI is served via Nginx on Port 80, which securely reverse-proxies `/api` and `/socket.io` to the internal backend container.
3. Use the Demo Admin **Quick Login** button to access the dashboard and verify live Socket.IO feeds.

> **Done! Your Agent WAF is now running in production.**
