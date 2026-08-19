FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies (ignoring scripts initially to avoid prisma errors)
RUN pnpm install --ignore-scripts --frozen-lockfile

# Copy source
COPY packages/shared-types ./packages/shared-types
COPY apps/backend ./apps/backend

# Generate Prisma Client
WORKDIR /app/apps/backend
RUN pnpm prisma generate

# Stage 2: Runner
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production

# Copy node_modules and built assets from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/apps/backend ./apps/backend

WORKDIR /app/apps/backend

# Use tsx as specified in architectural rules to run ESM
CMD ["npx", "tsx", "src/index.ts"]
