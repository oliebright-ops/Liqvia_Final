# syntax=docker/dockerfile:1
# Unified Liqvia app — Next.js UI + NestJS API on port 3000
FROM node:20-bookworm-slim AS base
RUN corepack enable
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY backend/prisma backend/prisma
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts

FROM deps AS build
COPY packages/shared packages/shared
COPY backend backend
COPY frontend frontend
COPY samples samples
RUN mkdir -p frontend/public
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts
RUN pnpm rebuild sharp esbuild
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @liqvia2/shared build \
  && pnpm --filter @liqvia2/backend exec prisma generate \
  && pnpm --filter @liqvia2/backend build \
  && pnpm --filter @liqvia2/frontend build \
  && pnpm --filter @liqvia2/frontend build:server

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/.npmrc ./.npmrc
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/backend ./backend
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY --from=build /app/frontend/node_modules ./frontend/node_modules
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/server-dist ./frontend/server-dist
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/samples ./samples
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "frontend/server-dist/index.js"]
