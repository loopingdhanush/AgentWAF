# Agent WAF Backend Architecture & Code Walkthrough

This document is designed to help you understand and confidently explain every core part of the Agent WAF Backend (`apps/backend/src`). The backend is built using Node 22 (ESM), Express 5, Prisma 7, Socket.IO, and Better-Auth.

---

## 1. `src/index.ts` (The Entry Point)
**Purpose:** This is the absolute starting point of the backend application.

**What it does:**
- **Express 5 Server:** It initializes the Express application and sets up standard middleware (JSON parsing, Helmet for security, CORS for the frontend).
- **Socket.IO:** It creates an HTTP server and attaches a Socket.IO server to it. This allows the backend to stream real-time updates (like blocked tool calls) to the frontend dashboard.
- **Routing:** It mounts the various route handlers (from the `routes/` folder) to specific URL paths like `/api/v1/tool-call` and `/api/admin`.
- **Health Checks:** It defines the `/healthz` and `/api/version` endpoints to verify that the server, database, and Redis are running properly.

**Key Concept to Explain:** "This file glues everything together. It opens the network port to listen for HTTP requests and WebSockets, and routes incoming traffic to the appropriate modules."

---

## 2. `src/lib/` (Core Infrastructure Services)
**Purpose:** This folder contains the singleton instances of all the external infrastructure dependencies. By keeping them here, the rest of the application can import them cleanly without re-initializing connections.

**What's inside:**
- **`prisma.ts`**: Sets up the Prisma ORM Client (v7) using the `@prisma/adapter-pg` driver. This is how the app talks to PostgreSQL to store rules, agents, and logs.
- **`redis.ts`**: Initializes the `ioredis` client. Redis is used for high-speed rate-limiting and as a Pub/Sub bus to broadcast events.
- **`logger.ts`**: Configures `pino`, a blazing-fast structured JSON logger. Every request and WAF evaluation is logged through this to ensure we have an audit trail without crashing the app.
- **`auth.ts`**: Sets up Better-Auth, which handles the session cookies and authentication for the admin dashboard.

**Key Concept to Explain:** "The `lib` folder is the backbone. It abstracts away the complex database and cache connections so our business logic can just say `db.user.findMany()` or `redis.set()`."

---

## 3. `src/mock-tools/` (The Fake APIs)
**Purpose:** Since this WAF is designed to protect internal APIs, we need some "internal APIs" to protect for the demo!

**What's inside:**
- Simple TypeScript functions that simulate real enterprise systems. For example:
  - `get_customer_record`: Returns mock JSON data for a customer.
  - `send_email`: Simulates sending an email but just returns a success message.
  - `execute_report_query`: Simulates running an SQL query.
- These tools intentionally have vulnerabilities (like accepting raw SQL strings) so that the WAF has something to protect against.

**Key Concept to Explain:** "These are our dummy destination servers. The AI agent wants to call these tools, but the WAF stands in the middle to inspect the request before letting it reach these files."

---

## 4. `src/rules/` (The Core WAF Engine)
**Purpose:** This is the absolute brain of the Agent WAF. When an AI agent tries to call a tool, the request goes through this pipeline.

**What's inside:**
- **`index.ts` (The Pipeline):** Takes an incoming tool call and runs it through all active WAF policies sequentially. If any policy fails, it immediately blocks the request.
- **Policy Evaluators:**
  - `rate-limit.ts`: Checks Redis to ensure the agent isn't calling tools too fast.
  - `data-scope.ts`: Uses Regex to ensure an agent is only accessing data it is allowed to (e.g., stopping Agent A from reading Agent B's customers).
  - `sequence.ts`: Enforces stateful rules (e.g., "You cannot run `update_customer` unless you have run `get_customer` in this session").
  - `blocklist.ts`: Uses Regex to block malicious inputs like SQL injection or prompt injection payloads inside the parameters.

**Key Concept to Explain:** "The rules engine is a gauntlet. Every AI tool call must pass through every active rule evaluator. If it passes, the tool executes. If it fails, the engine generates an intercept reason and blocks the execution."

---

## 5. `src/routes/` (The API Endpoints)
**Purpose:** This folder translates HTTP web requests into backend actions.

**What's inside:**
- **`toolCallRouter.ts`**: The most important route. It receives POST requests from AI agents, extracts the parameters, passes them to the `rules/` engine for evaluation, and logs the result to the database.
- **`adminRouter.ts`**: Protected by Better-Auth, these routes allow the frontend dashboard to fetch stats, update rules, create agents, and view logs.
- **`agentRunRouter.ts`**: Contains the endpoint that triggers the Sandbox testing environment.

**Key Concept to Explain:** "Routes are the doors to our application. They handle the web traffic, enforce authentication, and hand the payload over to our internal logic."

---

## 6. `src/agent/` (The AI Agent Simulator)
**Purpose:** This folder actually builds an autonomous AI loop using Google's Gemini SDK (`@google/genai`).

**What's inside:**
- When a user types a goal in the Sandbox (e.g., "Find CUST-1002 and update their balance"), this module spins up a Gemini model.
- It gives Gemini a list of available tools (the `mock-tools`) and a prompt.
- **The Loop:** Gemini thinks, decides to call a tool, and sends the request. This folder intercepts that request and routes it *through our WAF Gateway* (`routes/toolCallRouter`). 
- If the WAF blocks the tool, this module feeds the error back to Gemini so the AI can "adapt" and try a different approach.

**Key Concept to Explain:** "This is our built-in test dummy. It creates a real AI agent that autonomously tries to achieve a goal by calling our tools, proving that our WAF can intercept and correct an AI's behavior in real-time."
