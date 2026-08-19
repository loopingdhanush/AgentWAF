# Agent WAF Project — Standing Rules & Architecture Guidelines

## Workspace & Package Management

- Package manager: `pnpm` (workspace monorepo defined in `pnpm-workspace.yaml`).
- Monorepo layout:
  - `apps/backend`: Express 5, Prisma 7, Socket.IO, Pino, Better-Auth, Redis, Gemini SDK.
  - `apps/frontend`: Vite + React 19 + TypeScript + Tailwind CSS + shadcn/ui.
  - `packages/shared-types`: Common TypeScript interfaces, enums, and Zod schemas.

## Backend Technical Stack & Rules

- Runtime: Node 22+ (ESM only, `"type": "module"` in `package.json`).
- TypeScript: 5.x with `"strict": true`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"target": "ES2023"`.
- Execution: Run via `tsx` (`tsx src/index.ts`) in both dev and production to avoid ESM relative-import extension friction.
- ORM: Prisma 7.x (non-negotiable).
  - Uses `prisma.config.ts` for database connection configuration with `defineConfig` and `env("DATABASE_URL")`.
  - Uses `@prisma/adapter-pg` driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })`.
  - Schema client generator output target: `../src/generated/prisma`.
- Database & Cache:
  - Database: PostgreSQL (Prisma 7).
  - Cache, Rate Limiting & Realtime Bus: Redis (ioredis client).
- Authentication:
  - Better-Auth (email/password only, session cookies).
  - Model naming: User, Session, Account, Verification (internal WAF sessions are named `AgentSession`).
- LLM Agent Integration:
  - SDK: Official `@google/genai`.
  - Model ID: Dynamically retrieved from `process.env.GEMINI_MODEL`, defaulting to `"gemini-2.5-flash"`. Never hardcode a model name.
- Validation & Security:
  - Request validation: Zod schemas on every request body.
  - Logging: Structured JSON using `pino` (one line per event, request IDs, latency tracking, no credentials or secrets logged).
  - Security headers: `helmet`, explicit CORS allowlist from environment, and front-door Redis-backed rate limiting (`express-rate-limit` + `rate-limit-redis`).

## Frontend Technical Stack & Rules

- Framework: Vite + React 19 + TypeScript.
- Styling & Components: Tailwind CSS + shadcn/ui (radix-ui primitives, Lucide icons, recharts for data visualization).
- Realtime: Socket.IO client subscribed to `/dashboard` namespace on `"tool_call"` events.
- Client Auth: `@better-auth/react` (or better-auth client) with pre-filled demo admin credentials and quick-login action.

## Checkpoint & Safety Policies

- Never commit `.env` or real secrets.
- Always verify Prisma 7 and Better-Auth API shapes according to official documentation.
- Maintain strict phased execution and pause for user review at every designated CHECKPOINT.
