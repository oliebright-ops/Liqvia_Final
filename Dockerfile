# syntax=docker/dockerfile:1
# Unified Liqvia app — Next.js UI + NestJS API on port 3000
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# Schema is copied in the build stage; skip postinstall (prisma generate) here.
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts

FROM deps AS build
COPY packages/shared packages/shared
COPY backend backend
COPY frontend frontend
COPY samples samples
RUN mkdir -p frontend/public
# Recreate workspace symlinks after full package sources are copied.
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts
# Native addons still needed for Next (sharp, esbuild).
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
CMD ["node", "frontend/server-dist/index.js"]
