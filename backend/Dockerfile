# syntax=docker/dockerfile:1
# Multi-stage production build for the NestJS backend.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Dependencies (with workspace context) ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile || pnpm install

# --- Build ---
FROM deps AS build
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter @liqvia2/shared build \
  && pnpm --filter @liqvia2/backend exec prisma generate \
  && pnpm --filter @liqvia2/backend build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
WORKDIR /app/backend
EXPOSE 3001
# Migrations run automatically inside dist/main.js on startup.
CMD ["node", "dist/main"]
